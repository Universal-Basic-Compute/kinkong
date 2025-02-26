import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

export async function GET(request: Request) {
  try {
    // Verify cron secret if needed
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET_KEY}`) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Get limit parameter (default to 10)
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    
    console.log(`Starting trade chart generation for ${limit} recent signals...`);
    
    // Execute the Python script
    const { stdout, stderr } = await execPromise(`python scripts/generate_trade_chart.py`);
    
    if (stderr && !stderr.includes('UserWarning')) {
      console.error('Python script error:', stderr);
      return NextResponse.json(
        { error: 'Trade chart generation failed', details: stderr },
        { status: 500 }
      );
    }
    
    console.log('Trade chart generation output:', stdout);
    
    return NextResponse.json({ 
      success: true, 
      message: 'Trade charts generated successfully',
      output: stdout 
    });
    
  } catch (error) {
    console.error('Failed to generate trade charts:', error);
    return NextResponse.json(
      { error: 'Failed to generate trade charts', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
