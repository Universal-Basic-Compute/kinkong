export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { getTable } from '@/backend/src/airtable/tables';

export async function GET(request: NextRequest) {
  try {
    // Get wallet from query params
    const { searchParams } = new URL(request.url);
    const wallet = searchParams.get('wallet');
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    
    if (!wallet) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      );
    }
    
    // Get messages table
    const messagesTable = getTable('MESSAGES');
    
    // Query for messages with this wallet
    const messages = await messagesTable.select({
      filterByFormula: `{wallet}='${wallet}'`,
      sort: [{ field: 'createdAt', direction: 'desc' }],
      maxRecords: limit
    }).firstPage();
    
    // Format the messages
    const formattedMessages = messages.map(record => ({
      id: record.id,
      role: record.get('role'),
      content: record.get('content'),
      createdAt: record.get('createdAt'),
      screenshot: record.get('screenshot'),
      wallet: record.get('wallet')
    })).reverse(); // Reverse to get chronological order
    
    return NextResponse.json({
      success: true,
      messages: formattedMessages
    });
    
  } catch (error) {
    console.error('Error fetching messages:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
