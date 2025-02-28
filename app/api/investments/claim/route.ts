import { NextRequest, NextResponse } from 'next/server';
import { getTable } from '@/backend/src/airtable/tables';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execPromise = promisify(exec);

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
    
    // Execute the transfer script
    const scriptPath = path.join(process.cwd(), 'engine', 'execute_transfer.py');
    
    try {
      console.log(`Executing transfer: ${scriptPath} ${wallet} UBC ${ubcAmount}`);
      const { stdout, stderr } = await execPromise(`python "${scriptPath}" "${wallet}" UBC ${ubcAmount}`);
      
      console.log('Transfer script output:', stdout);
      
      if (stderr && !stdout.includes('Transaction signature:')) {
        console.error('Transfer script error:', stderr);
        throw new Error(stderr);
      }
      
      // Extract transaction signature from stdout
      const signatureMatch = stdout.match(/Transaction signature: ([a-zA-Z0-9]+)/);
      const signature = signatureMatch ? signatureMatch[1] : 'unknown';
      
      if (!signature || signature === 'unknown') {
        console.warn('Could not extract transaction signature from output');
      }
      
      // Update the record to mark as claimed
      await redistributionsTable.update(investmentId, {
        claimed: true,
        claimedAt: new Date().toISOString(),
        claimTxSignature: signature
      });
      
      return NextResponse.json({
        success: true,
        message: 'Rewards claimed successfully',
        signature,
        amount: ubcAmount,
        token: 'UBC'
      });
    } catch (error) {
      console.error('Error executing transfer:', error);
      return NextResponse.json(
        { error: 'Failed to execute transfer', details: (error as Error).message },
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
