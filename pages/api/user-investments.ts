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
    
    // Get the latest redistribution if available
    const latestRedistribution = redistributionsRecords.length > 0 ? redistributionsRecords[0] : null;
    
    // Map investments and add redistribution data
    const investments = investmentsRecords.map(record => {
      return {
        investmentId: record.id,
        amount: parseFloat(record.get('amount') || '0'),
        token: record.get('token') || 'USDC',
        usdAmount: parseFloat(record.get('usdAmount') || '0'),
        solscanUrl: record.get('solscanUrl') || '',
        date: record.get('createdAt') || '',
        username: record.get('username') || '',  // Add username field
        // Add redistribution data if available
        ubcReturn: latestRedistribution ? parseFloat(latestRedistribution.get('ubcAmount') || '0') : undefined,
        return: latestRedistribution ? parseFloat(latestRedistribution.get('amount') || '0') : undefined,
        redistributionDate: latestRedistribution ? latestRedistribution.get('createdAt') : undefined
      };
    });
    
    res.status(200).json(investments);
  } catch (error) {
    console.error('Error fetching user investments:', error);
    res.status(500).json({ error: 'Failed to fetch user investments' });
  }
}
