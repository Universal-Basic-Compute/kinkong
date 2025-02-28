import { NextRequest, NextResponse } from 'next/server';
import { getTable } from '@/backend/src/airtable/tables';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { redistributionId, wallet } = body;

    if (!redistributionId || !wallet) {
      return NextResponse.json(
        { error: 'Redistribution ID and wallet are required' },
        { status: 400 }
      );
    }

    // Get the redistribution record
    const redistributionsTable = getTable('INVESTOR_REDISTRIBUTIONS');
    const record = await redistributionsTable.find(redistributionId);

    if (!record) {
      return NextResponse.json(
        { error: 'Redistribution not found' },
        { status: 404 }
      );
    }

    // Verify the wallet matches
    const recordWallet = record.get('wallet');
    if (recordWallet !== wallet) {
      return NextResponse.json(
        { error: 'Wallet does not match redistribution record' },
        { status: 403 }
      );
    }

    // Check if already claimed
    const claimed = record.get('claimed');
    if (claimed) {
      return NextResponse.json(
        { error: 'Redistribution already claimed' },
        { status: 400 }
      );
    }

    // Update the record to mark as claimed
    await redistributionsTable.update(redistributionId, {
      claimed: true,
      claimedAt: new Date().toISOString()
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error claiming redistribution:', error);
    return NextResponse.json(
      { error: 'Failed to claim redistribution' },
      { status: 500 }
    );
  }
}
