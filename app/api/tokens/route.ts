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

export async function GET() {
  try {
    const table = getTable('TOKENS');
    const records = await table
      .select({
        filterByFormula: '{isActive} = 1'
      })
      .all();

    const tokens = records.map((record: Record<TokenRecord>) => ({
      token: record.get('token'),
      name: record.get('name'),
      mint: record.get('mint'),
      xAccount: record.get('xAccount')
    }));

    return NextResponse.json(tokens);
  } catch (error) {
    console.error('Failed to fetch tokens:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tokens' },
      { status: 500 }
    );
  }
}
