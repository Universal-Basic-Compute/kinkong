import { Connection, Keypair, PublicKey, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import { Token, TOKEN_PROGRAM_ID, u64 } from '@solana/spl-token';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import path from 'path';

dotenv.config();

// Setup logging
function setupLogging() {
  const logger = {
    info: (message: string, ...args: any[]) => console.log(`[INFO] ${message}`, ...args),
    error: (message: string, ...args: any[]) => console.error(`[ERROR] ${message}`, ...args),
    warn: (message: string, ...args: any[]) => console.warn(`[WARN] ${message}`, ...args),
  };
  return logger;
}

const logger = setupLogging();

// Function to send tokens
async function sendTokens(
  destinationWallet: string,
  tokenMint: string,
  amount: number,
  decimals: number = 9
): Promise<string> {
  try {
    logger.info(`Starting token transfer to ${destinationWallet}`);
    
    // Load private key from environment variable
    const privateKeyString = process.env.STRATEGY_WALLET_PRIVATE_KEY;
    if (!privateKeyString) {
      throw new Error('STRATEGY_WALLET_PRIVATE_KEY not found in environment variables');
    }
    
    // Convert private key to Uint8Array
    const privateKey = Uint8Array.from(Buffer.from(privateKeyString, 'base64'));
    const sourceWalletKeypair = Keypair.fromSecretKey(privateKey);
    
    // Verify source wallet address matches expected address
    const sourceWalletAddress = sourceWalletKeypair.publicKey.toString();
    if (sourceWalletAddress !== 'FnWyN4t1aoZWFjEEBxopMaAgk5hjL5P3K65oc2T9FBJY') {
      throw new Error(`Source wallet address mismatch. Expected: FnWyN4t1aoZWFjEEBxopMaAgk5hjL5P3K65oc2T9FBJY, Got: ${sourceWalletAddress}`);
    }
    
    // Connect to Solana network
    const rpcUrl = process.env.NEXT_PUBLIC_HELIUS_RPC_URL || 'https://api.mainnet-beta.solana.com';
    const connection = new Connection(rpcUrl, 'confirmed');
    
    // Create token instance
    const tokenMintPublicKey = new PublicKey(tokenMint);
    const token = new Token(
      connection,
      tokenMintPublicKey,
      TOKEN_PROGRAM_ID,
      sourceWalletKeypair
    );
    
    // Get source token account
    const sourceTokenAccount = await token.getOrCreateAssociatedAccountInfo(
      sourceWalletKeypair.publicKey
    );
    
    // Get destination token account
    const destinationWalletPublicKey = new PublicKey(destinationWallet);
    const destinationTokenAccount = await token.getOrCreateAssociatedAccountInfo(
      destinationWalletPublicKey
    );
    
    // Calculate amount with decimals
    const amountWithDecimals = new u64(amount * Math.pow(10, decimals));
    
    // Create and send transaction
    const transaction = new Transaction().add(
      Token.createTransferInstruction(
        TOKEN_PROGRAM_ID,
        sourceTokenAccount.address,
        destinationTokenAccount.address,
        sourceWalletKeypair.publicKey,
        [],
        amountWithDecimals
      )
    );
    
    logger.info(`Sending ${amount} tokens to ${destinationWallet}`);
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [sourceWalletKeypair]
    );
    
    logger.info(`Transfer successful! Transaction signature: ${signature}`);
    
    // Send notification if configured
    await sendTelegramNotification({
      token: tokenMint,
      amount: amount,
      destination: destinationWallet,
      txSignature: signature
    });
    
    return signature;
  } catch (error) {
    logger.error('Error sending tokens:', error);
    throw error;
  }
}

// Function to send Telegram notification
async function sendTelegramNotification(transferData: {
  token: string,
  amount: number,
  destination: string,
  txSignature: string
}): Promise<void> {
  try {
    const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
    const telegramChatId = process.env.TELEGRAM_CHAT_ID;
    
    if (!telegramBotToken || !telegramChatId) {
      logger.warn('Telegram notification skipped: missing configuration');
      return;
    }
    
    const message = `
🔄 *Token Transfer Executed*

*Token:* \`${transferData.token}\`
*Amount:* ${transferData.amount}
*Destination:* \`${transferData.destination}\`
*Transaction:* [View on Explorer](https://solscan.io/tx/${transferData.txSignature})
    `;
    
    const url = `https://api.telegram.org/bot${telegramBotToken}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: telegramChatId,
        text: message,
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
      }),
    });
    
    if (!response.ok) {
      throw new Error(`Telegram API error: ${response.statusText}`);
    }
    
    logger.info('Telegram notification sent successfully');
  } catch (error) {
    logger.error('Failed to send Telegram notification:', error);
  }
}

// Command line interface
async function main() {
  try {
    // Parse command line arguments
    const args = process.argv.slice(2);
    
    if (args.length < 3) {
      console.log('Usage: ts-node send_tokens.ts <destination_wallet> <token_mint> <amount> [decimals=9]');
      process.exit(1);
    }
    
    const destinationWallet = args[0];
    const tokenMint = args[1];
    const amount = parseFloat(args[2]);
    const decimals = args.length > 3 ? parseInt(args[3]) : 9;
    
    if (isNaN(amount) || amount <= 0) {
      throw new Error('Amount must be a positive number');
    }
    
    // Execute token transfer
    const signature = await sendTokens(destinationWallet, tokenMint, amount, decimals);
    console.log(`✅ Transfer completed successfully. Signature: ${signature}`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Transfer failed:', error);
    process.exit(1);
  }
}

// Run the script if executed directly
if (require.main === module) {
  main();
}

// Export functions for use in other modules
export { sendTokens };
