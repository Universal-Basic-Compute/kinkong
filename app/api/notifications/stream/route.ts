export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest } from 'next/server';

// Store for active connections with last activity timestamp
const clients = new Map<ReadableStreamDefaultController<Uint8Array>, number>();

// Function to broadcast to all connected clients
export function broadcastToClients(data: any) {
  const eventString = `data: ${JSON.stringify(data)}\n\n`;
  const encoder = new TextEncoder();
  const encodedEvent = encoder.encode(eventString);
  
  let activeClients = 0;
  const now = Date.now();
  
  // Remove stale clients (no activity for more than 2 minutes)
  for (const [client, lastActivity] of clients.entries()) {
    if (now - lastActivity > 120000) {
      console.log('Removing stale client connection');
      clients.delete(client);
    }
  }
  
  // Send to remaining clients
  clients.forEach((lastActivity, client: ReadableStreamDefaultController<Uint8Array>) => {
    try {
      client.enqueue(encodedEvent);
      // Update last activity timestamp
      clients.set(client, now);
      activeClients++;
    } catch (err) {
      console.error('Error sending event to client:', err);
      // Remove failed client
      clients.delete(client);
    }
  });
  
  console.log(`Event broadcast to ${activeClients} clients`);
}

export async function GET(request: NextRequest) {
  // Create a new stream
  const stream = new ReadableStream({
    start(controller: ReadableStreamDefaultController<Uint8Array>) {
      // Add this client to the map with current timestamp
      clients.set(controller, Date.now());
      
      // Send initial connection message
      const encoder = new TextEncoder();
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({type: 'CONNECTED'})}\n\n`));
      
      // Keep-alive interval
      const keepAliveInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: keep-alive\n\n`));
          // Update last activity timestamp
          clients.set(controller, Date.now());
        } catch (e) {
          clearInterval(keepAliveInterval);
          clients.delete(controller);
        }
      }, 30000); // Send keep-alive every 30 seconds
      
      // Remove client when connection closes
      request.signal.addEventListener('abort', () => {
        clearInterval(keepAliveInterval);
        clients.delete(controller);
        console.log(`Client disconnected. ${clients.size} clients remaining.`);
      });
      
      console.log(`New client connected. Total clients: ${clients.size}`);
      
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
