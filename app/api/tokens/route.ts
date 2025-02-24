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

    // Get latest snapshots
    const snapshotsTable = getTable('TOKEN_SNAPSHOTS');
    const snapshotRecords = await snapshotsTable
      .select({
        sort: [{ field: 'createdAt', direction: 'desc' }],
        filterByFormula: 'IS_SAME({createdAt}, DATEADD(NOW(), -1, "hours"), "hour")'
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
          createdAt: record.get('createdAt')
        };
      }
      return acc;
    }, {} as Record<string, any>);

    // Combine token info with snapshot data
    const tokens = tokenRecords.map((record: Record<TokenRecord>) => {
      const token = record.get('token');
      const snapshot = snapshotMap[token] || {};
      
      // Calculer la croissance du prix et du volume
      const priceGrowth = snapshot.priceGrowth || 0;
      const volumeGrowth = snapshot.volumeGrowth || 0;
      
      return {
        token: token,
        name: record.get('name'),
        mint: record.get('mint'),
        xAccount: record.get('xAccount'),
        isActive: record.get('isActive') || false,
        price: snapshot.price || 0,
        priceGrowth: priceGrowth,
        volumeGrowth: volumeGrowth,
        liquidity: snapshot.liquidity || 0,
        holderCount: snapshot.holderCount || 0
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
