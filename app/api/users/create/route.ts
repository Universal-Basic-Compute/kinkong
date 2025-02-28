export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { getTable } from '@/backend/src/airtable/tables';

export async function POST(request: NextRequest) {
  try {
    const userData = await request.json();
    console.log('Received user data in API:', userData);
    
    // Validate required fields
    if (!userData.experience || !userData.interests) {
      console.error('Missing required fields:', {
        experience: !!userData.experience,
        interests: !!userData.interests
      });
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // Get users table
    console.log('Getting USERS table from Airtable');
    const usersTable = getTable('USERS');
    console.log('Successfully got USERS table');
    
    // Define a type for the user record
    interface UserRecord {
      id: string;
      fields: any;
      get: (field: string) => any;
    }
    
    // Check if user with this wallet already exists
    let existingUser: UserRecord | null = null;
    if (userData.wallet) {
      console.log('Checking for existing user with wallet:', userData.wallet);
      const existingUsers = await usersTable.select({
        filterByFormula: `{wallet}='${userData.wallet}'`
      }).firstPage();
      
      if (existingUsers.length > 0) {
        existingUser = existingUsers[0];
        console.log('Found existing user:', existingUser.id);
      }
    }
    
    if (existingUser) {
      // Update existing user
      console.log('Updating existing user:', existingUser.id);
      const updatedUser = await usersTable.update([
        {
          id: existingUser.id,
          fields: {
            experience: userData.experience,
            interests: Array.isArray(userData.interests) ? userData.interests.join(',') : userData.interests,
            incomeSource: userData.incomeSource,
            riskTolerance: userData.riskTolerance,
            onboardingCompleted: true,
            onboardingCompletedAt: userData.onboardingCompletedAt || new Date().toISOString()
          }
        }
      ]);
      
      console.log('User updated successfully:', updatedUser[0].id);
      return NextResponse.json({
        success: true,
        user: updatedUser[0].id,
        updated: true
      });
    } else {
      // Create new user
      console.log('Creating new user with data:', {
        wallet: userData.wallet || null,
        experience: userData.experience,
        interests: Array.isArray(userData.interests) ? userData.interests.join(',') : userData.interests,
        incomeSource: userData.incomeSource,
        riskTolerance: userData.riskTolerance
      });
      
      const newUser = await usersTable.create([
        {
          fields: {
            wallet: userData.wallet || null,
            experience: userData.experience,
            interests: Array.isArray(userData.interests) ? userData.interests.join(',') : userData.interests,
            incomeSource: userData.incomeSource,
            riskTolerance: userData.riskTolerance,
            onboardingCompleted: true,
            onboardingCompletedAt: userData.onboardingCompletedAt || new Date().toISOString(),
            createdAt: new Date().toISOString()
          }
        }
      ]);
      
      console.log('New user created successfully:', newUser[0].id);
      return NextResponse.json({
        success: true,
        user: newUser[0].id,
        created: true
      });
    }
    
  } catch (error) {
    console.error('Error creating/updating user:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
