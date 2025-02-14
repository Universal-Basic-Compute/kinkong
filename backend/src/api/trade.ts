import { getCurrentPortfolio, calculateTrades } from '../strategy/portfolio';
import { executeTrades, updateTradeHistory } from '../strategy/trading';

export default async function handler(req: any, res: any) {
  try {
    // Get current portfolio
    const portfolio = await getCurrentPortfolio();
    
    // Calculate needed trades
    const trades = await calculateTrades(portfolio);
    
    // Execute trades
    const results = await executeTrades(trades);
    
    // Update Airtable
    await updateTradeHistory(results);
    
    res.status(200).json({ success: true, trades: results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
