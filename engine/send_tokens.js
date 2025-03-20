const { Connection, Keypair, PublicKey, Transaction, sendAndConfirmTransaction } = require('@solana/web3.js');

// Function to get the correct decimals for common tokens
function getTokenDecimals(tokenMint) {
  // Common token decimals
  const knownTokens = {
    'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 6, // USDC
    'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 6, // USDT
    'So11111111111111111111111111111111111111112': 9, // SOL (wrapped)
    'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So': 9, // mSOL
    'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': 5, // Bonk
    '9psiRdn9cXYVps4F1kFuoNjd2EtmqNJXrCPmRppJpump': 6, // UBC
    'B1N1HcMm4RysYz4smsXwmk2UnS8NziqKCM6Ho8i62vXo': 6, // COMPUTE
    // Add more tokens as needed
  };
  
  return knownTokens[tokenMint] || 9; // Default to 9 if unknown
}
const { 
  TOKEN_PROGRAM_ID, 
  createTransferInstruction, 
  getAssociatedTokenAddress, 
  createAssociatedTokenAccountInstruction 
} = require('@solana/spl-token');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
// Import bs58 with proper ES/CommonJS module handling
let bs58;
try {
  bs58 = require('bs58');
  // Check if bs58 is imported as an ES module
  if (bs58.default && typeof bs58.default.decode === 'function') {
    bs58 = bs58.default;
  }
} catch (error) {
  console.error('Failed to import bs58:', error);
  // Provide a minimal fallback
  bs58 = {
    decode: (str) => {
      console.warn('Using fallback bs58 decode implementation');
      return Buffer.from(str, 'base64');
    },
    encode: (buffer) => {
      console.warn('Using fallback bs58 encode implementation');
      return Buffer.from(buffer).toString('base64');
    }
  };
}

// Load environment variables from the project root .env file
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Add this after dotenv.config() to debug:
console.log('Environment loaded from:', path.resolve(process.cwd(), '.env'));
console.log('STRATEGY_WALLET_PRIVATE_KEY exists:', !!process.env.STRATEGY_WALLET_PRIVATE_KEY);

// Setup logging
function setupLogging() {
  const logger = {
    info: (message, ...args) => console.log(`[INFO] ${message}`, ...args),
    error: (message, ...args) => console.error(`[ERROR] ${message}`, ...args),
    warn: (message, ...args) => console.warn(`[WARN] ${message}`, ...args),
  };
  return logger;
}

const logger = setupLogging();

// Add a global variable to track which method succeeded
let successfulMethod = null;

// No alternative RPC URLs - using only Helius

// Function to get blockhash with retry logic - using only Helius
async function getLatestBlockhashWithRetry(connection, maxRetries = 5, initialDelay = 1000) {
  let retries = 0;
  let delay = initialDelay;
  
  while (retries < maxRetries) {
    try {
      logger.info(`Getting latest blockhash (attempt ${retries + 1}/${maxRetries})...`);
      const startTime = Date.now();
      const blockhashResponse = await connection.getLatestBlockhash('confirmed');
      const endTime = Date.now();
      logger.info(`Successfully got blockhash in ${endTime - startTime}ms: ${blockhashResponse.blockhash.substring(0, 10)}...`);
      
      // Record successful method
      successfulMethod = {
        method: "getLatestBlockhash",
        url: connection.rpcEndpoint,
        time: endTime - startTime
      };
      
      return blockhashResponse;
    } catch (error) {
      retries++;
      logger.error(`Error getting blockhash (attempt ${retries}/${maxRetries}): ${error.message}`);
      
      if (error.message.includes('429') || error.message.includes('Too Many Requests')) {
        logger.warn('Rate limit hit, increasing backoff time...');
        delay = delay * 2; // Double the delay for rate limit errors
      }
      
      if (retries >= maxRetries) {
        throw new Error(`Failed to get blockhash after ${maxRetries} attempts: ${error.message}`);
      }
      
      logger.info(`Retrying in ${delay/1000} seconds...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      delay = Math.min(delay * 1.5, 30000); // Increase delay but cap at 30 seconds
    }
  }
}

// Function to send tokens
async function sendTokens(
  destinationWallet,
  tokenMint,
  amount,
  decimals = 9
) {
  try {
    logger.info(`Starting token transfer to ${destinationWallet}`);
    
    // Load private key from environment variable
    const privateKeyString = process.env.STRATEGY_WALLET_PRIVATE_KEY;
    if (!privateKeyString) {
      throw new Error('STRATEGY_WALLET_PRIVATE_KEY not found in environment variables');
    }
    
    // Try different formats for the private key
    let sourceWalletKeypair;
    try {
      // Try as base64 string
      const privateKey = Buffer.from(privateKeyString, 'base64');
      sourceWalletKeypair = Keypair.fromSecretKey(new Uint8Array(privateKey));
    } catch (e) {
      console.log('Base64 decode failed:', e.message);
      try {
        // Try as JSON array
        const privateKeyArray = JSON.parse(privateKeyString);
        sourceWalletKeypair = Keypair.fromSecretKey(new Uint8Array(privateKeyArray));
      } catch (e2) {
        console.log('JSON parse failed:', e2.message);
        try {
          // Try as hex string
          const privateKey = Buffer.from(privateKeyString, 'hex');
          sourceWalletKeypair = Keypair.fromSecretKey(new Uint8Array(privateKey));
        } catch (e3) {
          console.log('Hex decode failed:', e3.message);
          try {
            // Try as base58 string
            const privateKey = bs58.decode(privateKeyString);
            sourceWalletKeypair = Keypair.fromSecretKey(new Uint8Array(privateKey));
            console.log('Successfully decoded private key using base58');
          } catch (e4) {
            console.log('Base58 decode failed:', e4.message, 'bs58 type:', typeof bs58, 'bs58 methods:', Object.keys(bs58));
            // Try loading from file if environment variable is a path
            try {
              if (fs.existsSync(privateKeyString)) {
                const keyFile = fs.readFileSync(privateKeyString, 'utf-8');
                const privateKeyArray = JSON.parse(keyFile);
                sourceWalletKeypair = Keypair.fromSecretKey(new Uint8Array(privateKeyArray));
              } else {
                throw new Error('File not found');
              }
            } catch (e5) {
              console.log('File load failed:', e5.message);
              throw new Error(`Invalid private key format. Value: "${privateKeyString.substring(0, 10)}..."`);
            }
          }
        }
      }
    }
    
    // Verify source wallet address matches expected address
    const sourceWalletAddress = sourceWalletKeypair.publicKey.toString();
    if (sourceWalletAddress !== 'FnWyN4t1aoZWFjEEBxopMaAgk5hjL5P3K65oc2T9FBJY') {
      throw new Error(`Source wallet address mismatch. Expected: FnWyN4t1aoZWFjEEBxopMaAgk5hjL5P3K65oc2T9FBJY, Got: ${sourceWalletAddress}`);
    }
    
    // Reset the successful method tracker
    successfulMethod = null;
    
    // Connect to Solana network using only Helius
    const heliusRpcUrl = process.env.NEXT_PUBLIC_HELIUS_RPC_URL || process.env.HELIUS_RPC_URL;
    if (!heliusRpcUrl) {
      throw new Error('Helius RPC URL not found in environment variables');
    }
    
    logger.info(`Using Helius RPC URL: ${heliusRpcUrl.substring(0, 20)}...`);
    
    // Create connection with better timeout and commitment settings
    const connection = new Connection(heliusRpcUrl, {
      commitment: 'confirmed',
      confirmTransactionInitialTimeout: 60000, // 60 seconds
      disableRetryOnRateLimit: false,
      httpHeaders: {
        'Content-Type': 'application/json',
      }
    });
    
    // Test the connection with a simple request
    try {
      const startTime = Date.now();
      const versionInfo = await connection.getVersion();
      const endTime = Date.now();
      logger.info(`Successfully connected to Helius in ${endTime - startTime}ms`);
      logger.info(`RPC version: ${JSON.stringify(versionInfo)}`);
    } catch (error) {
      logger.error(`Failed to connect to Helius: ${error.message}`);
      throw new Error(`Failed to connect to Helius RPC: ${error.message}`);
    }
    
    // Get token mint public key
    const tokenMintPublicKey = new PublicKey(tokenMint);
    const sourceWalletPublicKey = sourceWalletKeypair.publicKey;
    const destinationWalletPublicKey = new PublicKey(destinationWallet);

    // Get associated token accounts
    const sourceTokenAccount = await getAssociatedTokenAddress(
      tokenMintPublicKey,
      sourceWalletPublicKey
    );

    const destinationTokenAccount = await getAssociatedTokenAddress(
      tokenMintPublicKey,
      destinationWalletPublicKey
    );

    // Check if destination token account exists
    let transaction = new Transaction();
    let accountCheckMethod = null;
    
    try {
      logger.info(`Checking if destination token account exists: ${destinationTokenAccount.toString()}`);
      const startTime = Date.now();
      const accountInfo = await connection.getAccountInfo(destinationTokenAccount);
      const endTime = Date.now();
      
      accountCheckMethod = {
        method: "getAccountInfo",
        success: true,
        time: endTime - startTime
      };
      
      if (!accountInfo) {
        logger.info(`Destination token account doesn't exist, creating it...`);
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
        logger.info(`Destination token account exists`);
      }
    } catch (error) {
      const endTime = Date.now();
      logger.warn(`Error checking destination token account: ${error.message}`);
      
      accountCheckMethod = {
        method: "getAccountInfo",
        success: false,
        error: error.message,
        time: endTime - startTime
      };
      
      // If there's an error, assume the account doesn't exist and create it
      logger.info(`Assuming destination token account doesn't exist, creating it...`);
      transaction.add(
        createAssociatedTokenAccountInstruction(
          sourceWalletPublicKey,
          destinationTokenAccount,
          destinationWalletPublicKey,
          tokenMintPublicKey
        )
      );
    }

    // Calculate amount with decimals
    const amountWithDecimals = Math.round(amount * Math.pow(10, decimals));
    
    logger.info(`Sending ${amount} tokens (${amountWithDecimals} base units with ${decimals} decimals) to ${destinationWallet}`);

    // Add transfer instruction
    transaction.add(
      createTransferInstruction(
        sourceTokenAccount,
        destinationTokenAccount,
        sourceWalletPublicKey,
        amountWithDecimals
      )
    );
    // Get blockhash with retry
    logger.info(`Getting blockhash...`);
    const { blockhash, lastValidBlockHeight } = await getLatestBlockhashWithRetry(connection);
    transaction.recentBlockhash = blockhash;
    transaction.lastValidBlockHeight = lastValidBlockHeight;

    // Add some additional options for better reliability
    logger.info(`Sending transaction...`);
    const startSendTime = Date.now();
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
    
    const endSendTime = Date.now();
    
    logger.info(`Transfer successful in ${endSendTime - startSendTime}ms! Transaction signature: ${signature}`);
    
    // Log all successful methods
    logger.info(`=== SUCCESSFUL METHODS SUMMARY ===`);
    logger.info(`RPC URL: ${successfulRpcUrl}`);
    logger.info(`Account check method: ${JSON.stringify(accountCheckMethod)}`);
    logger.info(`Blockhash method: ${JSON.stringify(successfulMethod)}`);
    logger.info(`Transaction send time: ${endSendTime - startSendTime}ms`);
    logger.info(`================================`);
    
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
async function sendTelegramNotification(transferData) {
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

// Function to generate a test keypair
function generateTestKeypair() {
  const keypair = Keypair.generate();
  console.log('Generated test keypair:');
  console.log('Public key:', keypair.publicKey.toString());
  console.log('Private key (array):', JSON.stringify(Array.from(keypair.secretKey)));
  
  // Also output in other formats for testing
  console.log('Private key (base58):', bs58.encode(keypair.secretKey));
  console.log('Private key (base64):', Buffer.from(keypair.secretKey).toString('base64'));
  console.log('Private key (hex):', Buffer.from(keypair.secretKey).toString('hex'));
  
  return keypair;
}

// No fallback RPC URLs - using only Helius

// Command line interface
async function main() {
  try {
    // Parse command line arguments
    const args = process.argv.slice(2);
    
    // Check for test mode
    if (args[0] === 'generate-keypair') {
      generateTestKeypair();
      return;
    }
    
    if (args.length < 3) {
      console.log('Usage: node send_tokens.js <destination_wallet> <token_mint> <amount> [decimals=9] [private_key]');
      console.log('       node send_tokens.js generate-keypair');
      process.exit(1);
    }
    
    const destinationWallet = args[0];
    const tokenMint = args[1];
    const amount = parseFloat(args[2]);
    const decimals = args.length > 3 ? parseInt(args[3]) : getTokenDecimals(tokenMint);
    
    console.log(`Using ${decimals} decimals for token ${tokenMint}`);
    
    // Use private key from command line if provided
    if (args.length > 4) {
      process.env.STRATEGY_WALLET_PRIVATE_KEY = args[4];
      console.log("Using private key from command line argument");
    }
    
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
module.exports = { sendTokens };
