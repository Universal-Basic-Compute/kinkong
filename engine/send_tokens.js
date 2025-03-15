const { Connection, Keypair, PublicKey, Transaction, sendAndConfirmTransaction } = require('@solana/web3.js');
const { Token, TOKEN_PROGRAM_ID } = require('@solana/spl-token');
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
    const amountWithDecimals = amount * Math.pow(10, decimals);
    
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
    const decimals = args.length > 3 ? parseInt(args[3]) : 9;
    
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
