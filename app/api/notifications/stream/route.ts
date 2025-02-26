import { NextRequest } from 'next/server';

// Store for active connections
const clients = new Set<ReadableStreamController<Uint8Array>>();

// Function to broadcast to all connected clients
export function broadcastToClients(data: any) {
  const eventString = `data: ${JSON.stringify(data)}\n\n`;
  const encoder = new TextEncoder();
  const encodedEvent = encoder.encode(eventString);
  
  let activeClients = 0;
  clients.forEach(client => {
    try {
      client.enqueue(encodedEvent);
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
    start(controller) {
      // Add this client to the set
      clients.add(controller);
      
      // Send initial connection message
      const encoder = new TextEncoder();
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({type: 'CONNECTED'})}\n\n`));
      
      // Keep-alive interval
      const keepAliveInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: keep-alive\n\n`));
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
