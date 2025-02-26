import { getTable, TABLES } from '@/backend/src/airtable/tables';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const wallet = searchParams.get('wallet');

  if (!wallet) {
    return NextResponse.json({ error: 'Wallet address required' }, { status: 400 });
  }

  try {
    const table = getTable('Investments');
    const records = await table
      .select({
        filterByFormula: `{wallet} = '${wallet}'`,
        sort: [{ field: 'date', direction: 'desc' }]
      })
      .firstPage();

    if (records.length === 0) {
      return NextResponse.json({ amount: 0 });
    }

    const investment = {
      amount: records[0].get('amount') as number,
      token: records[0].get('token') as string || 'USDC',
      date: records[0].get('date') as string,
      solscanUrl: records[0].get('solscanUrl') as string
    };

    return NextResponse.json(investment);
  } catch (error) {
    console.error('Failed to fetch user investment:', error);
    return NextResponse.json(
      { error: 'Failed to fetch investment data' },
      { status: 500 }
    );
  }
}
