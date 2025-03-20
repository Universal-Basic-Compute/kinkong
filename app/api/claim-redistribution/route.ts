import { NextRequest, NextResponse } from 'next/server';
import { getTable } from '@/backend/src/airtable/tables';
import { Record } from 'airtable';

// Specify Node.js runtime
export const runtime = 'nodejs';

// Transaction interface
interface Transaction {
  token: string;
  amount: number;
  txSignature: string;
}

// Token mint addresses
const TOKEN_MINTS = {
  UBC: '9psiRdn9cXYVps4F1kFuoNjd2EtmqNJXrCPmRppJpump',
  COMPUTE: 'B1N1HcMm4RysYz4smsXwmk2UnS8NziqKCM6Ho8i62vXo'
};

// Token decimals
const TOKEN_DECIMALS = {
  UBC: 6,
  COMPUTE: 6
};

// Function to execute token transfer with retries
async function executeTokenTransfer(wallet: string, tokenMint: string, amount: number, maxRetries = 3): Promise<string> {
  let retries = 0;
  let lastError: Error | null = null;
  
  // Determine the token symbol from the mint address
  const tokenSymbol = Object.keys(TOKEN_MINTS).find(key => TOKEN_MINTS[key] === tokenMint) || 'UNKNOWN';
  
  // Get the correct decimals for this token
  const decimals = TOKEN_DECIMALS[tokenSymbol] || 9;
  
  while (retries < maxRetries) {
    try {
      // Instead of using the API route, let's directly use the token transfer logic
      console.log(`Executing direct token transfer (attempt ${retries + 1}/${maxRetries}): ${amount} of ${tokenMint} to ${wallet} with ${decimals} decimals`);
      
      // Import the required modules
      const { Connection, Keypair, PublicKey, Transaction, sendAndConfirmTransaction } = require('@solana/web3.js');
      const { createTransferInstruction, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction } = require('@solana/spl-token');
      const bs58 = require('bs58');
      
      // Load private key from environment variable
      const privateKeyString = process.env.STRATEGY_WALLET_PRIVATE_KEY || process.env.KINKONG_WALLET_PRIVATE_KEY;
      if (!privateKeyString) {
        throw new Error('Wallet private key not configured');
      }
      
      // Decode private key
      let sourceWalletKeypair;
      try {
        const privateKey = bs58.decode(privateKeyString);
        sourceWalletKeypair = Keypair.fromSecretKey(new Uint8Array(privateKey));
        console.log(`Source wallet: ${sourceWalletKeypair.publicKey.toString()}`);
      } catch (error) {
        console.error('Error decoding private key:', error);
        throw new Error('Invalid wallet private key format');
      }
      
      // Connect to Solana network
      const heliusRpcUrl = process.env.NEXT_PUBLIC_HELIUS_RPC_URL || process.env.HELIUS_RPC_URL;
      if (!heliusRpcUrl) {
        throw new Error('Helius RPC URL not configured');
      }
      
      console.log(`Connecting to RPC: ${heliusRpcUrl.substring(0, 20)}...`);
      const connection = new Connection(heliusRpcUrl, {
        commitment: 'confirmed',
        confirmTransactionInitialTimeout: 60000
      });
      
      // Get token accounts
      const tokenMintPublicKey = new PublicKey(tokenMint);
      const sourceWalletPublicKey = sourceWalletKeypair.publicKey;
      const destinationWalletPublicKey = new PublicKey(wallet);
      
      console.log('Getting associated token addresses...');
      const sourceTokenAccount = await getAssociatedTokenAddress(
        tokenMintPublicKey,
        sourceWalletPublicKey
      );
      
      const destinationTokenAccount = await getAssociatedTokenAddress(
        tokenMintPublicKey,
        destinationWalletPublicKey
      );
      
      console.log(`Source token account: ${sourceTokenAccount.toString()}`);
      console.log(`Destination token account: ${destinationTokenAccount.toString()}`);
      
      // Create transaction
      let transaction = new Transaction();
      
      // Check if destination token account exists
      console.log('Checking if destination token account exists...');
      const accountInfo = await connection.getAccountInfo(destinationTokenAccount);
      if (!accountInfo) {
        console.log('Destination token account does not exist, creating it...');
        // If the account doesn't exist, create it
        transaction.add(
          createAssociatedTokenAccountInstruction(
            sourceWalletPublicKey,
            destinationTokenAccount,
            destinationWalletPublicKey,
            tokenMintPublicKey
          )
        );
      } else {
        console.log('Destination token account exists');
      }
      
      // Calculate amount with decimals
      const amountWithDecimals = Math.round(amount * Math.pow(10, decimals));
      console.log(`Sending ${amount} tokens (${amountWithDecimals} base units with ${decimals} decimals)`);
      
      // Add transfer instruction
      transaction.add(
        createTransferInstruction(
          sourceTokenAccount,
          destinationTokenAccount,
          sourceWalletPublicKey,
          amountWithDecimals
        )
      );
      
      // Get blockhash
      console.log('Getting latest blockhash...');
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
      transaction.recentBlockhash = blockhash;
      transaction.lastValidBlockHeight = lastValidBlockHeight;
      
      // Send transaction
      console.log('Sending transaction...');
      const signature = await sendAndConfirmTransaction(
        connection,
        transaction,
        [sourceWalletKeypair],
        {
          skipPreflight: false,
          preflightCommitment: 'confirmed',
          commitment: 'confirmed',
          maxRetries: 5
        }
      );
      
      console.log(`Transaction successful! Signature: ${signature}`);
      return signature;
    } catch (error) {
      lastError = error as Error;
      retries++;
      
      console.error(`Failed to execute token transfer (attempt ${retries}/${maxRetries}):`, error);
      
      if (retries >= maxRetries) {
        throw new Error(`Token transfer failed after ${maxRetries} attempts: ${lastError.message}`);
      }
      
      // Exponential backoff
      const delay = Math.min(1000 * Math.pow(2, retries), 10000);
      console.log(`Retrying in ${delay/1000} seconds...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw new Error(`Token transfer failed: ${lastError?.message || 'Unknown error'}`);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('Received claim request with body:', body);
    
    const { redistributionId, wallet } = body;

    if (!wallet) {
      console.error('Missing wallet in request');
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      );
    }

    // Get the redistribution record
    const redistributionsTable = getTable('INVESTOR_REDISTRIBUTIONS');
    
    let records;
    let record = null;
    
    // If redistributionId is provided, try to find that specific redistribution first
    if (redistributionId) {
      console.log(`Looking up specific redistribution with ID: ${redistributionId}`);
      try {
        // Look up by the redistributionId field, but also filter by wallet for security
        records = await redistributionsTable.select({
          filterByFormula: `AND({redistributionId} = '${redistributionId}', {wallet} = '${wallet}')`
        }).all();
        
        if (records.length === 0) {
          console.log(`No redistribution found with redistributionId: ${redistributionId} and wallet: ${wallet}, trying record ID lookup`);
          
          // Try looking up by record ID as fallback
          try {
            const recordById = await redistributionsTable.find(redistributionId);
            if (recordById && recordById.get('wallet') === wallet) {
              console.log(`Found redistribution by record ID: ${redistributionId}`);
              records = [recordById];
            } else if (recordById) {
              console.log(`Found redistribution by record ID but wallet doesn't match: ${recordById.get('wallet')} vs ${wallet}`);
            }
          } catch (idError) {
            console.error('Error finding redistribution by record ID:', idError);
          }
        }
        
        if (records && records.length > 0) {
          record = records[0];
        }
      } catch (findError) {
        console.error('Error finding specific redistribution record:', findError);
      }
    }
    
    // If no specific redistribution was found or provided, find the latest unclaimed one for this wallet
    if (!record) {
      console.log(`Looking up latest unclaimed redistribution for wallet: ${wallet}`);
      try {
        // Look up all unclaimed redistributions for this wallet, sorted by date (newest first)
        records = await redistributionsTable.select({
          filterByFormula: `AND({wallet} = '${wallet}', NOT({claimed}))`,
          sort: [{ field: 'createdAt', direction: 'desc' }]
        }).all();
        
        if (records.length === 0) {
          console.error(`No unclaimed redistributions found for wallet: ${wallet}`);
          return NextResponse.json(
            { error: 'No unclaimed redistributions found for this wallet' },
            { status: 404 }
          );
        }
        
        // Use the most recent unclaimed redistribution
        record = records[0];
        if (!record) {
          console.error(`No unclaimed redistributions found for wallet: ${wallet}`);
          return NextResponse.json(
            { error: 'No unclaimed redistributions found for this wallet' },
            { status: 404 }
          );
        }
        
        console.log(`Found latest unclaimed redistribution for wallet: ${wallet}, ID: ${(record as any).id}`);
      } catch (findError) {
        console.error('Error finding redistributions for wallet:', findError);
        return NextResponse.json(
          { error: 'Failed to find redistributions', details: (findError as Error).message },
          { status: 500 }
        );
      }
    }
    
    // At this point, record is guaranteed to be non-null
    // TypeScript needs this assertion with the correct type
    const nonNullRecord = record as unknown as Record<any>;
    
    // Log record details for debugging
    console.log('Found redistribution record:', {
      id: nonNullRecord.id,
      redistributionId: nonNullRecord.get('redistributionId'),
      wallet: nonNullRecord.get('wallet'),
      claimed: nonNullRecord.get('claimed'),
      fields: Object.keys(nonNullRecord.fields)
    });

    // Get the wallet from the record - this is the wallet that will receive the tokens
    const recordWallet = nonNullRecord.get('wallet');

    // Check if already claimed
    const claimed = nonNullRecord.get('claimed');
    if (claimed) {
      return NextResponse.json(
        { error: 'Redistribution already claimed' },
        { status: 400 }
      );
    }
    
    // Double-check that the requesting wallet matches the record wallet
    if (wallet.toLowerCase() !== recordWallet.toLowerCase()) {
      console.error('Wallet mismatch:', {
        requestWallet: wallet,
        recordWallet
      });
      return NextResponse.json(
        { error: 'Wallet does not match redistribution record' },
        { status: 403 }
      );
    }
    
    // At this point, we have a valid redistribution that is not claimed
    // and the requesting wallet matches the record wallet
    console.log(`Proceeding with claim for wallet: ${recordWallet}`);

    // Get the reward amounts
    const token = nonNullRecord.get('token') || 'UBC'; // Get the token type
    const amount = parseFloat(nonNullRecord.get('amount') || '0'); // Get the amount

    // Set the appropriate token amount based on the token type
    let ubcAmount = 0;
    let computeAmount = 0;

    if (token.toUpperCase() === 'UBC') {
      ubcAmount = amount;
    } else if (token.toUpperCase() === 'COMPUTE') {
      computeAmount = amount;
    }

    console.log('Reward amounts:', {
      token,
      amount,
      ubcAmount,
      computeAmount
    });

    if (amount <= 0) {
      return NextResponse.json(
        { error: 'No rewards to claim' },
        { status: 400 }
      );
    }
    
    // Execute token transfers - use recordWallet, not the wallet from request
    const transactions: Transaction[] = [];
    let transferError: string | null = null;
    
    try {
      // Transfer UBC if applicable
      if (ubcAmount > 0) {
        const ubcTxSignature = await executeTokenTransfer(recordWallet, TOKEN_MINTS.UBC, ubcAmount);
        transactions.push({
          token: 'UBC',
          amount: ubcAmount,
          txSignature: ubcTxSignature
        });
      }
      
      // Transfer COMPUTE if applicable
      if (computeAmount > 0) {
        const computeTxSignature = await executeTokenTransfer(recordWallet, TOKEN_MINTS.COMPUTE, computeAmount);
        transactions.push({
          token: 'COMPUTE',
          amount: computeAmount,
          txSignature: computeTxSignature
        });
      }
    } catch (error) {
      console.error('Error during token transfer:', error);
      transferError = (error as Error).message;
      
      // Continue with the process even if transfer fails
      // We'll mark it for manual review
    }
    
    // Update the record based on transfer results
    if (transferError) {
      // If transfer failed, mark for manual processing
      await redistributionsTable.update(nonNullRecord.id, {
        status: 'MANUAL_REVIEW_NEEDED',
        claimedAt: new Date().toISOString(),
        notes: `Automatic transfer failed: ${transferError}. Amounts: ${ubcAmount} UBC, ${computeAmount} COMPUTE to wallet ${recordWallet}`
      });
      
      // Send notification about failed transfer
      try {
        const botToken = "7728404959:AAHoVX05vxCQgzxqAJa5Em8i5HCLs2hJleo";
        const chatId = "-4680349356"; // Chat ID for claims
        
        const message = `❌ <b>Automatic Transfer Failed</b>\n\nFailed to transfer tokens to wallet <code>${recordWallet}</code>.\n\nAmounts:\n- UBC: ${ubcAmount}\n- COMPUTE: ${computeAmount}\n\nError: <code>${transferError}</code>\n\nRedistribution ID: <code>${redistributionId}</code>\n\nPlease process this claim manually.`;
        
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chat_id: chatId,
            text: message,
            parse_mode: 'HTML'
          }),
        });
      } catch (notifyError) {
        console.error('Failed to send notification:', notifyError);
      }
      
      return NextResponse.json({
        success: false,
        message: 'There was an issue processing your claim automatically. Our team has been notified and will process it manually within 24 hours.',
        status: 'PENDING_MANUAL_REVIEW',
        error: transferError
      });
    } else {
      // If transfer succeeded, mark as claimed
      await redistributionsTable.update(nonNullRecord.id, {
        claimed: true,
        claimedAt: new Date().toISOString(),
        status: 'COMPLETED',
        notes: `Automatic transfer completed. Transactions: ${JSON.stringify(transactions)}`
      });
      
      // Send notification about successful transfer
      try {
        const botToken = "7728404959:AAHoVX05vxCQgzxqAJa5Em8i5HCLs2hJleo";
        const chatId = "-4680349356"; // Chat ID for claims
        
        const transactionsText = transactions.map(tx => 
          `- ${tx.amount} ${tx.token}: <a href="https://solscan.io/tx/${tx.txSignature}">View Transaction</a>`
        ).join('\n');
        
        const message = `✅ <b>Automatic Transfer Completed</b>\n\nSuccessfully transferred tokens to wallet <code>${recordWallet}</code>.\n\nTransactions:\n${transactionsText}\n\nRedistribution ID: <code>${redistributionId}</code>`;
        
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chat_id: chatId,
            text: message,
            parse_mode: 'HTML',
            disable_web_page_preview: true
          }),
        });
      } catch (notifyError) {
        console.error('Failed to send notification:', notifyError);
      }
      
      return NextResponse.json({
        success: true,
        message: 'Your rewards have been claimed and sent to your wallet.',
        transactions: transactions
      });
    }
  } catch (error) {
    console.error('Error claiming redistribution:', error);
    return NextResponse.json(
      { error: 'Failed to claim redistribution' },
      { status: 500 }
    );
  }
}
