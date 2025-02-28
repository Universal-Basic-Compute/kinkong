export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { getTable } from '@/backend/src/airtable/tables';

export async function POST(request: NextRequest) {
  try {
    const userData = await request.json();
    
    // Validate required fields
    if (!userData.experience || !userData.interests || !userData.goals || !userData.timeframe) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // Get users table
    const usersTable = getTable('USERS');
    
    // Check if user with this wallet already exists
    let existingUser = null;
    if (userData.wallet) {
      const existingUsers = await usersTable.select({
        filterByFormula: `{wallet}='${userData.wallet}'`
      }).firstPage();
      
      if (existingUsers.length > 0) {
        existingUser = existingUsers[0];
      }
    }
    
    if (existingUser) {
      // Update existing user
      const updatedUser = await usersTable.update([
        {
          id: existingUser.id,
          fields: {
            experience: userData.experience,
            interests: userData.interests,
            goals: userData.goals,
            timeframe: userData.timeframe,
            onboardingCompleted: true,
            onboardingCompletedAt: userData.onboardingCompletedAt || new Date().toISOString()
          }
        }
      ]);
      
      return NextResponse.json({
        success: true,
        user: updatedUser[0].id,
        updated: true
      });
    } else {
      // Create new user
      const newUser = await usersTable.create([
        {
          fields: {
            wallet: userData.wallet || null,
            experience: userData.experience,
            interests: userData.interests,
            goals: userData.goals,
            timeframe: userData.timeframe,
            onboardingCompleted: true,
            onboardingCompletedAt: userData.onboardingCompletedAt || new Date().toISOString(),
            createdAt: new Date().toISOString()
          }
        }
      ]);
      
      return NextResponse.json({
        success: true,
        user: newUser[0].id,
        created: true
      });
    }
    
  } catch (error) {
    console.error('Error creating/updating user:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
