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
    const investmentsTable = getTable('INVESTMENTS');
    
    // Get the investment record
    const record = await investmentsTable.find(investmentId);
    
    if (!record) {
      return NextResponse.json(
        { error: 'Investment not found' },
        { status: 404 }
      );
    }
    
    // Check if already marked for withdrawal
    if (record.get('toWithdraw')) {
      return NextResponse.json(
        { error: 'Withdrawal already requested' },
        { status: 400 }
      );
    }
    
    // Get the investment amount and wallet for notification
    const amount = parseFloat(record.get('amount') || '0');
    const token = record.get('token') || 'USDC';
    const wallet = record.get('wallet');
    
    // Simply mark the investment for withdrawal
    await investmentsTable.update(investmentId, {
      toWithdraw: true
    });
    
    // Send a notification to the admin team
    try {
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      const chatId = "-4680349356";
      
      if (botToken) {
        const message = `🔔 *Withdrawal Request*\n\nA user has requested to withdraw ${amount} ${token} to wallet \`${wallet}\`.\n\nInvestment ID: \`${investmentId}\``;
        
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chat_id: chatId,
            text: message,
            parse_mode: 'Markdown'
          }),
        });
      }
    } catch (notifyError) {
      console.error('Failed to send notification:', notifyError);
      // Continue even if notification fails
    }
    
    return NextResponse.json({
      success: true,
      message: 'Your withdrawal request has been received. Please allow up to 24 hours for processing.'
    });
  } catch (error) {
    console.error('Error processing withdrawal:', error);
    return NextResponse.json(
      { error: 'Failed to process withdrawal', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
