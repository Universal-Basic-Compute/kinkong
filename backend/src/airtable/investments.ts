import { getTable } from './tables';

export interface Investment {
  investmentId: string;
  amount: number;
  token: string;
  solscanUrl: string;
  date: string;
  username?: string;
  wallet: string;
}

export async function getInvestments(): Promise<Investment[]> {
  if (!process.env.KINKONG_AIRTABLE_API_KEY || !process.env.KINKONG_AIRTABLE_BASE_ID) {
    throw new Error('Airtable configuration is missing');
  }

  try {
    const table = getTable('INVESTMENTS');
    
    const records = await table
      .select({
        sort: [{ field: 'amount', direction: 'desc' }]
      })
      .all();

    return records.map(record => ({
      investmentId: record.get('investmentId') as string,
      amount: record.get('amount') as number,
      token: record.get('token') as string || 'USDC', // Default to USDC if not specified
      solscanUrl: record.get('solscanUrl') as string,
      date: record.get('createdAt') as string,
      username: record.get('username') as string || 'Anonymous',
      wallet: record.get('wallet') as string
    }));
  } catch (error) {
    console.error('Error fetching investments from Airtable:', error);
    throw new Error('Failed to fetch investments from database');
  }
}
