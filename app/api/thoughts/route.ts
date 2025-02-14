import { getLastThoughts } from '@/backend/src/airtable/thoughts';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const thoughts = await getLastThoughts(50);
    return NextResponse.json(thoughts);
  } catch (error) {
    console.error('Failed to fetch thoughts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch thoughts' },
      { status: 500 }
    );
  }
}
