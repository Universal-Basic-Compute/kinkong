import { NextRequest, NextResponse } from 'next/server';
import { Connection, PublicKey, Message, VersionedMessage } from '@solana/web3.js';
import { getTable } from '@/backend/src/airtable/tables';

// Validate environment variables
if (!process.env.STRATEGY_WALLET) {
  throw new Error('Strategy wallet not configured');
}

const SUBSCRIPTION_COST = 1.5; // SOL
const SUBSCRIPTION_DURATION = 90; // days

export async function POST(request: NextRequest) {
  try {
    // Validate environment variables
    if (!process.env.NEXT_PUBLIC_HELIUS_RPC_URL) {
      throw new Error('RPC URL not configured');
    }

    // Parse request body
    const body = await request.json();
    const { signature, wallet } = body;

    if (!signature || !wallet) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // Initialize Solana connection
    const connection = new Connection(process.env.NEXT_PUBLIC_HELIUS_RPC_URL);

    // Verify transaction
    const tx = await connection.getTransaction(signature, {
      maxSupportedTransactionVersion: 0
    });

    if (!tx) {
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      );
    }

    // Verify transaction details
    const postBalances = tx.meta?.postBalances || [];
    const preBalances = tx.meta?.preBalances || [];

    // Find receiver index (your subscription wallet)
    const accountKeys = tx.transaction.message.getAccountKeys?.() || 
      ((tx.transaction.message as Message | VersionedMessage).staticAccountKeys || 
       (tx.transaction.message as Message).accountKeys);
      
    // Create PublicKey from strategy wallet address
    const strategyWallet = new PublicKey(process.env.STRATEGY_WALLET!);
    
    // Convert MessageAccountKeys to array before using findIndex
    const accountKeysArray = Array.from(accountKeys);
    
    // Compare PublicKeys using base58 strings
    const receiverIndex = accountKeysArray.findIndex(
      key => key.toBase58() === strategyWallet.toBase58()
    );

    if (receiverIndex === -1) {
      return NextResponse.json(
        { error: 'Invalid receiver' },
        { status: 400 }
      );
    }

    // Calculate SOL amount transferred
    const solTransferred = (postBalances[receiverIndex] - preBalances[receiverIndex]) / 1e9;

    // Verify amount
    if (solTransferred < SUBSCRIPTION_COST) {
      return NextResponse.json(
        { error: 'Insufficient payment amount' },
        { status: 400 }
      );
    }

    // Calculate subscription dates
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + SUBSCRIPTION_DURATION);

    // Add to Airtable SUBSCRIPTIONS table
    const subscriptionsTable = getTable('SUBSCRIPTIONS');
    const record = await subscriptionsTable.create([
      {
        fields: {
          wallet,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          amount: SUBSCRIPTION_COST,
          signature,
          status: 'ACTIVE'
        }
      }
    ]);

    // Return success response
    return NextResponse.json({
      success: true,
      subscription: {
        id: record[0].id,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        status: 'ACTIVE'
      }
    });

  } catch (error) {
    console.error('Subscription error:', error);
    return NextResponse.json(
      { error: 'Failed to process subscription' },
      { status: 500 }
    );
  }
}

// Helper function to verify subscription status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const wallet = searchParams.get('wallet');

    if (!wallet) {
      return NextResponse.json(
        { error: 'Wallet address required' },
        { status: 400 }
      );
    }

    // Query Airtable for active subscription
    const subscriptionsTable = getTable('SUBSCRIPTIONS');
    const records = await subscriptionsTable.select({
      filterByFormula: `AND(
        {wallet}='${wallet}',
        {status}='ACTIVE',
        {endDate}>=TODAY()
      )`
    }).firstPage();

    if (records.length === 0) {
      return NextResponse.json({
        active: false
      });
    }

    // Return subscription details
    const subscription = records[0];
    return NextResponse.json({
      active: true,
      subscription: {
        id: subscription.id,
        startDate: subscription.fields.startDate,
        endDate: subscription.fields.endDate,
        status: subscription.fields.status
      }
    });

  } catch (error) {
    console.error('Subscription check error:', error);
    return NextResponse.json(
      { error: 'Failed to check subscription' },
      { status: 500 }
    );
  }
}
