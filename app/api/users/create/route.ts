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
      try {
        const updatedUser = await usersTable.update(
          existingUser.id,
          {
            experience: userData.experience,
            interests: Array.isArray(userData.interests) ? userData.interests.join(',') : userData.interests,
            incomeSource: userData.incomeSource,
            riskTolerance: userData.riskTolerance,
            onboardingCompleted: true,
            onboardingCompletedAt: userData.onboardingCompletedAt || new Date().toISOString()
          }
        );
        
        // Check if updatedUser exists (it's a single record, not an array)
        if (!updatedUser) {
          console.error('Failed to update user: No user record returned');
          return NextResponse.json({
            error: 'Failed to update user record',
            details: 'No user record returned from Airtable'
          }, { status: 500 });
        }
        
        // Safely access the ID directly from the record
        const userId = updatedUser.id;
        console.log('User updated successfully:', userId);
        
        return NextResponse.json({
          success: true,
          user: userId,
          updated: true
        });
      } catch (updateError) {
        console.error('Error updating existing user:', updateError);
        return NextResponse.json({ 
          error: 'Failed to update user',
          details: updateError instanceof Error ? updateError.message : 'Unknown error'
        }, { status: 500 });
      }
    } else {
      // Create new user
      console.log('Creating new user with data:', {
        wallet: userData.wallet || null,
        experience: userData.experience,
        interests: Array.isArray(userData.interests) ? userData.interests.join(',') : userData.interests,
        incomeSource: userData.incomeSource,
        riskTolerance: userData.riskTolerance
      });
      
      try {
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
        
        // Check if newUser exists and has at least one record
        if (!newUser || newUser.length === 0) {
          console.error('Failed to create user: No user record returned');
          return NextResponse.json({
            error: 'Failed to create user record',
            details: 'No user record returned from Airtable'
          }, { status: 500 });
        }
        
        console.log('New user created successfully:', newUser[0].id);
        return NextResponse.json({
          success: true,
          user: newUser[0].id,
          created: true
        });
      } catch (createError) {
        console.error('Error creating new user:', createError);
        return NextResponse.json({ 
          error: 'Failed to create user',
          details: createError instanceof Error ? createError.message : 'Unknown error'
        }, { status: 500 });
      }
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
