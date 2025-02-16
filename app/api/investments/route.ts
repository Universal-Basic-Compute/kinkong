import { getInvestments } from '@/backend/src/airtable/investments';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const investments = await getInvestments();
    return NextResponse.json(investments);
  } catch (error) {
    console.error('Failed to fetch investments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch investments' },
      { status: 500 }
    );
  }
}
