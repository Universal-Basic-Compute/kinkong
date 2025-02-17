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

    // If it's SOL, get SOL/USDC price directly
    if (mint === 'So11111111111111111111111111111111111111112') {
      console.log('Fetching SOL price from DexScreener');
      const response = await fetch(
        'https://api.dexscreener.com/latest/dex/tokens/solana/So11111111111111111111111111111111111111112'
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch SOL price from DexScreener');
      }

      const data: DexScreenerResponse = await response.json();
      const solPair = data.pairs?.find(p => ['USDC', 'USDT'].includes(p.quoteToken.symbol));
      if (!solPair) {
        throw new Error('Could not find SOL/USDC pair');
      }

      return parseFloat(solPair.priceUsd);
    }
    
    // For other tokens, get token/SOL price and calculate USD value
    console.log(`Fetching price from DexScreener for mint: ${mint}`);
    const response = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/solana/${mint}`
    );
    
    if (!response.ok) {
      throw new Error('Failed to fetch price from DexScreener');
    }

    const data: DexScreenerResponse = await response.json();
    
    // Get the SOL pair
    const pair = data.pairs?.find((p: DexScreenerPair) => 
      p.quoteToken.symbol === 'SOL'
    );

    if (pair) {
      // Get SOL price
      const solPrice = await getTokenPrice('So11111111111111111111111111111111111111112');
      if (!solPrice) {
        throw new Error('Could not get SOL price for conversion');
      }

      // Calculate USD price: tokenPrice (in SOL) * SOL price (in USD)
      const usdPrice = parseFloat(pair.priceUsd) * solPrice;
      console.log(`Found price for mint ${mint}: ${usdPrice} USD (${pair.priceUsd} SOL * ${solPrice} USD/SOL)`);
      return usdPrice;
    }

    console.warn(`No SOL pair found for mint ${mint}`);
    return null;
  } catch (error) {
    console.error(`Failed to fetch price for mint ${mint}:`, error);
    return null;
  }
}
