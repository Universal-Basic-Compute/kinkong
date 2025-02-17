import { executeReallocation } from '@/backend/src/strategy/reallocation';
import { NextResponse } from 'next/server';

export async function POST() {
  try {
    const result = await executeReallocation();
    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to execute reallocation:', error);
    return NextResponse.json(
      { error: 'Failed to execute reallocation' },
      { status: 500 }
    );
  }
}
