import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import { getJupiterQuote, postJupiterTransaction } from './jupiter';
import { TradeParams } from '../types/trading';

interface ExecuteTradeParams {
  inputToken: string;  // Token mint address
  outputToken: string; // Token mint address
  amount: number;      // Amount in input tokens
  slippage: number;    // Slippage tolerance (e.g., 0.01 for 1%)
  wallet: string;      // Wallet public key
}

export async function executeTrade(params: ExecuteTradeParams) {
  try {
    if (!process.env.NEXT_PUBLIC_HELIUS_RPC_URL) {
      throw new Error('RPC URL not configured');
    }

    const connection = new Connection(process.env.NEXT_PUBLIC_HELIUS_RPC_URL);
    
    // 1. Get quote from Jupiter
    const quote = await getJupiterQuote({
      inputMint: params.inputToken,
      outputMint: params.outputToken,
      amount: params.amount,
      slippageBps: params.slippage * 10000, // Convert to basis points
    });

    if (!quote || !quote.data) {
      throw new Error('Failed to get quote from Jupiter');
    }

    // 2. Create and sign transaction
    const { swapTransaction } = await postJupiterTransaction({
      route: quote.data,
      userPublicKey: new PublicKey(params.wallet),
    });

    // 3. Send transaction to Phantom for signing
    // This will trigger Phantom wallet popup
    const signedTx = await window.solana.signTransaction(
      Transaction.from(Buffer.from(swapTransaction, 'base64'))
    );

    // 4. Execute the signed transaction
    const signature = await connection.sendRawTransaction(
      signedTx.serialize()
    );

    // 5. Wait for confirmation
    const confirmation = await connection.confirmTransaction(signature);

    if (confirmation.value.err) {
      throw new Error(`Transaction failed: ${confirmation.value.err}`);
    }

    return {
      success: true,
      signature,
      inputAmount: params.amount,
      expectedOutputAmount: quote.data.outAmount,
      price: quote.data.price,
    };

  } catch (error) {
    console.error('Trade execution failed:', error);
    throw error;
  }
}
