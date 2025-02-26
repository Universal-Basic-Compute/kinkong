export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { getTable } from '@/backend/src/airtable/tables';

export async function GET(request: NextRequest) {
  try {
    // Optional: Verify API key if you want to restrict access
    const authHeader = request.headers.get('Authorization');
    const apiKey = process.env.NOTIFICATION_API_KEY;
    
    if (apiKey && (!authHeader || !authHeader.startsWith('Bearer ') || authHeader.slice(7) !== apiKey)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Calculate timestamp for 1 hour ago
    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);
    const oneHourAgoISO = oneHourAgo.toISOString();
    
    console.log(`Fetching signals created after ${oneHourAgoISO}`);
    
    // Get signals table
    const signalsTable = getTable('SIGNALS');
    
    // Query for HIGH confidence BUY signals from the last hour
    const records = await signalsTable.select({
      filterByFormula: `AND(
        {type}='BUY',
        {confidence}='HIGH',
        IS_AFTER({createdAt}, '${oneHourAgoISO}')
      )`,
      sort: [{ field: 'createdAt', direction: 'desc' }],
      maxRecords: 1
    }).firstPage();
    
    if (records.length === 0) {
      return NextResponse.json(
        { message: 'No recent signals found' },
        { status: 404 }
      );
    }
    
    // Get the latest signal
    const latestSignal = records[0];
    
    // Format the response
    const response = {
      type: 'SIGNAL_CREATED',
      data: {
        id: latestSignal.id,
        token: latestSignal.get('token'),
        direction: latestSignal.get('type'),
        timeframe: latestSignal.get('timeframe'),
        entryPrice: latestSignal.get('entryPrice'),
        targetPrice: latestSignal.get('targetPrice'),
        stopLoss: latestSignal.get('stopLoss'),
        confidence: latestSignal.get('confidence'),
        reason: latestSignal.get('reason'),
        createdAt: latestSignal.get('createdAt')
      }
    };
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('Error fetching latest signal:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { getTable } from '@/backend/src/airtable/tables';

export async function GET(request: NextRequest) {
  try {
    // Optional: Verify API key if provided, but don't require it
    const authHeader = request.headers.get('Authorization');
    const apiKey = process.env.NOTIFICATION_API_KEY;
    
    // Only check auth if we have an API key configured and the request includes auth
    if (apiKey && authHeader && authHeader.startsWith('Bearer ') && authHeader.slice(7) !== apiKey) {
      return NextResponse.json(
        { error: 'Invalid API key' },
        { status: 401 }
      );
    }
    
    // Calculate timestamp for 1 hour ago
    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);
    const oneHourAgoISO = oneHourAgo.toISOString();
    
    console.log(`Fetching signals created after ${oneHourAgoISO}`);
    
    // Get signals table
    const signalsTable = getTable('SIGNALS');
    
    // Query for HIGH confidence BUY signals from the last hour
    const records = await signalsTable.select({
      filterByFormula: `AND(
        {type}='BUY',
        {confidence}='HIGH',
        IS_AFTER({createdAt}, '${oneHourAgoISO}')
      )`,
      sort: [{ field: 'createdAt', direction: 'desc' }],
      maxRecords: 1
    }).firstPage();
    
    if (records.length === 0) {
      return NextResponse.json(
        { message: 'No recent signals found' },
        { status: 404 }
      );
    }
    
    // Get the latest signal
    const latestSignal = records[0];
    
    // Format the response
    const response = {
      type: 'SIGNAL_CREATED',
      data: {
        id: latestSignal.id,
        token: latestSignal.get('token'),
        direction: latestSignal.get('type'),
        timeframe: latestSignal.get('timeframe'),
        entryPrice: latestSignal.get('entryPrice'),
        targetPrice: latestSignal.get('targetPrice'),
        stopLoss: latestSignal.get('stopLoss'),
        confidence: latestSignal.get('confidence'),
        reason: latestSignal.get('reason'),
        createdAt: latestSignal.get('createdAt')
      }
    };
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('Error fetching latest signal:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
