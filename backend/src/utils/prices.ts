const DEXSCREENER_API = 'https://api.dexscreener.com/latest/dex';

interface DexScreenerPair {
  baseToken: {
    address: string;
    symbol: string;
  };
  quoteToken: {
    symbol: string;
  };
  priceUsd: string;
  liquidity?: number;
}

interface DexScreenerResponse {
  pairs?: DexScreenerPair[];
}

export async function getTokenPrice(tokenIdentifier: string): Promise<number | null> {
  try {
    // Skip price fetch for stables
    if (tokenIdentifier === 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' || // USDC
        tokenIdentifier === 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB') { // USDT
      return 1;
    }

    // If it's a symbol rather than a mint, try to get the mint from Airtable
    let mint = tokenIdentifier;
    if (tokenIdentifier.length < 32) { // If it's not a mint address
      const tokensTable = getTable('TOKENS');
      const records = await tokensTable
        .select({
          filterByFormula: `{symbol} = '${tokenIdentifier}'`
        })
        .firstPage();

      if (records.length > 0) {
        mint = records[0].get('mint') as string;
        console.log(`Found mint ${mint} for token ${tokenIdentifier}`);
      } else {
        console.warn(`No mint found for token ${tokenIdentifier}`);
        return null;
      }
    }

    console.log(`Fetching prices from DexScreener for mint: ${mint}`);
    
    const response = await fetch(`${DEXSCREENER_API}/solana/${mint}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch token prices: ${response.status}`);
    }

    const data = await response.json();
    console.log('DexScreener response:', data);

    if (data.pairs?.length > 0) {
      // Try to find the best pair in this order: USDC > USDT > SOL
      const usdcPair = data.pairs.find((p: DexScreenerPair) => p.quoteToken.symbol === 'USDC');
      if (usdcPair) {
        const price = Number(usdcPair.priceUsd);
        console.log(`Found USDC pair price for ${tokenIdentifier}: $${price}`);
        return price;
      }

      const usdtPair = data.pairs.find((p: DexScreenerPair) => p.quoteToken.symbol === 'USDT');
      if (usdtPair) {
        const price = Number(usdtPair.priceUsd);
        console.log(`Found USDT pair price for ${tokenIdentifier}: $${price}`);
        return price;
      }

      const solPair = data.pairs.find((p: DexScreenerPair) => p.quoteToken.symbol === 'SOL');
      if (solPair) {
        // Get SOL price first
        const solPrice = await getTokenPrice('So11111111111111111111111111111111111111112');
        if (!solPrice) {
          throw new Error('Could not get SOL price for conversion');
        }
        const price = Number(solPair.priceUsd) * solPrice;
        console.log(`Found SOL pair price for ${tokenIdentifier}: ${solPair.priceUsd} SOL * $${solPrice} = $${price}`);
        return price;
      }
    }

    console.warn(`No suitable pairs found for ${tokenIdentifier}`);
    return null;

  } catch (error) {
    console.error(`Failed to fetch price for ${tokenIdentifier}:`, error);
    return null;
  }
}
