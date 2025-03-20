import { NextRequest, NextResponse } from 'next/server';
import { Connection, Keypair, PublicKey, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import { createTransferInstruction, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction } from '@solana/spl-token';
import bs58 from 'bs58';

// Specify Node.js runtime
export const runtime = 'nodejs';

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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { wallet, tokenMint, amount } = body;
    
    if (!wallet || !tokenMint || !amount) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }
    
    // Determine token symbol and decimals
    const tokenSymbol = Object.keys(TOKEN_MINTS).find(key => TOKEN_MINTS[key] === tokenMint) || 'UNKNOWN';
    const decimals = TOKEN_DECIMALS[tokenSymbol] || 9;
    
    console.log(`Executing token transfer: ${amount} of ${tokenMint} (${tokenSymbol}) to ${wallet} with ${decimals} decimals`);
    
    // Load private key from environment variable
    const privateKeyString = process.env.STRATEGY_WALLET_PRIVATE_KEY || process.env.KINKONG_WALLET_PRIVATE_KEY;
    if (!privateKeyString) {
      return NextResponse.json(
        { error: 'Wallet private key not configured' },
        { status: 500 }
      );
    }
    
    // Import bs58 with proper error handling
    let bs58;
    try {
      bs58 = require('bs58');
      // Check if bs58 is imported as an ES module
      if (bs58.default && typeof bs58.default.decode === 'function') {
        bs58 = bs58.default;
      }
      
      // Verify that decode function exists
      if (typeof bs58.decode !== 'function') {
        throw new Error('bs58.decode is not a function');
      }
    } catch (error) {
      console.error('Error importing bs58:', error);
      
      // Create a custom implementation of bs58 decode using Buffer
      bs58 = {
        decode: (str) => {
          // This is a very basic implementation - not for production use
          console.log('Using custom bs58 decode implementation');
          
          // Convert base58 to base64 first (this is just for testing)
          // In production, use a proper base58 library
          const base64 = Buffer.from(str, 'utf8').toString('base64');
          return Buffer.from(base64, 'base64');
        }
      };
    }
    
    // Decode private key with better error handling
    let sourceWalletKeypair;
    try {
      // Try multiple formats for the private key
      try {
        // Try as base58 string with our implementation
        const privateKey = bs58.decode(privateKeyString);
        sourceWalletKeypair = Keypair.fromSecretKey(new Uint8Array(privateKey));
        console.log('Decoded private key using base58');
      } catch (e1) {
        console.error('Base58 decode failed:', e1.message);
        
        try {
          // Try as base64 string
          const privateKey = Buffer.from(privateKeyString, 'base64');
          sourceWalletKeypair = Keypair.fromSecretKey(new Uint8Array(privateKey));
          console.log('Decoded private key using base64');
        } catch (e2) {
          console.error('Base64 decode failed:', e2.message);
          
          try {
            // Try as JSON array
            const privateKeyArray = JSON.parse(privateKeyString);
            sourceWalletKeypair = Keypair.fromSecretKey(new Uint8Array(privateKeyArray));
            console.log('Decoded private key using JSON array');
          } catch (e3) {
            console.error('JSON parse failed:', e3.message);
            
            try {
              // Try as hex string
              const privateKey = Buffer.from(privateKeyString, 'hex');
              sourceWalletKeypair = Keypair.fromSecretKey(new Uint8Array(privateKey));
              console.log('Decoded private key using hex');
            } catch (e4) {
              console.error('Hex decode failed:', e4.message);
              throw new Error('Invalid wallet private key format');
            }
          }
        }
      }
      
      console.log(`Source wallet: ${sourceWalletKeypair.publicKey.toString()}`);
    } catch (error) {
      console.error('Error decoding private key:', error);
      return NextResponse.json(
        { error: 'Invalid wallet private key format' },
        { status: 500 }
      );
    }
    
    // Connect to Solana network
    const heliusRpcUrl = process.env.NEXT_PUBLIC_HELIUS_RPC_URL || process.env.HELIUS_RPC_URL;
    if (!heliusRpcUrl) {
      return NextResponse.json(
        { error: 'Helius RPC URL not configured' },
        { status: 500 }
      );
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
    
    // Return success response
    return NextResponse.json({
      success: true,
      signature,
      token: tokenSymbol,
      amount,
      destination: wallet
    });
  } catch (error) {
    console.error('Error executing token transfer:', error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
