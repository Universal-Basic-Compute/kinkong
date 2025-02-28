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
    
    // Create a map of wallet addresses to their redistributions (allowing multiple per wallet)
    const walletToRedistributions = new Map();
    redistributionsRecords.forEach(record => {
      const wallet = record.get('wallet');
      if (wallet) {
        if (!walletToRedistributions.has(wallet)) {
          walletToRedistributions.set(wallet, []);
        }
        
        walletToRedistributions.get(wallet).push({
          redistributionId: record.id,
          ubcAmount: parseFloat(record.get('ubcAmount') || '0'),
          amount: parseFloat(record.get('amount') || '0'),
          createdAt: record.get('createdAt'),
          investmentId: record.get('investmentId') // Add this field to match specific investments
        });
      }
    });
    
    console.log(`Mapped ${walletToRedistributions.size} unique wallets with redistributions`);
    
    // Map investments and add redistribution data
    const investments = investmentsRecords.map(record => {
      const wallet = record.get('wallet');
      const investmentId = record.id;
      
      // Find the redistribution for this specific investment ID if possible
      let redistribution = null;
      if (wallet && walletToRedistributions.has(wallet)) {
        const redistributions = walletToRedistributions.get(wallet);
        
        // First try to find a redistribution that specifically matches this investment ID
        redistribution = redistributions.find(r => r.investmentId === investmentId);
        
        // If no specific match, use the latest redistribution for this wallet
        if (!redistribution && redistributions.length > 0) {
          // Sort by date descending and take the first one
          redistribution = [...redistributions].sort((a, b) => 
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )[0];
        }
      }
      
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
