import { getTable } from '../airtable/tables';
import { jupiterTrade } from '../collectors/jupiter';
import type { Trade } from '../airtable/tables';

export async function executeTrades(trades: Trade[]) {
  const results = [];
  
  for (const trade of trades) {
    try {
      const result = await jupiterTrade(trade);
      results.push(result);
    } catch (error) {
      console.error(`Trade failed: ${error.message}`);
    }
  }
  
  return results;
}

export async function updateTradeHistory(results: any[]) {
  const table = getTable('TRADES');
  // TODO: Implement trade history updates
}
