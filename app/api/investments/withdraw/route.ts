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
    
    // Get the wallet from the record
    const wallet = record.get('wallet');
    
    // Verify wallet ownership (optional security step)
    // This would require the user to sign a message with their wallet
    // For now, we'll assume the request is coming from the authorized user
    
    // Only send a notification to the admin team without updating the record
    try {
      // Send a notification to the admin team
      try {
        // Use the specified bot token directly
        const botToken = "7728404959:AAHoVX05vxCQgzxqAJa5Em8i5HCLs2hJleo";
        const chatId = "-4680349356"; // Chat ID for withdrawals
          
        const amount = record.get('amount');
        const token = record.get('token') || 'USDC';
          
        // Use HTML parse mode instead of Markdown
        const message = `🔔 <b>Withdrawal Request</b>\n\nA user has requested to withdraw ${amount} ${token} from wallet <code>${wallet}</code>.\n\nPlease process this withdrawal manually.\n\nInvestment ID: <code>${investmentId}</code>`;
          
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
        message: 'Your withdrawal request has been received. Please allow up to 24 hours for processing.',
        status: 'PENDING'
      });
    } catch (error) {
      console.error('Error marking for withdrawal:', error);
      return NextResponse.json(
        { error: 'Failed to process withdrawal request', details: (error as Error).message },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error processing withdrawal:', error);
    return NextResponse.json(
      { error: 'Failed to process withdrawal', details: (error as Error).message },
      { status: 500 }
    );
  }
}
