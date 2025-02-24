import { getTable } from '@/backend/src/airtable/tables';
import { NextResponse } from 'next/server';
import type { Record, FieldSet } from 'airtable';

interface TokenRecord extends FieldSet {
  token: string;
  name: string;
  mint: string;
  isActive: boolean;
  xAccount?: string;
}

interface SnapshotRecord extends FieldSet {
  token: string;
  price: number;
  volume24h: number;
  liquidity: number;
  holderCount: number;
  createdAt: string;
}

export async function GET() {
  try {
    // Get all tokens (remove active filter)
    const tokensTable = getTable('TOKENS');
    const tokenRecords = await tokensTable
      .select({
        sort: [{ field: 'isActive', direction: 'desc' }] // Sort by active status
      })
      .all();

    // Get only the latest snapshot for each token
    const snapshotsTable = getTable('TOKEN_SNAPSHOTS');
    const snapshotRecords = await snapshotsTable
      .select({
        sort: [{ field: 'createdAt', direction: 'desc' }],
        // Prendre vraiment le dernier snapshot sans filtre de temps
        maxRecords: 100 // Assez pour avoir au moins 1 snapshot par token
      })
      .all();

    // Create a map of latest snapshots by token
    const snapshotMap = snapshotRecords.reduce((acc, record: Record<SnapshotRecord>) => {
      const token = record.get('token');
      if (!acc[token] || new Date(record.get('createdAt')) > new Date(acc[token].createdAt)) {
        acc[token] = {
          price: record.get('price') || 0,
          volume24h: record.get('volume24h') || 0,
          liquidity: record.get('liquidity') || 0,
          holderCount: record.get('holderCount') || 0,
          priceGrowth: record.get('priceGrowth') || 0, // Récupérer directement du snapshot
          volumeGrowth: record.get('volumeGrowth') || 0, // Récupérer directement du snapshot
          createdAt: record.get('createdAt')
        };
      }
      return acc;
    }, {} as Record<string, any>);

    // Combine token info with snapshot data
    const tokens = tokenRecords.map((record: Record<TokenRecord>) => {
      const token = record.get('token');
      const snapshot = snapshotMap[token] || {};
      
      return {
        token: token,
        name: record.get('name'),
        mint: record.get('mint'),
        xAccount: record.get('xAccount'),
        isActive: Boolean(record.get('isActive')),
        price: parseFloat(snapshot.price) || 0,
        priceGrowth: parseFloat(snapshot.priceGrowth) || 0,
        volumeGrowth: parseFloat(snapshot.volumeGrowth) || 0,
        liquidity: parseFloat(snapshot.liquidity) || 0,
        holderCount: parseInt(snapshot.holderCount) || 0
      };
    });

    return NextResponse.json(tokens);
  } catch (error) {
    console.error('Failed to fetch tokens:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tokens' },
      { status: 500 }
    );
  }
}
