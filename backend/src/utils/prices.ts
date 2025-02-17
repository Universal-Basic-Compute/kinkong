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

export async function getTokenPrice(mint: string): Promise<number | null> {
  try {
    // Skip price fetch for stables
    if (mint === 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' || // USDC
        mint === 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB') { // USDT
      return 1;
    }
    
    console.log(`Fetching price from DexScreener for mint: ${mint}`);
    const response = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/solana/${mint}`
    );
    
    if (!response.ok) {
      throw new Error('Failed to fetch price from DexScreener');
    }

    const data: DexScreenerResponse = await response.json();
    
    // Get the first pair with USDC or USDT
    const pair = data.pairs?.find((p: DexScreenerPair) => 
      ['USDC', 'USDT'].includes(p.quoteToken.symbol)
    );

    if (pair) {
      console.log(`Found price for mint ${mint}: ${pair.priceUsd}`);
    }

    return pair ? parseFloat(pair.priceUsd) : null;
  } catch (error) {
    console.error(`Failed to fetch price for mint ${mint}:`, error);
    return null;
  }
}
