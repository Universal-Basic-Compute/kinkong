interface DexScreenerPair {
  baseToken: {
    symbol: string;
  };
  quoteToken: {
    symbol: string;
  };
  priceUsd: string;
}

interface DexScreenerResponse {
  pairs?: DexScreenerPair[];
}

export async function getTokenPrice(symbol: string): Promise<number | null> {
  try {
    // Skip price fetch for stables
    if (['USDC', 'USDT'].includes(symbol)) {
      return 1;
    }
    
    const response = await fetch(
      `https://api.dexscreener.com/latest/dex/search?q=${symbol}`
    );
    
    if (!response.ok) {
      throw new Error('Failed to fetch price from DexScreener');
    }

    const data: DexScreenerResponse = await response.json();
    
    // Get the first pair with USDC or USDT
    const pair = data.pairs?.find((p: DexScreenerPair) => 
      p.baseToken.symbol.toUpperCase() === symbol.toUpperCase() &&
      ['USDC', 'USDT'].includes(p.quoteToken.symbol)
    );

    return pair ? parseFloat(pair.priceUsd) : null;
  } catch (error) {
    console.error(`Failed to fetch price for ${symbol}:`, error);
    return null;
  }
}
