import 'dotenv/config';
import { WebSocketServer, WebSocket } from 'ws';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { EventParser } from './event-parser.js';
import { getSessions, getToolCalls } from './database.js';
import { GatewayClient } from './gateway-client.js';
import { ClientCommand, ServerEvent, RawGatewayEvent } from './types.js';

const BRIDGE_PORT = parseInt(process.env.BRIDGE_PORT || '3001');
const GATEWAY_URL = process.env.OPENCLAW_GATEWAY_URL || 'ws://127.0.0.1:18789';

// Load token from credentials file or env
function loadGatewayToken(): string {
  // Try env first
  if (process.env.OPENCLAW_TOKEN) {
    return process.env.OPENCLAW_TOKEN;
  }
  
  // Try credentials file
  try {
    const credsPath = resolve(process.env.HOME || '~', '.config/moltbook/credentials.json');
    const creds = JSON.parse(readFileSync(credsPath, 'utf-8'));
    return creds.api_key || creds.token || '';
  } catch (err) {
    console.warn('[Bridge] Could not load credentials file, using empty token');
    return '';
  }
}

// Store connected browser clients
const clients: Set<WebSocket> = new Set();
const eventParser = new EventParser();

// WebSocket Server for browsers
const wss = new WebSocketServer({ port: BRIDGE_PORT });

console.log(`🔌 Bridge Server starting on port ${BRIDGE_PORT}...`);

wss.on('connection', (ws: WebSocket) => {
  console.log('🌐 Browser client connected');
  clients.add(ws);

  // Send initial state
  sendSessions(ws);
  sendGatewayStatus(ws);

  ws.on('message', (data: Buffer) => {
    try {
      const command: ClientCommand = JSON.parse(data.toString());
      handleClientCommand(ws, command);
    } catch (err) {
      console.error('Invalid message from client:', err);
    }
  });

  ws.on('close', () => {
    console.log('🌐 Browser client disconnected');
    clients.delete(ws);
  });

  ws.on('error', (err) => {
    console.error('Client WebSocket error:', err);
  });
});

// Handle commands from browser clients
async function handleClientCommand(ws: WebSocket, command: ClientCommand): Promise<void> {
  switch (command.type) {
    case 'GET_SESSIONS':
      sendSessions(ws);
      break;
    
    case 'GET_TOOL_CALLS':
      if (command.sessionId) {
        const calls = getToolCalls(command.sessionId);
        sendToClient(ws, { type: 'TOOL_CALLS', sessionId: command.sessionId, data: calls });
      }
      break;
    
    case 'GET_HISTORY':
      const sessions = getSessions(command.limit || 100);
      sendToClient(ws, { type: 'SESSIONS', data: sessions });
      break;
    
    case 'GET_GATEWAY_STATUS':
      sendGatewayStatus(ws);
      break;
    
    case 'PING':
      sendToClient(ws, { type: 'PONG' });
      break;
    
    default:
      console.log('Unknown command:', command.type);
  }
}

function sendSessions(ws: WebSocket): void {
  const sessions = getSessions(100);
  sendToClient(ws, { type: 'SESSIONS', data: sessions });
}

function sendGatewayStatus(ws: WebSocket): void {
  sendToClient(ws, { 
    type: 'GATEWAY_STATUS', 
    data: { 
      connected: gatewayClient?.isConnected() || false,
      state: gatewayClient?.getConnectionState() || 'disconnected',
      url: GATEWAY_URL
    } 
  });
}

function sendToClient(ws: WebSocket, event: ServerEvent): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(event));
  }
}

// Broadcast to all connected clients
export function broadcast(event: ServerEvent): void {
  const message = JSON.stringify(event);
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// Initialize Gateway Client
const gatewayToken = loadGatewayToken();
const gatewayClient = new GatewayClient({
  url: GATEWAY_URL,
  token: gatewayToken
});

// Handle Gateway events
gatewayClient.on('connected', () => {
  console.log('✅ Gateway connection established');
  broadcast({ type: 'GATEWAY_STATUS', data: { connected: true, state: 'connected', url: GATEWAY_URL } });
});

gatewayClient.on('disconnected', (code, reason) => {
  console.log(`⚠️ Gateway disconnected: ${code} ${reason}`);
  broadcast({ type: 'GATEWAY_STATUS', data: { connected: false, state: 'disconnected', url: GATEWAY_URL } });
});

gatewayClient.on('error', (err) => {
  console.error('Gateway client error:', err);
});

gatewayClient.on('event', (event: RawGatewayEvent) => {
  // Parse and store the event
  eventParser.parseEvent(event);
  
  // Broadcast to browser clients
  switch (event.type) {
    case 'session_start':
      const session = eventParser.getActiveSessions().find(s => s.id === event.session_id);
      if (session) {
        broadcast({ type: 'SESSION_START', data: session });
      }
      break;
    
    case 'session_end':
      broadcast({ 
        type: 'SESSION_UPDATE', 
        data: { 
          id: event.session_id, 
          status: event.status === 'error' ? 'failed' : 'completed',
          endTime: new Date()
        } 
      });
      break;
    
    case 'tool_call':
      broadcast({
        type: 'TOOL_CALL',
        sessionId: event.session_id,
        data: {
          id: event.call_id,
          sessionId: event.session_id,
          toolName: event.tool || 'unknown',
          parameters: event.params || {},
          status: 'running',
          startTime: new Date()
        }
      });
      break;
    
    case 'tool_result':
      broadcast({
        type: 'TOOL_UPDATE',
        sessionId: event.session_id,
        data: {
          id: event.call_id,
          status: event.status === 'success' ? 'success' : 'error',
          result: event.result,
          error: event.error,
          endTime: new Date()
        }
      });
      break;
    
    case 'model_usage':
      // Model usage is handled internally by event parser
      // Broadcast session update with new token counts
      const activeSession = eventParser.getActiveSessions().find(s => s.id === event.session_id);
      if (activeSession) {
        broadcast({
          type: 'SESSION_UPDATE',
          data: {
            id: event.session_id,
            totalTokensIn: activeSession.totalTokensIn,
            totalTokensOut: activeSession.totalTokensOut,
            estimatedCost: activeSession.estimatedCost
          }
        });
      }
      break;
  }
});

// Connect to Gateway
console.log(`📡 Connecting to OpenClaw Gateway at ${GATEWAY_URL}...`);
gatewayClient.connect();

console.log(`✅ Bridge Server ready!`);
console.log(`🌐 WebSocket: ws://localhost:${BRIDGE_PORT}`);

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down...');
  gatewayClient.disconnect();
  wss.close(() => {
    process.exit(0);
  });
});
