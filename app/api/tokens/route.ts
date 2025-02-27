import { getTable } from '@/backend/src/airtable/tables';
import { NextResponse } from 'next/server';
import type { Record, FieldSet } from 'airtable';

interface TokenRecord extends FieldSet {
  token: string;
  name: string;
  mint: string;
  isActive: boolean;
  xAccount?: string;
  explanation?: string;
  website?: string;
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
    // Get all tokens except UBC and COMPUTE
    const tokensTable = getTable('TOKENS');
    const tokenRecords = await tokensTable
      .select({
        filterByFormula: "AND(" + 
          "NOT({token}='UBC'), " +
          "NOT({token}='COMPUTE'), " +
          "NOT({token}='USDT'), " +
          "NOT({token}='USDC')" +
        ")",
        sort: [{ field: 'isActive', direction: 'desc' }]
      })
      .all();

    // Get snapshots from last 12 hours
    const snapshotsTable = getTable('TOKEN_SNAPSHOTS');
    const snapshotRecords = await snapshotsTable
      .select({
        sort: [{ field: 'createdAt', direction: 'desc' }],
        filterByFormula: "IS_AFTER({createdAt}, DATEADD(NOW(), -12, 'hours'))"
      })
      .all();

    // Create a map keeping only the most recent snapshot for each token
    const snapshotMap: { [key: string]: any } = {};
    for (const record of snapshotRecords) {
      const token = record.get('token');
      // Only store if we don't have this token yet (since records are sorted by date desc)
      if (!snapshotMap[token]) {
        snapshotMap[token] = {
          price: record.get('price') || 0,
          volume24h: record.get('volume24h') || 0,
          liquidity: record.get('liquidity') || 0,
          holderCount: record.get('holderCount') || 0,
          priceTrend: record.get('priceTrend') || 0,
          volumeGrowth: record.get('volumeGrowth') || 0,
          createdAt: record.get('createdAt')
        };
      }
    }

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
        explanation: record.get('explanation'),
        website: record.get('website'),
        price: parseFloat(snapshot.price) || 0,
        priceTrend: parseFloat(snapshot.priceTrend) || 0,
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
