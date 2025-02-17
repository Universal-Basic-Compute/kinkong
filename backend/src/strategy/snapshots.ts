import { getTable } from '../airtable/tables';
import { getCurrentPortfolio } from './portfolio';
import { getTokenPrices } from '../utils/jupiter';

export async function recordPortfolioSnapshot() {
  try {
    const portfolio = await getCurrentPortfolio();
    const prices = await getTokenPrices(portfolio.map(p => p.token));

    const totalValue = portfolio.reduce((sum, holding) => {
      const price = prices[holding.token] || 0;
      return sum + (holding.allocation * price);
    }, 0);

    // Format holdings as a string for Airtable
    const holdingsString = JSON.stringify(portfolio.map(holding => ({
      token: holding.token,
      amount: holding.allocation,
      price: prices[holding.token] || 0,
      value: holding.allocation * (prices[holding.token] || 0)
    })));

    const snapshot = {
      createdAt: new Date().toISOString(),
      totalValue,
      holdingsJson: holdingsString // Store as JSON string in Airtable
    };

    const table = getTable('PORTFOLIO_SNAPSHOTS');
    await table.create([
      {
        fields: {
          createdAt: snapshot.createdAt,
          totalValue: snapshot.totalValue,
          holdingsJson: snapshot.holdingsJson
        }
      }
    ]);

    return snapshot;
  } catch (error) {
    console.error('Failed to record portfolio snapshot:', error);
    throw error;
  }
}
