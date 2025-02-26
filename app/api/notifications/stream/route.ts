export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { clients } from '../shared';

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
