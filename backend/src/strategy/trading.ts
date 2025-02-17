import { getTable } from '../airtable/tables';
import type { Trade } from '../airtable/tables';
import { executeJupiterTrade, type TradeParams } from '../utils/trading';

export async function executeTrades(trades: Trade[]) {
  const results = [];
  
  for (const trade of trades) {
    try {
      const params: TradeParams = {
        inputToken: trade.action === 'SELL' ? trade.token : 'USDC',
        outputToken: trade.action === 'BUY' ? trade.token : 'USDC',
        amount: trade.amount
      };
      
      const result = await executeJupiterTrade(params);
      results.push({
        ...trade,
        success: result.success,
        txId: result.txId,
        error: result.error
      });
    } catch (error: unknown) {
      console.error(`Trade failed:`, error);
      results.push({
        ...trade,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
  
  return results;
}

export async function updateTradeHistory(results: any[]) {
  const table = getTable('TRADES');
  
  for (const result of results) {
    if (result.success) {
      await table.create({
        timestamp: new Date().toISOString(),
        token: result.token,
        action: result.action,
        amount: result.amount,
        price: result.price,
        txId: result.txId
      });
    }
  }
}
