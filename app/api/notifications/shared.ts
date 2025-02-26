// Shared state for notification system
export const clients = new Map<ReadableStreamDefaultController<Uint8Array>, number>();

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
