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
    // Parse request body
    const body = await request.json();
    const { signature, code, wallet } = body; // Make wallet optional

    if (!signature || !code) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
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
          code,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          amount: SUBSCRIPTION_COST,
          signature,
          status: 'ACTIVE',
          wallet: wallet || null // Store wallet if provided
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
        code,
        wallet: wallet || null
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
