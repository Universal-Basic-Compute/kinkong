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

    const snapshot = {
      timestamp: new Date().toISOString(),
      totalValue,
      holdings: portfolio.map(holding => ({
        token: holding.token,
        amount: holding.allocation,
        price: prices[holding.token] || 0,
        value: holding.allocation * (prices[holding.token] || 0)
      }))
    };

    const table = getTable('PORTFOLIO_SNAPSHOTS');
    await table.create([{ fields: snapshot }]);

    return snapshot;
  } catch (error) {
    console.error('Failed to record portfolio snapshot:', error);
    throw error;
  }
}
