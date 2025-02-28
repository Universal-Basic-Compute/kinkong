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
    
    console.log(`Found ${redistributionsRecords.length} redistributions`);
    
    // Log sample redistribution data for debugging
    if (redistributionsRecords.length > 0) {
      const sample = redistributionsRecords[0];
      console.log('Sample redistribution data:');
      console.log({
        id: sample.id,
        wallet: sample.get('wallet'),
        ubcAmount: sample.get('ubcAmount'),
        amount: sample.get('amount'),
        createdAt: sample.get('createdAt'),
        status: sample.get('status')
      });
    }
    
    // Create a map of wallet addresses to their latest redistribution
    const walletToRedistribution = new Map();
    redistributionsRecords.forEach(record => {
      const wallet = record.get('wallet');
      if (wallet) {
        // Only add if this wallet doesn't exist in the map yet (since records are sorted by date desc)
        if (!walletToRedistribution.has(wallet)) {
          walletToRedistribution.set(wallet, {
            redistributionId: record.id,
            ubcAmount: parseFloat(record.get('ubcAmount') || '0'),
            amount: parseFloat(record.get('amount') || '0'),
            createdAt: record.get('createdAt')
          });
        }
      }
    });
    
    console.log(`Mapped ${walletToRedistribution.size} unique wallets with redistributions`);
    
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
    
    console.log(`Returning ${investments.length} investments`);
    res.status(200).json(investments);
  } catch (error) {
    console.error('Error fetching investments:', error);
    res.status(500).json({ error: 'Failed to fetch investments' });
  }
}
