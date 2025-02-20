import { NextResponse } from 'next/server';
import { analyzeMarketSentiment } from '@/backend/src/strategy/snapshots';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    // Verify cron secret if needed
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET_KEY}`) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    console.log('Starting scheduled market sentiment analysis...');
    
    const result = await analyzeMarketSentiment();
    
    console.log('Market sentiment analysis completed:', {
      sentiment: result.sentiment,
      confidence: result.confidence,
      metrics: result.metrics
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to analyze market sentiment:', error);
    return NextResponse.json(
      { error: 'Failed to analyze market sentiment' },
      { status: 500 }
    );
  }
}
