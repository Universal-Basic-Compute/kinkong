import { getTokenPrice } from '@/backend/src/utils/prices';

interface TokenMetrics {
  token: string;  // Changed from symbol if present
  price: {
    current: number;
    high24h: number;
    low24h: number;
    change24h: number;
  };
  volume: {
    amount24h: number;
    previousDay: number;
    buyVsSell: number;
  };
  liquidity: {
    current: number;
    depth: {
      buy2percent: number;
      sell2percent: number;
    };
  };
}

interface HistoricalData {
  highPrice: number;
  lowPrice: number;
  openPrice: number;
  volume24h: number;
  previousDayVolume: number;
  buyVolume: number;
  sellVolume: number;
}

async function get24hHistoricalData(token: string): Promise<HistoricalData> {
  // For now, return default values until we implement the actual data fetching
  return {
    highPrice: 0,
    lowPrice: 0,
    openPrice: 0,
    volume24h: 0,
    previousDayVolume: 0,
    buyVolume: 0,
    sellVolume: 0
  };
}

export async function getTokenMetrics(token: string): Promise<TokenMetrics> {
  // Get current price and 24h historical data
  const currentPrice = await getTokenPrice(token);
  const historicalData = await get24hHistoricalData(token);
  
  // Extract price metrics
  const priceMetrics = {
    current: currentPrice || 0, // Default to 0 if null
    high24h: historicalData.highPrice,
    low24h: historicalData.lowPrice,
    change24h: currentPrice 
      ? ((currentPrice - historicalData.openPrice) / historicalData.openPrice) * 100 
      : 0 // Default to 0 if currentPrice is null
  };
  
  // Get volume data
  const volumeMetrics = {
    amount24h: historicalData.volume24h,
    previousDay: historicalData.previousDayVolume,
    buyVsSell: historicalData.buyVolume / historicalData.sellVolume
  };
  
  // Get liquidity data
  const liquidityMetrics = await getLiquidityMetrics(token);
  
  return {
    price: priceMetrics,
    volume: volumeMetrics,
    liquidity: liquidityMetrics
  };
}

async function getLiquidityMetrics(token: string) {
  // Fetch liquidity metrics
  // Implementation will depend on your DEX data source
  return {
    current: 0, // Total liquidity
    depth: {
      buy2percent: 0,  // Liquidity within 2% above current price
      sell2percent: 0  // Liquidity within 2% below current price
    }
  };
}
