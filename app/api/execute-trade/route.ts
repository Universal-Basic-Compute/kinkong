import { NextResponse } from 'next/server';
import { executeTrade } from '@/backend/src/utils/jupiter_trade';
import { spawn } from 'child_process';
import path from 'path';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Check if this is a token-maximizer strategy request
    if (body.strategy === 'token-maximizer') {
      // Validate token-maximizer parameters
      if (!body.wallet) {
        return NextResponse.json(
          { error: 'Missing wallet parameter for token-maximizer strategy' },
          { status: 400 }
        );
      }
        
      // Execute token-maximizer strategy by calling Python script
      const result = await executeTokenMaximizerStrategy({
        wallet: body.wallet,
        ubcScore: body.ubcScore, // Optional: manual override
        computeScore: body.computeScore, // Optional: manual override
        dryRun: body.dryRun === true  // Add dry-run parameter
      });
      
      return NextResponse.json(result);
    } else {
      // Regular trade execution
      // Validate request parameters
      if (!body.inputToken || !body.outputToken || !body.amount || !body.wallet) {
        return NextResponse.json(
          { error: 'Missing required parameters' },
          { status: 400 }
        );
      }

      // Execute trade
      const result = await executeTrade({
        inputToken: body.inputToken,
        outputToken: body.outputToken,
        amount: body.amount,
        slippage: body.slippage || 0.01,
        wallet: body.wallet
      });

      return NextResponse.json(result);
    }
    
  } catch (error) {
    console.error('Trade execution failed:', error);
    return NextResponse.json(
      { error: 'Trade execution failed' },
      { status: 500 }
    );
  }
}

// Function to execute token-maximizer strategy by calling Python script
async function executeTokenMaximizerStrategy(params: {
  wallet: string;
  ubcScore?: number;
  computeScore?: number;
  dryRun?: boolean;
}): Promise<any> {
  return new Promise((resolve, reject) => {
    console.log(`Executing token-maximizer strategy${params.dryRun ? ' (DRY RUN)' : ''}`);
    
    // Get the project root directory
    const projectRoot = process.cwd();
    
    // Construct path to Python script
    const scriptPath = path.join(projectRoot, 'engine', 'trades.py');
    
    // Prepare command line arguments
    const args = [
      scriptPath,
      '--action', 'token-maximizer'
    ];
    
    // Add manual scores only if provided
    if (params.ubcScore !== undefined) {
      args.push('--ubc-score', params.ubcScore.toString());
      console.log(`Using manual UBC score: ${params.ubcScore}`);
    }
    
    if (params.computeScore !== undefined) {
      args.push('--compute-score', params.computeScore.toString());
      console.log(`Using manual COMPUTE score: ${params.computeScore}`);
    }
    
    // Add dry-run flag if needed
    if (params.dryRun) {
      args.push('--dry-run');
    }
    
    // Spawn Python process
    const pythonProcess = spawn('python', args);
    
    let stdout = '';
    let stderr = '';
    
    // Collect stdout data
    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
      console.log(`Python stdout: ${data}`);
    });
    
    // Collect stderr data
    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
      console.error(`Python stderr: ${data}`);
    });
    
    // Handle process completion
    pythonProcess.on('close', (code) => {
      console.log(`Python process exited with code ${code}`);
      
      if (code === 0) {
        // Try to parse JSON output if available
        try {
          const jsonOutput = JSON.parse(stdout);
          resolve({
            success: true,
            message: `Token-maximizer strategy ${params.dryRun ? 'simulation' : 'execution'} completed`,
            data: jsonOutput,
            isDryRun: params.dryRun === true
          });
        } catch (e) {
          // If not JSON, just return the raw output
          resolve({
            success: true,
            message: `Token-maximizer strategy ${params.dryRun ? 'simulation' : 'execution'} completed`,
            output: stdout,
            isDryRun: params.dryRun === true
          });
        }
      } else {
        resolve({
          success: false,
          message: `Token-maximizer strategy ${params.dryRun ? 'simulation' : 'execution'} failed`,
          error: stderr || `Process exited with code ${code}`,
          isDryRun: params.dryRun === true
        });
      }
    });
    
    // Handle process errors
    pythonProcess.on('error', (err) => {
      console.error('Failed to start Python process:', err);
      reject({
        success: false,
        message: 'Failed to start token-maximizer process',
        error: err.message,
        isDryRun: params.dryRun === true
      });
    });
  });
}
