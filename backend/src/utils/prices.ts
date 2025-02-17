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

async function fetchWithRetry(url: string, retries = 3, delay = 1000): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'KinKong Portfolio Manager'
        }
      });
      
      if (response.ok) {
        return response;
      }
      
      console.warn(`Attempt ${i + 1}/${retries} failed with status ${response.status}`);
      
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
      }
    } catch (error) {
      console.warn(`Attempt ${i + 1}/${retries} failed:`, error);
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
      }
    }
  }
  
  throw new Error(`Failed to fetch after ${retries} attempts`);
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
      console.log('Fetching SOL price from DexScreener (with retries)...');
      const response = await fetchWithRetry(
        'https://api.dexscreener.com/latest/dex/pairs/solana/HyZzKxEQ7GqHF8upZNQHV5CTd1TZx6CvPxHkRVTtRxaD'  // Using a known SOL/USDC pair
      );

      const data: DexScreenerResponse = await response.json();
      if (!data.pairs?.[0]) {
        throw new Error('Could not find valid SOL/USDC pair');
      }

      const price = parseFloat(data.pairs[0].priceUsd);
      console.log(`Found SOL price: $${price}`);
      return price;
    }
    
    // For other tokens, search by pairs
    console.log(`Fetching price from DexScreener for mint: ${mint} (with retries)...`);
    const response = await fetchWithRetry(
      `https://api.dexscreener.com/latest/dex/pairs/solana/${mint}`  // Using Solana-specific endpoint
    );

    const data: DexScreenerResponse = await response.json();
    
    if (!data.pairs?.length) {
      console.warn(`No pairs found for mint ${mint}`);
      return null;
    }

    // Try to find the best pair in this order: USDC > USDT > SOL
    let pair = data.pairs.find(p => p.quoteToken.symbol === 'USDC');
    if (pair) {
      const price = parseFloat(pair.priceUsd);
      console.log(`Found USDC pair price for ${mint}: $${price}`);
      return price;
    }

    pair = solanaPairs.find(p => p.quoteToken.symbol === 'USDT');
    if (pair) {
      const price = parseFloat(pair.priceUsd);
      console.log(`Found USDT pair price for ${mint}: $${price}`);
      return price;
    }

    pair = solanaPairs.find(p => p.quoteToken.symbol === 'SOL');
    if (pair) {
      const solPrice = await getTokenPrice('So11111111111111111111111111111111111111112');
      if (!solPrice) {
        throw new Error('Could not get SOL price for conversion');
      }

      const price = parseFloat(pair.priceUsd) * solPrice;
      console.log(`Found SOL pair price for ${mint}: ${pair.priceUsd} SOL * $${solPrice} = $${price}`);
      return price;
    }

    console.warn(`No suitable pairs found for mint ${mint}`);
    return null;
  } catch (error) {
    console.error(`Failed to fetch price for mint ${mint}:`, error);
    return null;
  }
}
