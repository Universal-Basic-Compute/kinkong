import { getTable } from '../airtable/tables';
import { getCurrentPortfolio } from './portfolio';
import { getTokenPrices } from '../utils/jupiter';

export async function recordPortfolioSnapshot() {
  try {
    console.log('Starting portfolio snapshot recording...');
    
    // Get current portfolio
    console.log('Fetching current portfolio...');
    const portfolio = await getCurrentPortfolio();
    console.log('Current portfolio:', portfolio);
    
    // Get token prices
    console.log('Fetching token prices...');
    const prices = await getTokenPrices(portfolio.map(p => p.token));
    console.log('Token prices:', prices);

    // Calculate total value
    const totalValue = portfolio.reduce((sum, holding) => {
      const price = prices[holding.token] || 0;
      const value = holding.allocation * price;
      console.log(`Calculating value for ${holding.token}:`, {
        allocation: holding.allocation,
        price,
        value
      });
      return sum + value;
    }, 0);
    console.log('Total portfolio value:', totalValue);

    // Format holdings
    const holdingsString = JSON.stringify(portfolio.map(holding => ({
      token: holding.token,
      amount: holding.allocation,
      price: prices[holding.token] || 0,
      value: holding.allocation * (prices[holding.token] || 0)
    })));
    console.log('Formatted holdings:', holdingsString);

    // Create snapshot record
    const snapshot = {
      createdAt: new Date().toISOString(),
      totalValue,
      holdingsJson: holdingsString // Store as JSON string in Airtable
    };
    console.log('Creating snapshot record:', snapshot);

    // Save to Airtable
    const table = getTable('PORTFOLIO_SNAPSHOTS');
    console.log('Got Airtable table reference');
    
    const result = await table.create([
      {
        fields: {
          createdAt: snapshot.createdAt,
          totalValue: snapshot.totalValue,
          holdingsJson: snapshot.holdingsJson
        }
      }
    ]);
    console.log('Created Airtable record:', result);

    return snapshot;
  } catch (error) {
    console.error('Failed to record portfolio snapshot:', error);
    throw error;
  }
}
