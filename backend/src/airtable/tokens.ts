import { getTable } from './tables';

export interface TokenData {
  token: string;
  price: number;
  price7dAvg: number;
  volume24h: number;
  volumeOnUpDay: boolean;
  priceChange24h: number;
  mint: string;
  isActive: boolean;
}

export async function getTokenData(): Promise<TokenData[]> {
  try {
    const table = getTable('TOKENS');
    const records = await table
      .select({
        filterByFormula: '{isActive} = 1'
      })
      .all();

    return records.map(record => ({
      token: record.get('token') as string,
      price: record.get('price') as number || 0,
      price7dAvg: record.get('price7dAvg') as number || 0,
      volume24h: record.get('volume24h') as number || 0,
      volumeOnUpDay: record.get('priceChange24h') as number > 0,
      priceChange24h: record.get('priceChange24h') as number || 0,
      mint: record.get('mint') as string,
      isActive: record.get('isActive') as boolean || false
    }));

  } catch (error) {
    console.error('Failed to fetch token data:', error);
    throw error;
  }
}
