import { getTable } from '../airtable/tables';
import type { Portfolio, Trade } from '../airtable/tables';

export async function getCurrentPortfolio(): Promise<Portfolio[]> {
  const table = getTable('PORTFOLIO');
  const records = await table.select().all();
  
  return records.map(r => ({
    token: r.get('token') as string,
    allocation: r.get('allocation') as number,
    lastUpdate: r.get('lastUpdate') as string
  }));
}

export async function calculateTrades(portfolio: Portfolio[]): Promise<Trade[]> {
  const trades: Trade[] = [];
  // TODO: Implement trading logic
  return trades;
}
