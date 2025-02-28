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
      const amount = parseFloat(record.get('amount') || '0');
      const token = record.get('token') || 'USDC';
      
      // Get usdAmount directly from the record if available
      let usdAmount = parseFloat(record.get('usdAmount') || '0');
      
      // If usdAmount is not available or is zero, calculate it based on token type
      if (!usdAmount) {
        if (token === 'USDC' || token === 'USDT') {
          // For stablecoins, usdAmount equals amount
          usdAmount = amount;
        } else if (token === 'UBC' && ubcPrice) {
          // For UBC, convert using price
          usdAmount = amount * ubcPrice;
        } else if (token === 'COMPUTE' && compute_price) {
          // For COMPUTE, convert using price
          usdAmount = amount * compute_price;
        }
        
        console.log(`Calculated usdAmount for ${token}: ${amount} * ${token === 'UBC' ? ubcPrice : token === 'COMPUTE' ? compute_price : 1} = ${usdAmount}`);
      }
      
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
        amount: amount,
        token: token,
        usdAmount: usdAmount, // Make sure usdAmount is included
        solscanUrl: record.get('solscanUrl') || '',
        date: record.get('createdAt') || '',
        wallet: wallet || '',
        username: record.get('username') || '',  // Add username field
        // Add redistribution data if available - map Airtable field names to frontend expected names
        ubcReturn: redistribution ? redistribution.ubcAmount : undefined,
        return: redistribution ? redistribution.amount : undefined,
        redistributionId: redistribution ? redistribution.redistributionId : undefined,
        redistributionDate: redistribution ? redistribution.createdAt : undefined
      };
    });
    
    // Calculate total investment value
    const totalInvestmentValue = investments.reduce((sum, inv) => sum + inv.usdAmount, 0);
    console.log(`Total investment value: $${totalInvestmentValue}`);
    
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
      
      console.log(`Portfolio value: $${portfolioValue}`);
      console.log(`Profit: $${profit}`);
      console.log(`Profit share (75%): $${profitShare}`);
    }
    
    // Get UBC price
    let ubcPrice = 0.001374; // Default UBC price to match frontend
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
    
    // Get COMPUTE price
    let compute_price = 0.0001268; // Default COMPUTE price
    try {
      // Try to get COMPUTE price from DexScreener
      const compute_mint = "B1N1HcMm4RysYz4smsXwmk2UnS8NziqKCM6Ho8i62vXo";
      const meteora_pool_id = "HN7ibjiyX399d1EfYXcWaSHZRSMfUmonYvXGFXG41Rr3";
      
      // First try to get price from Meteora pool
      const meteora_response = await fetch(`https://api.dexscreener.com/latest/dex/pools/solana/${meteora_pool_id}`);
      const meteora_data = await meteora_response.json();
      
      if (meteora_data.pairs && meteora_data.pairs.length > 0) {
        const compute_pair = meteora_data.pairs[0];
        if (compute_pair && compute_pair.priceUsd) {
          compute_price = parseFloat(compute_pair.priceUsd);
          console.log(`COMPUTE price from Meteora pool: ${compute_price}`);
        }
      }
    } catch (error) {
      console.error('Error fetching COMPUTE price:', error);
    }
    
    // Update investments with calculated returns
    const investmentsWithReturns = investments.map(investment => {
      // Always calculate returns for all investments
      if (profitShare > 0) {
        const calculatedReturns = calculateReturns(
          investment, 
          totalInvestmentValue, 
          profitShare,
          ubcPrice
        );
        
        console.log(`Calculated UBC return for investment ${investment.investmentId}: ${calculatedReturns.ubcReturn} UBC (${calculatedReturns.return} USDC / ${ubcPrice} UBC price)`);
        
        // If no redistribution data, use calculated values
        if (investment.ubcReturn === undefined) {
          return {
            ...investment,
            return: calculatedReturns.return,
            ubcReturn: calculatedReturns.ubcReturn,
            isCalculated: true // Flag to indicate this is a calculated value
          };
        } else {
          // If redistribution data exists, keep it but add the isCalculated flag as false
          return {
            ...investment,
            isCalculated: false
          };
        }
      }
      
      return investment;
    });
    
    // Add debugging information
    console.log(`Investments with returns: ${investmentsWithReturns.length}`);
    console.log(`Investments with calculated returns: ${investmentsWithReturns.filter(inv => inv.isCalculated).length}`);
    console.log(`Investments with undefined ubcReturn: ${investmentsWithReturns.filter(inv => inv.ubcReturn === undefined).length}`);

    // Log a sample investment with calculated returns
    const sampleCalculated = investmentsWithReturns.find(inv => inv.isCalculated);
    if (sampleCalculated) {
      console.log('Sample calculated investment:', {
        id: sampleCalculated.investmentId,
        ubcReturn: sampleCalculated.ubcReturn,
        return: sampleCalculated.return,
        isCalculated: sampleCalculated.isCalculated
      });
    }
    
    console.log(`Returning ${investmentsWithReturns.length} investments`);
    res.status(200).json(investmentsWithReturns);
  } catch (error) {
    console.error('Error fetching investments:', error);
    res.status(500).json({ error: 'Failed to fetch investments' });
  }
}
