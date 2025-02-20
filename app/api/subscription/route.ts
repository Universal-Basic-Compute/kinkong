import { NextRequest, NextResponse } from 'next/server';
import { Connection, PublicKey, Message, VersionedMessage } from '@solana/web3.js';
import { getTable } from '@/backend/src/airtable/tables';

// Constants
const SUBSCRIPTION_COST = 1.5; // SOL
const SUBSCRIPTION_DURATION = 90; // days

// Validate environment variables at runtime rather than top-level
function validateEnvironment(): { rpcUrl: string; strategyWallet: string } {
  const rpcUrl = process.env.NEXT_PUBLIC_HELIUS_RPC_URL;
  const strategyWallet = process.env.STRATEGY_WALLET;

  if (!strategyWallet) {
    throw new Error('Strategy wallet not configured');
  }
  if (!rpcUrl) {
    throw new Error('RPC URL not configured');
  }

  return { rpcUrl, strategyWallet };
}

export async function POST(request: NextRequest) {
  try {
    // Get validated environment variables
    const { rpcUrl, strategyWallet } = validateEnvironment();

    // Parse request body
    const body = await request.json();
    const { signature, wallet, code } = body;

    if (!signature || !wallet || !code) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // Initialize Solana connection with validated RPC URL
    const connection = new Connection(rpcUrl);

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

    // Create PublicKey from validated strategy wallet address
    const strategyWalletPubkey = new PublicKey(strategyWallet);

    // Get account keys safely
    let receiverIndex = -1;
    const accountKeys = tx.transaction.message.getAccountKeys?.() || 
      ('staticAccountKeys' in tx.transaction.message 
        ? tx.transaction.message.staticAccountKeys 
        : []);

    // Find receiver index using loop
    for (let i = 0; i < accountKeys.length; i++) {
      if (accountKeys[i].toBase58() === strategyWalletPubkey.toBase58()) {
        receiverIndex = i;
        break;
      }
    }

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
          code,
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
        status: 'ACTIVE',
        code
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
    const code = searchParams.get('code');

    if (!code) {
      return NextResponse.json(
        { error: 'Code required' },
        { status: 400 }
      );
    }

    // Query Airtable for active subscription
    const subscriptionsTable = getTable('SUBSCRIPTIONS');
    const records = await subscriptionsTable.select({
      filterByFormula: `AND(
        {code}='${code}',
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
