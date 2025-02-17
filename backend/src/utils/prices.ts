const DEXSCREENER_API = 'https://api.dexscreener.com/latest/dex/tokens';

interface DexScreenerPair {
  baseToken: {
    address: string;
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

    console.log('Fetching prices from DexScreener for mint:', mint);
    
    const response = await fetch(`${DEXSCREENER_API}/${mint}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch token prices: ${response.status}`);
    }

    const data = await response.json();
    console.log('DexScreener response:', data);

    if (data.pairs) {
      // Try to find the best pair in this order: USDC > USDT > SOL
      const usdcPair = data.pairs.find(p => p.quoteToken.symbol === 'USDC');
      if (usdcPair) {
        const price = Number(usdcPair.priceUsd);
        console.log(`Found USDC pair price: $${price}`);
        return price;
      }

      const usdtPair = data.pairs.find(p => p.quoteToken.symbol === 'USDT');
      if (usdtPair) {
        const price = Number(usdtPair.priceUsd);
        console.log(`Found USDT pair price: $${price}`);
        return price;
      }

      const solPair = data.pairs.find(p => p.quoteToken.symbol === 'SOL');
      if (solPair) {
        // Get SOL price first
        const solPrice = await getTokenPrice('So11111111111111111111111111111111111111112');
        if (!solPrice) {
          throw new Error('Could not get SOL price for conversion');
        }
        const price = Number(solPair.priceUsd) * solPrice;
        console.log(`Found SOL pair price: ${solPair.priceUsd} SOL * $${solPrice} = $${price}`);
        return price;
      }
    }

    console.warn(`No suitable pairs found for mint ${mint}`);
    return null;

  } catch (error) {
    console.error(`Failed to fetch price for mint ${mint}:`, error);
    return null;
  }
}
