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
      if (body.ubcScore === undefined || body.computeScore === undefined || !body.wallet) {
        return NextResponse.json(
          { error: 'Missing required parameters for token-maximizer strategy' },
          { status: 400 }
        );
      }
      
      // Execute token-maximizer strategy by calling Python script
      const result = await executeTokenMaximizerStrategy({
        ubcScore: body.ubcScore,
        computeScore: body.computeScore,
        wallet: body.wallet
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
  ubcScore: number;
  computeScore: number;
  wallet: string;
}): Promise<any> {
  return new Promise((resolve, reject) => {
    console.log(`Executing token-maximizer strategy with UBC score: ${params.ubcScore}, COMPUTE score: ${params.computeScore}`);
    
    // Get the project root directory
    const projectRoot = process.cwd();
    
    // Construct path to Python script
    const scriptPath = path.join(projectRoot, 'engine', 'trades.py');
    
    // Spawn Python process
    const pythonProcess = spawn('python', [
      scriptPath,
      '--action', 'token-maximizer',
      '--ubc-score', params.ubcScore.toString(),
      '--compute-score', params.computeScore.toString()
    ]);
    
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
            message: 'Token-maximizer strategy execution completed',
            data: jsonOutput
          });
        } catch (e) {
          // If not JSON, just return the raw output
          resolve({
            success: true,
            message: 'Token-maximizer strategy execution completed',
            output: stdout
          });
        }
      } else {
        resolve({
          success: false,
          message: 'Token-maximizer strategy execution failed',
          error: stderr || `Process exited with code ${code}`
        });
      }
    });
    
    // Handle process errors
    pythonProcess.on('error', (err) => {
      console.error('Failed to start Python process:', err);
      reject({
        success: false,
        message: 'Failed to start token-maximizer process',
        error: err.message
      });
    });
  });
}
