export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { broadcastToClients } from './shared';

export async function POST(request: NextRequest) {
  try {
    // Verify API key
    const authHeader = request.headers.get('Authorization');
    const apiKey = process.env.NOTIFICATION_API_KEY;
    
    if (!authHeader || !apiKey || !authHeader.startsWith('Bearer ') || authHeader.slice(7) !== apiKey) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Get notification data
    const data = await request.json();
    
    // Validate required fields
    if (!data.type || !data.data) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    console.log(`Broadcasting ${data.type} notification for ${data.data.token || 'unknown token'}`);
    
    // Broadcast to all connected clients
    broadcastToClients({
      type: 'SERVER_PUSH',
      data: data
    });
    
    return NextResponse.json({ success: true });
    
  } catch (error) {
    console.error('Error broadcasting notification:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
