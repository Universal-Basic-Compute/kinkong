import { NextApiRequest, NextApiResponse } from 'next';
import Airtable from 'airtable';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Initialize Airtable
    const base = new Airtable({
      apiKey: process.env.KINKONG_AIRTABLE_API_KEY,
    }).base(process.env.KINKONG_AIRTABLE_BASE_ID!);
    
    // ONLY use the INVESTOR_REDISTRIBUTIONS table
    const redistributionsTable = base.table('INVESTOR_REDISTRIBUTIONS');
    
    // Get the latest 100 redistributions, sorted by createdAt in descending order
    const redistributionsRecords = await redistributionsTable.select({
      maxRecords: 100,
      sort: [{ field: 'createdAt', direction: 'desc' }]
    }).all();
    
    console.log(`Found ${redistributionsRecords.length} redistributions`);
    
    // Map redistributions to the format expected by the frontend
    const redistributions = redistributionsRecords.map(record => {
      return {
        investmentId: record.id, // Use redistribution ID as the investment ID
        amount: parseFloat(record.get('investmentValue') || '0'), // Use investmentValue as amount
        token: 'USDC', // Default to USDC
        usdAmount: parseFloat(record.get('investmentValue') || '0'), // Use investmentValue as usdAmount
        solscanUrl: '',
        date: record.get('createdAt') || '',
        wallet: record.get('wallet') || '',
        username: record.get('username') || '',
        // Return data is already in the redistribution record
        ubcReturn: parseFloat(record.get('ubcAmount') || '0'),
        return: parseFloat(record.get('amount') || '0'),
        redistributionId: record.get('redistributionId'),
        redistributionDate: record.get('createdAt'),
        percentage: parseFloat(record.get('percentage') || '0')
      };
    });
    
    console.log(`Returning ${redistributions.length} redistributions`);
    res.status(200).json(redistributions);
  } catch (error) {
    console.error('Error fetching redistributions:', error);
    res.status(500).json({ error: 'Failed to fetch redistributions' });
  }
}
