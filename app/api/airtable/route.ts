import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json(
    { error: 'Please specify a table name' },
    { 
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    }
  );
}
