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
    
    // Get all investments to calculate total value
    const allInvestmentsRecords = await investmentsTable.select().all();
    const totalInvestmentValue = allInvestmentsRecords.reduce((sum, record) => 
      sum + parseFloat(record.get('usdAmount') || '0'), 0);
    
    // Get the latest wallet snapshot for portfolio value
    const snapshotsTable = base.table('WALLET_SNAPSHOTS');
    const snapshots = await snapshotsTable.select({
      maxRecords: 1,
      sort: [{ field: 'createdAt', direction: 'desc' }]
    }).all();
    
    // Calculate profit share
    let portfolioValue = totalInvestmentValue;
    let profitShare = 0;
    
    if (snapshots.length > 0) {
      portfolioValue = parseFloat(snapshots[0].get('totalValue') || totalInvestmentValue.toString());
      const profit = portfolioValue - totalInvestmentValue;
      // 75% of profit goes to investors
      profitShare = profit > 0 ? profit * 0.75 : 0;
    }
    
    // Get UBC price
    let ubcPrice = 0.00137; // Default UBC price
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
        }
      }
    } catch (error) {
      console.error('Error fetching UBC price:', error);
    }
    
    // Update investments with calculated returns if no redistribution data
    const investmentsWithReturns = investments.map(investment => {
      // If no redistribution data, calculate returns
      if (investment.ubcReturn === undefined && profitShare > 0) {
        const calculatedReturns = calculateReturns(
          investment, 
          totalInvestmentValue, 
          profitShare,
          ubcPrice
        );
        
        return {
          ...investment,
          return: calculatedReturns.return,
          ubcReturn: calculatedReturns.ubcReturn,
          isCalculated: true // Flag to indicate this is a calculated value
        };
      }
      
      return investment;
    });
    
    res.status(200).json(investmentsWithReturns);
  } catch (error) {
    console.error('Error fetching user investments:', error);
    res.status(500).json({ error: 'Failed to fetch user investments' });
  }
}
