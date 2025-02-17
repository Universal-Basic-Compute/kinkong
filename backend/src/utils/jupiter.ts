const JUPITER_PRICE_API = 'https://price.jup.ag/v4/price';

interface JupiterPriceResponse {
  data: {
    id: string;
    mintSymbol: string;
    vsToken: string;
    vsTokenSymbol: string;
    price: number;
  }
}

interface JupiterQuoteParams {
  inputMint: string;
  outputMint: string;
  amount: number;
  slippageBps: number;
}

export async function getJupiterQuote(params: JupiterQuoteParams) {
  try {
    const response = await fetch(`https://quote-api.jup.ag/v4/quote?inputMint=${params.inputMint}&outputMint=${params.outputMint}&amount=${params.amount}&slippageBps=${params.slippageBps}`);
    if (!response.ok) {
      throw new Error('Failed to get Jupiter quote');
    }
    return await response.json();
  } catch (error) {
    console.error('Failed to get Jupiter quote:', error);
    return null;
  }
}

interface JupiterTransactionParams {
  route: any; // Replace with proper type from Jupiter API
  userPublicKey: PublicKey;
}

export async function postJupiterTransaction(params: JupiterTransactionParams) {
  try {
    const response = await fetch('https://quote-api.jup.ag/v4/swap', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        route: params.route,
        userPublicKey: params.userPublicKey.toString()
      })
    });
    if (!response.ok) {
      throw new Error('Failed to create Jupiter transaction');
    }
    return await response.json();
  } catch (error) {
    console.error('Failed to create Jupiter transaction:', error);
    throw error;
  }
}

export async function getTokenPrice(mint: string): Promise<number | null> {
  try {
    const response = await fetch(`${JUPITER_PRICE_API}?ids=${mint}&vsToken=USDC`);
    if (!response.ok) {
      throw new Error('Failed to fetch price from Jupiter');
    }
    
    const data: JupiterPriceResponse = await response.json();
    return data.data.price;
  } catch (error) {
    console.error(`Failed to fetch price for token ${mint}:`, error);
    return null;
  }
}

export async function getTokenPrices(mints: string[]): Promise<Record<string, number>> {
  try {
    const mintsParam = mints.join(',');
    const response = await fetch(`${JUPITER_PRICE_API}?ids=${mintsParam}&vsToken=USDC`);
    if (!response.ok) {
      throw new Error('Failed to fetch prices from Jupiter');
    }
    
    const data = await response.json();
    const prices: Record<string, number> = {};
    
    for (const mint of mints) {
      if (data.data[mint]) {
        prices[mint] = data.data[mint].price;
      }
    }
    
    return prices;
  } catch (error) {
    console.error('Failed to fetch token prices:', error);
    return {};
  }
}
