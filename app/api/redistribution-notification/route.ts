import { NextRequest, NextResponse } from 'next/server';

// Specify Node.js runtime
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { wallet, token, amount, txSignature } = body;
    
    if (!wallet || !token || !amount || !txSignature) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }
    
    // Get bot token from environment
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      return NextResponse.json(
        { error: 'Telegram bot token not configured' },
        { status: 500 }
      );
    }
    
    // Use the specific chat ID for redistributions
    const chatId = "-1001699255893";
    
    // Format the wallet address for display
    const shortWallet = `${wallet.substring(0, 4)}...${wallet.substring(wallet.length - 4)}`;
    
    // Create the exact message format from send_tokens.js
    const message = `
🎉 *KongInvest Weekly Redistribution!* 🎉

💰 *${Number(amount).toLocaleString('en-US', {maximumFractionDigits: 2})} $${token}* has been distributed to investor!

👛 Wallet: \`${shortWallet}\`

✅ [View Transaction on Solscan](https://solscan.io/tx/${txSignature})

🦍 *KongInvest - Invest Together, Grow Together* 🚀
    `;
    
    // Send the notification with retry logic
    const maxRetries = 3;
    let retries = 0;
    let success = false;
    
    while (retries < maxRetries && !success) {
      try {
        console.log(`Sending redistribution notification (attempt ${retries + 1}/${maxRetries})...`);
        
        const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chat_id: chatId,
            text: message,
            parse_mode: 'Markdown',
            disable_web_page_preview: true
          }),
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(`Telegram API error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`);
        }
        
        const result = await response.json();
        console.log('Redistribution notification sent successfully:', result.ok);
        success = true;
      } catch (error) {
        retries++;
        console.error(`Error sending notification (attempt ${retries}/${maxRetries}):`, error);
        
        if (retries >= maxRetries) {
          return NextResponse.json(
            { error: `Failed to send notification after ${maxRetries} attempts: ${(error as Error).message}` },
            { status: 500 }
          );
        }
        
        // Exponential backoff
        const delay = Math.min(1000 * Math.pow(2, retries), 10000);
        console.log(`Retrying in ${delay/1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    return NextResponse.json({
      success: true,
      message: 'Redistribution notification sent successfully'
    });
  } catch (error) {
    console.error('Error sending redistribution notification:', error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
