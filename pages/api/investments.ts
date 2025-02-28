import { NextApiRequest, NextApiResponse } from 'next';
import Airtable from 'airtable';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Initialize Airtable
    const base = new Airtable({
      apiKey: process.env.KINKONG_AIRTABLE_API_KEY,
    }).base(process.env.KINKONG_AIRTABLE_BASE_ID!);
    
    // Get investments
    const investmentsTable = base.table('INVESTMENTS');
    const investmentsRecords = await investmentsTable.select().all();
    
    // Get the latest 100 redistributions, sorted by createdAt in descending order
    const redistributionsTable = base.table('INVESTOR_REDISTRIBUTIONS');
    const redistributionsRecords = await redistributionsTable.select({
      maxRecords: 100,
      sort: [{ field: 'createdAt', direction: 'desc' }]
    }).all();
    
    // Create a map of wallet addresses to their latest redistribution
    const walletToRedistribution = new Map();
    redistributionsRecords.forEach(record => {
      const wallet = record.get('wallet');
      if (wallet && !walletToRedistribution.has(wallet)) {
        walletToRedistribution.set(wallet, {
          redistributionId: record.id,
          ubcAmount: parseFloat(record.get('ubcAmount') || '0'),
          amount: parseFloat(record.get('amount') || '0'),
          createdAt: record.get('createdAt')
        });
      }
    });
    
    // Map investments and add redistribution data
    const investments = investmentsRecords.map(record => {
      const wallet = record.get('wallet');
      const redistribution = wallet ? walletToRedistribution.get(wallet) : null;
      
      return {
        investmentId: record.id,
        amount: parseFloat(record.get('amount') || '0'),
        token: record.get('token') || 'USDC',
        usdAmount: parseFloat(record.get('usdAmount') || '0'),
        solscanUrl: record.get('solscanUrl') || '',
        date: record.get('createdAt') || '',
        wallet: wallet || '',
        username: record.get('username') || '',  // Add username field
        // Add redistribution data if available
        ubcReturn: redistribution ? redistribution.ubcAmount : undefined,
        return: redistribution ? redistribution.amount : undefined,
        redistributionId: redistribution ? redistribution.redistributionId : undefined,
        redistributionDate: redistribution ? redistribution.createdAt : undefined
      };
    });
    
    res.status(200).json(investments);
  } catch (error) {
    console.error('Error fetching investments:', error);
    res.status(500).json({ error: 'Failed to fetch investments' });
  }
}
