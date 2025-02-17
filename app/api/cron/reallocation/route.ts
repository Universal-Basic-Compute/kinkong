import { executeReallocation } from '@/backend/src/strategy/reallocation';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    console.log('Starting scheduled reallocation...');
    
    const result = await executeReallocation();
    
    console.log('Reallocation completed:', {
      sentiment: result.sentiment,
      structure: result.structure,
      orders: result.orders.length
    });

    return NextResponse.json({
      success: true,
      result
    });
  } catch (error) {
    console.error('Reallocation failed:', error);
    return NextResponse.json(
      { error: 'Reallocation failed' },
      { status: 500 }
    );
  }
}
