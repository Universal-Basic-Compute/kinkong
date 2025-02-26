// Shared state for notification system
export const clients = new Map<ReadableStreamDefaultController<Uint8Array>, number>();

export function broadcastToClients(data: any) {
  console.log(`Broadcasting to clients. Current client count: ${clients.size}`);
  
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
  
  console.log(`After removing stale clients: ${clients.size} clients remaining`);
  
  // Send to remaining clients
  clients.forEach((lastActivity, client: ReadableStreamDefaultController<Uint8Array>) => {
    try {
      console.log('Sending event to client...');
      client.enqueue(encodedEvent);
      // Update last activity timestamp
      clients.set(client, now);
      activeClients++;
      console.log('Event sent successfully');
    } catch (err) {
      console.error('Error sending event to client:', err);
      // Remove failed client
      clients.delete(client);
    }
  });
  
  console.log(`Event broadcast to ${activeClients} clients`);
  return activeClients;
}
