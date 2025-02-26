import { getTable } from '@/backend/src/airtable/tables';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { token, amount, wallet, solscanUrl } = body;
    
    if (!token || !amount || !wallet || !solscanUrl) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    const table = getTable('INVESTMENTS');
    
    // Generate a unique investment ID
    const investmentId = `inv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    
    // Current timestamp for date
    const date = new Date().toISOString();
    
    const records = await table.create([
      {
        fields: {
          investmentId,
          token,
          amount,
          wallet,
          solscanUrl,
          date
        }
      }
    ]);
    
    return NextResponse.json({ 
      success: true, 
      investment: records[0] 
    });
    
  } catch (error) {
    console.error('Error creating investment:', error);
    return NextResponse.json(
      { error: 'Failed to create investment' },
      { status: 500 }
    );
  }
}
