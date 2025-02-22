import { Connection, PublicKey } from '@solana/web3.js';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { getTable } from '../backend/src/airtable/tables';

interface TokenBalance {
  token: string;
  mint: string;
  amount: number;
  price: number;
  value: number;
  timestamp: string;
}

interface BirdeyeResponse {
  success: boolean;
  data: {
    owner: string;
    tokenBalance: number;
    tokenValue: number;
    price: number;
  };
}

async function getTokenBalance(wallet: string, tokenMint: string): Promise<BirdeyeResponse> {
  const url = `https://public-api.birdeye.so/v1/wallet/token_balance?wallet=${wallet}&token_address=${tokenMint}`;
  
  const response = await fetch(url, {
    headers: {
      'x-api-key': process.env.BIRDEYE_API_KEY || '',
      'x-chain': 'solana',
      'accept': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Birdeye API error: ${response.status}`);
  }

  return await response.json();
}

async function recordWalletSnapshot(wallet: string) {
  try {
    console.log(`📸 Taking snapshot of KinKong wallet...`);

    // Get active tokens from Airtable
    const tokensTable = getTable('TOKENS');
    const tokens = await tokensTable.select({
      filterByFormula: '{isActive} = 1'
    }).all();

    console.log(`Found ${tokens.length} active tokens to check`);

    // Get balance for each token
    const balances: TokenBalance[] = [];
    const timestamp = new Date().toISOString();

    for (const token of tokens) {
      try {
        const mint = token.get('mint') as string;
        const response = await getTokenBalance(wallet, mint);

        if (response.success && response.data) {
          balances.push({
            token: token.get('token') as string,
            mint,
            amount: response.data.tokenBalance,
            price: response.data.price,
            value: response.data.tokenValue,
            timestamp
          });
        }
      } catch (error) {
        console.error(`Error getting balance for ${token.get('token')}:`, error);
      }
    }

    // Calculate total value
    const totalValue = balances.reduce((sum, b) => sum + b.value, 0);

    // Record snapshot in Airtable
    const snapshotsTable = getTable('WALLET_SNAPSHOTS');
    await snapshotsTable.create([{
      fields: {
        timestamp,
        totalValue,
        holdings: JSON.stringify(balances.map(b => ({
          token: b.token,
          amount: b.amount,
          price: b.price,
          value: b.value
        })))
      }
    }]);

    console.log(`✅ Wallet snapshot recorded with value: $${totalValue.toFixed(2)}`);
    console.log('Holdings:', balances.map(b => 
      `${b.token}: ${b.amount.toFixed(2)} ($${b.value.toFixed(2)})`
    ));

    return {
      totalValue,
      balances
    };

  } catch (error) {
    console.error('❌ Failed to record wallet snapshot:', error);
    throw error;
  }
}

async function main() {
  try {
    // Load environment variables
    dotenv.config();

    // Verify required environment variables
    if (!process.env.BIRDEYE_API_KEY) {
      throw new Error('BIRDEYE_API_KEY is not defined');
    }

    if (!process.env.KINKONG_WALLET) {
      throw new Error('KINKONG_WALLET is not defined');
    }

    // Take snapshot
    await recordWalletSnapshot(process.env.KINKONG_WALLET);

  } catch (error) {
    console.error('Script failed:', error);
    process.exit(1);
  }
}

// Run the script
main();
