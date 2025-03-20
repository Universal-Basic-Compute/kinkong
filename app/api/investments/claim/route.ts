import { NextRequest, NextResponse } from 'next/server';
import { getTable } from '@/backend/src/airtable/tables';

// Specify Node.js runtime
export const runtime = 'nodejs';

// Transaction interface
interface Transaction {
  token: string;
  amount: number;
  txSignature: string;
}

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

// Function to execute token transfer with retries
async function executeTokenTransfer(wallet: string, tokenMint: string, amount: number, maxRetries = 3): Promise<string> {
  let retries = 0;
  let lastError: Error | null = null;
  
  // Determine the token symbol from the mint address
  const tokenSymbol = Object.keys(TOKEN_MINTS).find(key => TOKEN_MINTS[key] === tokenMint) || 'UNKNOWN';
  
  // Get the correct decimals for this token
  const decimals = TOKEN_DECIMALS[tokenSymbol] || 9;
  
  while (retries < maxRetries) {
    try {
      // Determine the base URL
      const baseUrl = process.env.VERCEL_URL 
        ? `https://${process.env.VERCEL_URL}` 
        : process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
      
      console.log(`Using base URL: ${baseUrl}`);
      
      // Call the token-transfer API route
      const response = await fetch(`${baseUrl}/api/token-transfer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          wallet,
          tokenMint,
          amount
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to execute token transfer');
      }
      
      return data.signature;
    } catch (error) {
      lastError = error as Error;
      retries++;
      
      console.error(`Failed to execute token transfer (attempt ${retries}/${maxRetries}):`, error);
      
      if (retries >= maxRetries) {
        throw new Error(`Token transfer failed after ${maxRetries} attempts: ${lastError.message}`);
      }
      
      // Exponential backoff
      const delay = Math.min(1000 * Math.pow(2, retries), 10000);
      console.log(`Retrying in ${delay/1000} seconds...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw new Error(`Token transfer failed: ${lastError?.message || 'Unknown error'}`);
}

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
    let records;
    try {
      // Look up by the redistributionId field
      records = await redistributionsTable.select({
        filterByFormula: `{redistributionId} = '${investmentId}'`
      }).all();
      
      if (records.length === 0) {
        // Try looking up by record ID as fallback
        try {
          const recordById = await redistributionsTable.find(investmentId);
          if (recordById) {
            console.log(`Found redistribution by record ID: ${investmentId}`);
            records = [recordById];
          } else {
            // Try looking up by investmentId field
            const investmentRecords = await redistributionsTable.select({
              filterByFormula: `{investmentId} = '${investmentId}'`
            }).all();
            
            if (investmentRecords.length > 0) {
              console.log(`Found redistribution by investmentId: ${investmentId}`);
              records = [investmentRecords[0]];
            } else {
              return NextResponse.json(
                { error: 'Investment not found' },
                { status: 404 }
              );
            }
          }
        } catch (idError) {
          console.error('Error finding redistribution by record ID:', idError);
          return NextResponse.json(
            { error: 'Investment not found' },
            { status: 404 }
          );
        }
      }
    } catch (findError) {
      console.error('Error finding redistribution record:', findError);
      return NextResponse.json(
        { error: 'Failed to find redistribution record', details: (findError as Error).message },
        { status: 500 }
      );
    }
    
    const record = records[0]; // Use the first matching record
    
    // Log record details for debugging
    console.log('Found redistribution record:', {
      id: record.id,
      redistributionId: record.get('redistributionId'),
      wallet: record.get('wallet'),
      claimed: record.get('claimed'),
      ubcAmount: record.get('ubcAmount'),
      computeAmount: record.get('computeAmount')
    });
    
    // Check if already claimed
    if (record.get('claimed')) {
      return NextResponse.json(
        { error: 'Rewards already claimed' },
        { status: 400 }
      );
    }
    
    // Get the reward amounts and wallet
    const token = record.get('token') || 'UBC'; // Get the token type
    const amount = parseFloat(record.get('amount') || '0'); // Get the amount
    
    // Set the appropriate token amount based on the token type
    let ubcAmount = 0;
    let computeAmount = 0;

    if (token.toUpperCase() === 'UBC') {
      ubcAmount = amount;
    } else if (token.toUpperCase() === 'COMPUTE') {
      computeAmount = amount;
    }

    console.log('Reward amounts:', {
      token,
      amount,
      ubcAmount,
      computeAmount
    });
    
    let wallet = record.get('wallet');
    
    // Initialize variables for wallet validation
    let walletSource = 'redistribution record';
    let walletValid = false;
    
    // Check if there's an investmentId field in the record
    const recordInvestmentId = record.get('investmentId');
    if (recordInvestmentId) {
      console.log(`Checking original investment with ID: ${recordInvestmentId}`);
      
      try {
        const investmentsTable = getTable('INVESTMENTS');
        
        // Try multiple approaches to find the investment
        let investmentRecord: any = null;
        
        // Approach 1: Try to find by record ID directly
        try {
          console.log(`Approach 1: Looking up by record ID: ${recordInvestmentId}`);
          const recordById = await investmentsTable.find(recordInvestmentId);
          if (recordById) {
            console.log(`Found investment by record ID: ${recordInvestmentId}`);
            investmentRecord = recordById;
          }
        } catch (idError) {
          console.error('Error finding investment by record ID:', idError);
        }
        
        // Approach 2: Try to find by investmentId field
        if (!investmentRecord) {
          try {
            console.log(`Approach 2: Looking up by investmentId field: ${recordInvestmentId}`);
            const records = await investmentsTable.select({
              filterByFormula: `{investmentId} = '${recordInvestmentId}'`
            }).all();
            
            if (records.length > 0) {
              console.log(`Found investment by investmentId field: ${recordInvestmentId}`);
              investmentRecord = records[0];
            }
          } catch (fieldError) {
            console.error('Error finding investment by investmentId field:', fieldError);
          }
        }
        
        // Approach 3: Try to find by wallet address if we have it
        if (!investmentRecord && wallet) {
          try {
            console.log(`Approach 3: Looking up by wallet address: ${wallet}`);
            const records = await investmentsTable.select({
              filterByFormula: `{wallet} = '${wallet}'`
            }).all();
            
            if (records.length > 0) {
              console.log(`Found investment by wallet address: ${wallet}`);
              investmentRecord = records[0];
            }
          } catch (walletError) {
            console.error('Error finding investment by wallet address:', walletError);
          }
        }
        
        // If we found an investment record, use it
        if (investmentRecord) {
          const originalWallet = investmentRecord.get('wallet');
          
          console.log('Found original investment:', {
            id: investmentRecord.id,
            investmentId: investmentRecord.get('investmentId'),
            originalWallet: originalWallet,
            redistributionWallet: wallet
          });
          
          if (originalWallet) {
            walletSource = 'original investment';
            
            // Always use the wallet from the original investment
            wallet = originalWallet;
            
            // Update the redistribution record with the correct wallet if needed
            if (record.get('wallet') !== originalWallet) {
              console.log('Updating redistribution record with correct wallet from investment');
              try {
                await redistributionsTable.update(record.id, {
                  wallet: originalWallet
                });
                console.log('Redistribution record updated with wallet from investment');
              } catch (updateError) {
                console.error('Error updating redistribution record:', updateError);
              }
            }
          }
        }
      } catch (investmentError) {
        console.error('Error finding original investment:', investmentError);
      }
    }
    
    console.log(`Using wallet from ${walletSource}: ${wallet}`);
    
    if (!wallet) {
      return NextResponse.json(
        { error: 'Wallet address not found' },
        { status: 400 }
      );
    }
    
    if (amount <= 0) {
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
      await redistributionsTable.update(record.id, {
        status: 'MANUAL_REVIEW_NEEDED',
        claimedAt: new Date().toISOString(),
        notes: `Automatic transfer failed: ${transferError}. Amounts: ${ubcAmount} UBC, ${computeAmount} COMPUTE to wallet ${wallet}`
      });
      
      // Send notification about failed transfer
      try {
        const botToken = "7728404959:AAHoVX05vxCQgzxqAJa5Em8i5HCLs2hJleo";
        const chatId = "-4680349356"; // Chat ID for claims
        
        const message = `❌ <b>Automatic Transfer Failed</b>\n\nFailed to transfer tokens to wallet <code>${wallet}</code>.\n\nAmounts:\n- UBC: ${ubcAmount}\n- COMPUTE: ${computeAmount}\n\nError: <code>${transferError}</code>\n\nRedistribution ID: <code>${investmentId}</code>\n\nPlease process this claim manually.`;
        
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
      await redistributionsTable.update(record.id, {
        claimed: true,
        claimedAt: new Date().toISOString(),
        status: 'COMPLETED',
        notes: `Automatic transfer completed. Transactions: ${JSON.stringify(transactions)}`
      });
      
      // Send notification about successful transfer
      try {
        const botToken = "7728404959:AAHoVX05vxCQgzxqAJa5Em8i5HCLs2hJleo";
        const chatId = "-4680349356"; // Chat ID for claims
        
        const transactionsText = transactions.map(tx => 
          `- ${tx.amount} ${tx.token}: <a href="https://solscan.io/tx/${tx.txSignature}">View Transaction</a>`
        ).join('\n');
        
        const message = `✅ <b>Automatic Transfer Completed</b>\n\nSuccessfully transferred tokens to wallet <code>${wallet}</code>.\n\nTransactions:\n${transactionsText}\n\nRedistribution ID: <code>${investmentId}</code>`;
        
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
    console.error('Error claiming rewards:', error);
    return NextResponse.json(
      { error: 'Failed to claim rewards', details: (error as Error).message },
      { status: 500 }
    );
  }
}
