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

    console.log(`Retrieved ${records.length} investment records from Airtable`);
    
    // Log the first record for debugging
    if (records.length > 0) {
      const firstRecord = records[0];
      console.log('Sample investment record:', {
        id: firstRecord.id,
        investmentId: firstRecord.get('investmentId'),
        wallet: firstRecord.get('wallet'),
        fields: Object.keys(firstRecord.fields)
      });
    }

    return records.map(record => {
      const investmentId = record.get('investmentId') as string || record.id;
      const wallet = record.get('wallet') as string;
      
      // Log any records with missing wallet addresses
      if (!wallet) {
        console.warn(`Investment record ${record.id} is missing wallet address`);
      }
      
      return {
        investmentId: investmentId,
        amount: record.get('amount') as number,
        token: record.get('token') as string || 'USDC', // Default to USDC if not specified
        solscanUrl: record.get('solscanUrl') as string,
        date: record.get('createdAt') as string,
        username: record.get('username') as string || 'Anonymous',
        wallet: wallet
      };
    });
  } catch (error) {
    console.error('Error fetching investments from Airtable:', error);
    throw new Error('Failed to fetch investments from database');
  }
}
