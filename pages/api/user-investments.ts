import { NextApiRequest, NextApiResponse } from 'next';
import Airtable from 'airtable';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { wallet } = req.query;
  
  if (!wallet || typeof wallet !== 'string') {
    return res.status(400).json({ error: 'Wallet address is required' });
  }
  
  try {
    // Initialize Airtable
    const base = new Airtable({
      apiKey: process.env.KINKONG_AIRTABLE_API_KEY,
    }).base(process.env.KINKONG_AIRTABLE_BASE_ID!);
    
    // Get user's investments
    const investmentsTable = base.table('INVESTMENTS');
    const investmentsRecords = await investmentsTable.select({
      filterByFormula: `{wallet} = '${wallet}'`
    }).all();
    
    // Get the latest redistributions for this wallet
    const redistributionsTable = base.table('INVESTOR_REDISTRIBUTIONS');
    const redistributionsRecords = await redistributionsTable.select({
      filterByFormula: `{wallet} = '${wallet}'`,
      maxRecords: 100,
      sort: [{ field: 'createdAt', direction: 'desc' }]
    }).all();
    
    console.log(`Found ${redistributionsRecords.length} redistributions for wallet ${wallet}`);
    
    // Create a map of investment IDs to their redistributions
    const investmentToRedistribution = new Map();
    redistributionsRecords.forEach(record => {
      const investmentId = record.get('investmentId');
      if (investmentId) {
        // If there's a specific investment ID, map directly to that investment
        investmentToRedistribution.set(investmentId, {
          redistributionId: record.id,
          ubcAmount: parseFloat(record.get('ubcAmount') || '0'),
          amount: parseFloat(record.get('amount') || '0'),
          createdAt: record.get('createdAt')
        });
      }
    });
    
    // Get the latest redistribution if available (for fallback)
    const latestRedistribution = redistributionsRecords.length > 0 ? redistributionsRecords[0] : null;
    
    // Log the latest redistribution for debugging
    if (latestRedistribution) {
      console.log('Latest redistribution data:');
      console.log({
        id: latestRedistribution.id,
        wallet: latestRedistribution.get('wallet'),
        ubcAmount: latestRedistribution.get('ubcAmount'),
        amount: latestRedistribution.get('amount'),
        createdAt: latestRedistribution.get('createdAt'),
        status: latestRedistribution.get('status')
      });
    } else {
      console.log('No redistributions found for this wallet');
    }
    
    // Map investments and add redistribution data
    const investments = investmentsRecords.map(record => {
      const investmentId = record.id;
      
      // First try to find a redistribution specifically for this investment
      const specificRedistribution = investmentToRedistribution.get(investmentId);
      
      return {
        investmentId: record.id,
        amount: parseFloat(record.get('amount') || '0'),
        token: record.get('token') || 'USDC',
        usdAmount: parseFloat(record.get('usdAmount') || '0'),
        solscanUrl: record.get('solscanUrl') || '',
        date: record.get('createdAt') || '',
        username: record.get('username') || '',  // Add username field
        // Use specific redistribution if available, otherwise fall back to latest
        ubcReturn: specificRedistribution ? specificRedistribution.ubcAmount : 
                  latestRedistribution ? parseFloat(latestRedistribution.get('ubcAmount') || '0') : undefined,
        return: specificRedistribution ? specificRedistribution.amount : 
                latestRedistribution ? parseFloat(latestRedistribution.get('amount') || '0') : undefined,
        redistributionDate: specificRedistribution ? specificRedistribution.createdAt : 
                          latestRedistribution ? latestRedistribution.get('createdAt') : undefined
      };
    });
    
    res.status(200).json(investments);
  } catch (error) {
    console.error('Error fetching user investments:', error);
    res.status(500).json({ error: 'Failed to fetch user investments' });
  }
}
