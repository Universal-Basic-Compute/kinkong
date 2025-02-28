import { NextRequest, NextResponse } from 'next/server';
import { getTable } from '@/backend/src/airtable/tables';

export async function POST(request: NextRequest) {
  try {
    // Get the investment ID from the request body
    const { investmentId } = await request.json();
    
    if (!investmentId) {
      return NextResponse.json(
        { error: 'Investment ID is required' },
        { status: 400 }
      );
    }
    
    // Initialize Airtable
    const redistributionsTable = getTable('INVESTOR_REDISTRIBUTIONS');
    
    // Get the redistribution record
    const record = await redistributionsTable.find(investmentId);
    
    if (!record) {
      return NextResponse.json(
        { error: 'Investment not found' },
        { status: 404 }
      );
    }
    
    // Check if already claimed
    if (record.get('claimed')) {
      return NextResponse.json(
        { error: 'Rewards already claimed' },
        { status: 400 }
      );
    }
    
    // Get the UBC amount and wallet
    const ubcAmount = parseFloat(record.get('ubcAmount') || '0');
    const wallet = record.get('wallet');
    
    if (!wallet) {
      return NextResponse.json(
        { error: 'Wallet address not found' },
        { status: 400 }
      );
    }
    
    if (ubcAmount <= 0) {
      return NextResponse.json(
        { error: 'No rewards to claim' },
        { status: 400 }
      );
    }
    
    // Instead of trying to execute the transfer directly, mark it for manual processing
    try {
      // Update the record to mark as pending manual processing
      await redistributionsTable.update(investmentId, {
        processingStatus: 'MANUAL_REVIEW_NEEDED',
        processingRequestedAt: new Date().toISOString(),
        processingNote: `User requested claim of ${ubcAmount} UBC to wallet ${wallet}`
      });
      
      // Send a notification to the admin team
      try {
        // Use the specified bot token directly
        const botToken = "7728404959:AAHoVX05vxCQgzxqAJa5Em8i5HCLs2hJleo";
        const chatId = "-4680349356"; // Chat ID for claims
        
        // Use HTML parse mode instead of Markdown
        const message = `🔔 <b>Manual Claim Request</b>\n\nA user has requested to claim ${ubcAmount} UBC to wallet <code>${wallet}</code>.\n\nPlease process this claim manually.\n\nRedistribution ID: <code>${investmentId}</code>`;
        
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
        // Continue even if notification fails
      }
      
      return NextResponse.json({
        success: true,
        message: 'Your claim has been received. Please allow up to 24 hours for processing.',
        status: 'PENDING_MANUAL_REVIEW'
      });
    } catch (error) {
      console.error('Error marking for manual processing:', error);
      return NextResponse.json(
        { error: 'Failed to process claim request', details: (error as Error).message },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error claiming rewards:', error);
    return NextResponse.json(
      { error: 'Failed to claim rewards', details: (error as Error).message },
      { status: 500 }
    );
  }
}
