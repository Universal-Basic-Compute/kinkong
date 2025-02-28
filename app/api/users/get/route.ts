export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { getTable } from '@/backend/src/airtable/tables';

export async function GET(request: NextRequest) {
  try {
    // Get wallet address from query params
    const { searchParams } = new URL(request.url);
    const wallet = searchParams.get('wallet');
    
    if (!wallet) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      );
    }
    
    // Get users table
    console.log('Getting USERS table from Airtable');
    const usersTable = getTable('USERS');
    console.log('Successfully got USERS table');
    
    // Find user with this wallet
    console.log('Searching for user with wallet:', wallet);
    const users = await usersTable.select({
      filterByFormula: `{wallet}='${wallet}'`
    }).firstPage();
    
    if (users.length === 0) {
      console.log('No user found with wallet:', wallet);
      return NextResponse.json({ user: null });
    }
    
    const user = users[0];
    console.log('Found user:', user.id);
    
    // Parse interests field which might be stored as comma-separated string
    let interests = user.get('interests');
    if (typeof interests === 'string') {
      interests = interests.split(',').map(i => i.trim());
    }
    
    // Return user data
    return NextResponse.json({
      user: {
        id: user.id,
        experience: user.get('experience') || '',
        interests: interests || [],
        incomeSource: user.get('incomeSource') || '',
        riskTolerance: user.get('riskTolerance') || ''
      }
    });
    
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
