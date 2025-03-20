import { NextRequest, NextResponse } from 'next/server';
import { getTable } from '@/backend/src/airtable/tables';
import path from 'path';
import { exec } from 'child_process';
import util from 'util';

// Transaction interface
interface Transaction {
  token: string;
  amount: number;
  txSignature: string;
}

// Convert exec to Promise-based
const execPromise = util.promisify(exec);

// Token mint addresses
const TOKEN_MINTS = {
  UBC: '9psiRdn9cXYVps4F1kFuoNjd2EtmqNJXrCPmRppJpump',
  COMPUTE: 'B1N1HcMm4RysYz4smsXwmk2UnS8NziqKCM6Ho8i62vXo'
};

// Function to execute token transfer
async function executeTokenTransfer(wallet: string, tokenMint: string, amount: number): Promise<string> {
  try {
    const scriptPath = path.resolve(process.cwd(), 'engine/send_tokens.js');
    
    console.log(`Executing token transfer: ${amount} of ${tokenMint} to ${wallet}`);
    
    const { stdout, stderr } = await execPromise(
      `node ${scriptPath} ${wallet} ${tokenMint} ${amount}`
    );
    
    if (stderr) {
      console.error('Token transfer stderr:', stderr);
    }
    
    console.log('Token transfer stdout:', stdout);
    
    // Extract transaction signature from output
    const signatureMatch = stdout.match(/Transaction signature: ([a-zA-Z0-9]+)/);
    if (signatureMatch && signatureMatch[1]) {
      return signatureMatch[1];
    }
    
    return 'Transfer completed, signature not captured';
  } catch (error) {
    console.error('Failed to execute token transfer:', error);
    throw new Error(`Token transfer failed: ${(error as Error).message}`);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('Received claim request with body:', body);
    
    const { redistributionId, wallet } = body;

    if (!redistributionId) {
      console.error('Missing redistributionId in request');
      return NextResponse.json(
        { error: 'Redistribution ID is required' },
        { status: 400 }
      );
    }

    if (!wallet) {
      console.error('Missing wallet in request');
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      );
    }

    // Get the redistribution record
    const redistributionsTable = getTable('INVESTOR_REDISTRIBUTIONS');
    console.log(`Looking up redistribution with ID: ${redistributionId}`);
    
    let record;
    try {
      record = await redistributionsTable.find(redistributionId);
    } catch (findError) {
      console.error('Error finding redistribution record:', findError);
      return NextResponse.json(
        { error: 'Failed to find redistribution record', details: (findError as Error).message },
        { status: 500 }
      );
    }

    if (!record) {
      console.error(`Redistribution not found with ID: ${redistributionId}`);
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

    // Get the reward amounts
    const ubcAmount = parseFloat(record.get('ubcAmount') || '0');
    const computeAmount = parseFloat(record.get('computeAmount') || '0');
    
    if (ubcAmount <= 0 && computeAmount <= 0) {
      return NextResponse.json(
        { error: 'No rewards to claim' },
        { status: 400 }
      );
    }
    
    // Execute token transfers
    const transactions: Transaction[] = [];
    let transferError: string | null = null;
    
    try {
      // Transfer UBC if applicable
      if (ubcAmount > 0) {
        const ubcTxSignature = await executeTokenTransfer(wallet, TOKEN_MINTS.UBC, ubcAmount);
        transactions.push({
          token: 'UBC',
          amount: ubcAmount,
          txSignature: ubcTxSignature
        });
      }
      
      // Transfer COMPUTE if applicable
      if (computeAmount > 0) {
        const computeTxSignature = await executeTokenTransfer(wallet, TOKEN_MINTS.COMPUTE, computeAmount);
        transactions.push({
          token: 'COMPUTE',
          amount: computeAmount,
          txSignature: computeTxSignature
        });
      }
    } catch (error) {
      console.error('Error during token transfer:', error);
      transferError = (error as Error).message;
      
      // Continue with the process even if transfer fails
      // We'll mark it for manual review
    }
    
    // Update the record based on transfer results
    if (transferError) {
      // If transfer failed, mark for manual processing
      await redistributionsTable.update(redistributionId, {
        processingStatus: 'MANUAL_REVIEW_NEEDED',
        processingRequestedAt: new Date().toISOString(),
        processingNote: `Automatic transfer failed: ${transferError}. Amounts: ${ubcAmount} UBC, ${computeAmount} COMPUTE to wallet ${wallet}`
      });
      
      // Send notification about failed transfer
      try {
        const botToken = "7728404959:AAHoVX05vxCQgzxqAJa5Em8i5HCLs2hJleo";
        const chatId = "-4680349356"; // Chat ID for claims
        
        const message = `❌ <b>Automatic Transfer Failed</b>\n\nFailed to transfer tokens to wallet <code>${wallet}</code>.\n\nAmounts:\n- UBC: ${ubcAmount}\n- COMPUTE: ${computeAmount}\n\nError: <code>${transferError}</code>\n\nRedistribution ID: <code>${redistributionId}</code>\n\nPlease process this claim manually.`;
        
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
      }
      
      return NextResponse.json({
        success: false,
        message: 'There was an issue processing your claim automatically. Our team has been notified and will process it manually within 24 hours.',
        status: 'PENDING_MANUAL_REVIEW',
        error: transferError
      });
    } else {
      // If transfer succeeded, mark as claimed
      await redistributionsTable.update(redistributionId, {
        claimed: true,
        claimedAt: new Date().toISOString(),
        processingStatus: 'COMPLETED',
        processingNote: `Automatic transfer completed. Transactions: ${JSON.stringify(transactions)}`
      });
      
      // Send notification about successful transfer
      try {
        const botToken = "7728404959:AAHoVX05vxCQgzxqAJa5Em8i5HCLs2hJleo";
        const chatId = "-4680349356"; // Chat ID for claims
        
        const transactionsText = transactions.map(tx => 
          `- ${tx.amount} ${tx.token}: <a href="https://solscan.io/tx/${tx.txSignature}">View Transaction</a>`
        ).join('\n');
        
        const message = `✅ <b>Automatic Transfer Completed</b>\n\nSuccessfully transferred tokens to wallet <code>${wallet}</code>.\n\nTransactions:\n${transactionsText}\n\nRedistribution ID: <code>${redistributionId}</code>`;
        
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chat_id: chatId,
            text: message,
            parse_mode: 'HTML',
            disable_web_page_preview: true
          }),
        });
      } catch (notifyError) {
        console.error('Failed to send notification:', notifyError);
      }
      
      return NextResponse.json({
        success: true,
        message: 'Your rewards have been claimed and sent to your wallet.',
        transactions: transactions
      });
    }
  } catch (error) {
    console.error('Error claiming redistribution:', error);
    return NextResponse.json(
      { error: 'Failed to claim redistribution' },
      { status: 500 }
    );
  }
}
