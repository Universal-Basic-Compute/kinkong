import { NextResponse } from 'next/server';
import { calculateClosedSignals } from '@/scripts/calculate-closed-signals';

export async function GET(request: Request) {
  try {
    // Verify cron secret if needed
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET_KEY}`) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    console.log('Starting scheduled signal calculation...');
    
    await calculateClosedSignals();
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to calculate signals:', error);
    return NextResponse.json(
      { error: 'Failed to calculate signals' },
      { status: 500 }
    );
  }
}
