import { getTable } from '../airtable/tables';
import type { Token } from '../airtable/tables';

export async function getJupiterData(): Promise<Partial<Token>[]> {
  const table = getTable('TOKENS');
  const records = await table.select().all();
  
  const tokens: Partial<Token>[] = [];
  
  for (const record of records) {
    const mint = record.get('mint') as string;
    
    try {
      const response = await fetch(`https://price.jup.ag/v4/price?ids=${mint}`);
      const data = await response.json();
      
      tokens.push({
        token: record.get('token') as string,
        mint,
        liquidity: data.data[mint]?.liquidity || 0
      });
      
      // Add delay between requests
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`Error fetching Jupiter data for ${mint}:`, error);
    }
  }
  
  return tokens;
}

export async function jupiterTrade(trade: any) {
  // TODO: Implement Jupiter trade execution
  return {};
}
