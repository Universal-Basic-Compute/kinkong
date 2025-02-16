import { getTable } from './client';

export interface Investment {
  investmentId: string;
  amount: number;
  solscanUrl: string;
  date: string;
  username: string;
  wallet: string;
}

export async function getInvestments(): Promise<Investment[]> {
  if (!process.env.KINOS_AIRTABLE_API_KEY || !process.env.KINOS_AIRTABLE_BASE_ID) {
    throw new Error('Airtable configuration is missing');
  }

  try {
    const table = getTable('INVESTMENTS');
    
    const records = await table
      .select({
        sort: [{ field: 'date', direction: 'desc' }]
      })
      .all();

    return records.map(record => ({
      investmentId: record.get('investmentId') as string,
      amount: record.get('amount') as number,
      solscanUrl: record.get('solscanUrl') as string,
      date: record.get('date') as string,
      username: record.get('username') as string,
      wallet: record.get('wallet') as string
    }));
  } catch (error) {
    console.error('Error fetching investments from Airtable:', error);
    throw new Error('Failed to fetch investments from database');
  }
}
