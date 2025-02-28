import { NextApiRequest, NextApiResponse } from 'next';
import Airtable from 'airtable';

// Helper function to calculate returns based on investment percentage
function calculateReturns(investment: any, totalInvestmentValue: number, profitShare: number, ubcPrice: number) {
  try {
    // Calculate percentage of total investment
    const percentage = investment.usdAmount / totalInvestmentValue;
    
    // Calculate USDC return based on percentage of profit share
    const usdcReturn = percentage * profitShare;
    
    // Calculate UBC return based on USDC return and UBC price
    const ubcReturn = ubcPrice > 0 ? usdcReturn / ubcPrice : 0;
    
    return {
      return: usdcReturn,
      ubcReturn: ubcReturn
    };
  } catch (error) {
    console.error('Error calculating returns:', error);
    return { return: 0, ubcReturn: 0 };
  }
}

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
    
    // Get user's redistributions
    const redistributionsTable = base.table('INVESTOR_REDISTRIBUTIONS');
    const redistributionsRecords = await redistributionsTable.select({
      filterByFormula: `{wallet} = '${wallet}'`,
      sort: [{ field: 'createdAt', direction: 'desc' }]
    }).all();
    
    console.log(`Found ${redistributionsRecords.length} redistributions for wallet ${wallet}`);
    
    // Map redistributions to the format expected by the frontend
    const redistributions = redistributionsRecords.map(record => {
      return {
        investmentId: record.id,
        amount: parseFloat(record.get('investmentValue') || '0'),
        token: 'USDC', // Default to USDC
        usdAmount: parseFloat(record.get('investmentValue') || '0'),
        solscanUrl: '',
        date: record.get('createdAt') || '',
        wallet: record.get('wallet') || '',
        username: record.get('username') || '',
        ubcReturn: parseFloat(record.get('ubcAmount') || '0'),
        return: parseFloat(record.get('amount') || '0'),
        redistributionId: record.get('redistributionId'),
        redistributionDate: record.get('createdAt'),
        percentage: parseFloat(record.get('percentage') || '0')
      };
    });
    
    // Get UBC price for reference (might be needed for display)
    let ubcPrice = 0.001374; // Default UBC price
    try {
      // Try to get UBC price from DexScreener
      const ubc_mint = "9psiRdn9cXYVps4F1kFuoNjd2EtmqNJXrCPmRppJpump";
      const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${ubc_mint}`);
      const data = await response.json();
      
      if (data.pairs && data.pairs.length > 0) {
        // Get the first pair with USDC or USDT (stablecoin pair)
        let ubc_pair = null;
        for (const pair of data.pairs) {
          // Look for USDC or USDT pair
          if (pair.quoteToken && 
              (pair.quoteToken.symbol.includes('USDC') || pair.quoteToken.symbol.includes('USDT'))) {
            ubc_pair = pair;
            break;
          }
        }
        
        // If no USDC/USDT pair, just use the first pair
        if (!ubc_pair && data.pairs.length > 0) {
          ubc_pair = data.pairs[0];
        }
        
        if (ubc_pair && ubc_pair.priceUsd) {
          ubcPrice = parseFloat(ubc_pair.priceUsd);
          console.log(`UBC price: $${ubcPrice}`);
        }
      }
    } catch (error) {
      console.error('Error fetching UBC price:', error);
    }
    
    // Add debugging information
    console.log(`User redistributions: ${redistributions.length}`);
    
    res.status(200).json(redistributions);
  } catch (error) {
    console.error('Error fetching user investments:', error);
    res.status(500).json({ error: 'Failed to fetch user investments' });
  }
}
