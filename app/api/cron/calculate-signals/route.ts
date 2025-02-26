import { NextResponse } from 'next/server';
import { calculateClosedSignals } from '@/scripts/calculate-closed-signals';
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

    // Get implementation type from query params (default to 'ts')
    const { searchParams } = new URL(request.url);
    const implementation = searchParams.get('implementation') || 'ts';

    if (implementation === 'py') {
      console.log('Starting scheduled Python signal calculation...');
      
      // Execute the Python script
      const { stdout, stderr } = await execPromise('python scripts/calculate_closed_signals.py');
      
      if (stderr) {
        console.error('Python script error:', stderr);
        return NextResponse.json(
          { error: 'Python script execution failed', details: stderr },
          { status: 500 }
        );
      }
      
      console.log('Python script output:', stdout);
      return NextResponse.json({ success: true, implementation: 'python', output: stdout });
    } else {
      console.log('Starting scheduled TypeScript signal calculation...');
      
      await calculateClosedSignals();
      
      return NextResponse.json({ success: true, implementation: 'typescript' });
    }
  } catch (error) {
    console.error('Failed to calculate signals:', error);
    return NextResponse.json(
      { error: 'Failed to calculate signals' },
      { status: 500 }
    );
  }
}
