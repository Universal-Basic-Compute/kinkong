import { getTable } from '../airtable/tables';

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
  liquidity?: number;
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
    if (tokenIdentifier.length < 32) {
      const tokensTable = getTable('TOKENS');
      const records = await tokensTable
        .select({
          filterByFormula: `{name} = '${tokenIdentifier}'`
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
    
    const response = await fetch(`${DEXSCREENER_API}/${mint}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch token prices: ${response.status}`);
    }

    const data = await response.json();
    console.log('DexScreener response:', data);

    if (data.pairs) {
      // Create price map from DexScreener response
      for (const pair of data.pairs) {
        if (pair.baseToken && pair.baseToken.address.toLowerCase() === mint.toLowerCase()) {
          const price = Number(pair.priceUsd) || 0;
          console.log(`Found price for ${tokenIdentifier}: $${price}`);
          return price;
        }
      }
    }

    console.warn(`No suitable pairs found for ${tokenIdentifier}`);
    return null;

  } catch (error) {
    console.error(`Failed to fetch price for ${tokenIdentifier}:`, error);
    return null;
  }
}
