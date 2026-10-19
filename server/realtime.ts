import { Request, Response } from 'express';

export interface ServerSyncEvent {
  id: string;
  type:
    | 'REQUEST_CREATED'
    | 'REQUEST_UPDATED'
    | 'REQUEST_RESOLVED'
    | 'TASK_CREATED'
    | 'TASK_UPDATED'
    | 'SHELTER_UPDATED'
    | 'RESOURCE_OFFER_UPDATED'
    | 'INCIDENT_UPDATED'
    | 'PING';
  entityId?: string;
  data?: any;
  timestamp: string;
}

const connectedClients = new Set<Response>();

export function handleEventStream(req: Request, res: Response) {
  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  // Send initial connection event
  const initialEvent: ServerSyncEvent = {
    id: `evt-${Date.now()}`,
    type: 'PING',
    timestamp: new Date().toISOString(),
    data: { message: 'Connected to ResQLink real-time event bus' },
  };

  res.write(`data: ${JSON.stringify(initialEvent)}\n\n`);
  connectedClients.add(res);

  // Clean up on disconnect
  req.on('close', () => {
    connectedClients.delete(res);
  });
}

export function broadcastEvent(
  type: ServerSyncEvent['type'],
  data?: any,
  entityId?: string
) {
  const event: ServerSyncEvent = {
    id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    entityId,
    data,
    timestamp: new Date().toISOString(),
  };

  const payload = `data: ${JSON.stringify(event)}\n\n`;

  for (const client of connectedClients) {
    try {
      client.write(payload);
    } catch {
      connectedClients.delete(client);
    }
  }
}

export function getConnectedClientCount(): number {
  return connectedClients.size;
}

// Keep-alive ping interval (every 30 seconds)
if (typeof setInterval !== 'undefined') {
  const interval = setInterval(() => {
    if (connectedClients.size === 0) return;
    const pingPayload = `data: ${JSON.stringify({
      id: `ping-${Date.now()}`,
      type: 'PING',
      timestamp: new Date().toISOString(),
    })}\n\n`;

    for (const client of connectedClients) {
      try {
        client.write(pingPayload);
      } catch {
        connectedClients.delete(client);
      }
    }
  }, 30000);

  // Unref to prevent preventing clean process exit in test scripts
  if (interval.unref) {
    interval.unref();
  }
}
