export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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

    console.log('Starting Python signal performance analysis...');
    
    // Execute the Python script
    const { stdout, stderr } = await execPromise('python engine/utils/calculate_performance_metrics.py');
    
    if (stderr) {
      console.error('Python script error:', stderr);
      return NextResponse.json(
        { error: 'Python script execution failed', details: stderr },
        { status: 500 }
      );
    }
    
    console.log('Python script output:', stdout);
    return NextResponse.json({ 
      success: true, 
      message: 'Signal performance metrics calculated and saved to Airtable successfully',
      output: stdout 
    });
  } catch (error) {
    console.error('Failed to calculate signal performance metrics:', error);
    return NextResponse.json(
      { error: 'Failed to calculate signal performance metrics' },
      { status: 500 }
    );
  }
}
