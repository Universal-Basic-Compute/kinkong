export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { clients } from '../shared';

// Export clients for debugging
export { clients };

export async function GET(request: NextRequest) {
  // Get client ID from query param or generate a new one
  const clientId = request.nextUrl.searchParams.get('clientId') || `client-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  
  console.log(`Stream endpoint called by client ${clientId}. Current clients: ${clients.size}`);
  
  // Check if this client already exists and remove it to avoid duplicates
  for (const [controller, data] of clients.entries()) {
    if (data.clientId === clientId) {
      console.log(`Removing existing connection for client ${clientId}`);
      clients.delete(controller);
    }
  }
  
  // Create a new stream
  const stream = new ReadableStream({
    start(controller: ReadableStreamDefaultController<Uint8Array>) {
      // Add this client to the map with current timestamp and clientId
      clients.set(controller, { timestamp: Date.now(), clientId });
      console.log(`Client added. New client count: ${clients.size}`);
      
      // Send initial connection message with clientId
      const encoder = new TextEncoder();
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({
        type: 'CONNECTED',
        clientId: clientId
      })}\n\n`));
      
      // Keep-alive interval
      const keepAliveInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: keep-alive\n\n`));
          // Update last activity timestamp
          const clientData = clients.get(controller);
          if (clientData) {
            clients.set(controller, { ...clientData, timestamp: Date.now() });
          }
        } catch (e) {
          clearInterval(keepAliveInterval);
          clients.delete(controller);
          console.log(`Client ${clientId} removed due to keep-alive error. Remaining clients: ${clients.size}`);
        }
      }, 30000); // Send keep-alive every 30 seconds
      
      // Remove client when connection closes
      request.signal.addEventListener('abort', () => {
        clearInterval(keepAliveInterval);
        clients.delete(controller);
        console.log(`Client ${clientId} disconnected. ${clients.size} clients remaining.`);
      });
      
      console.log(`New client ${clientId} connected. Total clients: ${clients.size}`);
      
      // Log active connections every minute
      const logInterval = setInterval(() => {
        console.log(`Active SSE connections: ${clients.size}`);
      }, 60000);
      
      // Clear log interval when connection closes
      request.signal.addEventListener('abort', () => {
        clearInterval(logInterval);
      });
    }
  });

  // Return the stream with appropriate headers for SSE
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    }
  });
}
