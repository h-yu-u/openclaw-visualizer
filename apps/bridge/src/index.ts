import 'dotenv/config';
import { WebSocketServer, WebSocket } from 'ws';
import { EventParser } from './event-parser.js';
import { getSessions, getToolCalls } from './database.js';
import { ClientCommand, ServerEvent } from './types.js';

const BRIDGE_PORT = parseInt(process.env.BRIDGE_PORT || '3001');
const GATEWAY_URL = process.env.OPENCLAW_GATEWAY_URL || 'ws://127.0.0.1:18789';
const GATEWAY_TOKEN = process.env.OPENCLAW_TOKEN;

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

// Simulate OpenClaw Gateway events for testing
// In production, this would connect to actual Gateway
function startGatewaySimulation(): void {
  console.log('🎮 Starting Gateway simulation mode...');
  
  let sessionCounter = 0;
  
  setInterval(() => {
    sessionCounter++;
    const sessionId = `session_${Date.now()}`;
    
    // Simulate session start
    eventParser.parseEvent({
      type: 'session_start',
      session_id: sessionId,
      timestamp: new Date().toISOString(),
      channel: 'telegram',
      agent_id: 'main'
    });
    
    broadcast({
      type: 'SESSION_START',
      data: {
        id: sessionId,
        name: `Test Session ${sessionCounter}`,
        status: 'running',
        startTime: new Date(),
        totalTokensIn: 0,
        totalTokensOut: 0,
        estimatedCost: 0,
        toolCalls: []
      }
    });
    
    // Simulate some tool calls
    const tools = ['exec', 'write', 'read', 'browser'];
    tools.forEach((tool, i) => {
      setTimeout(() => {
        const callId = `call_${Date.now()}_${i}`;
        
        eventParser.parseEvent({
          type: 'tool_call',
          session_id: sessionId,
          call_id: callId,
          tool,
          params: { command: `test ${tool}` },
          timestamp: new Date().toISOString()
        });
        
        broadcast({
          type: 'TOOL_CALL',
          sessionId,
          data: {
            id: callId,
            sessionId,
            toolName: tool,
            parameters: { command: `test ${tool}` },
            status: 'running',
            startTime: new Date()
          }
        });
        
        // Simulate completion
        setTimeout(() => {
          eventParser.parseEvent({
            type: 'tool_result',
            session_id: sessionId,
            call_id: callId,
            status: 'success',
            result: { output: `Result from ${tool}` },
            timestamp: new Date().toISOString()
          });
          
          broadcast({
            type: 'TOOL_UPDATE',
            sessionId,
            data: {
              id: callId,
              status: 'success',
              result: { output: `Result from ${tool}` },
              endTime: new Date(),
              durationMs: 100 + Math.random() * 500
            }
          });
        }, 500 + Math.random() * 1000);
        
      }, i * 300);
    });
    
    // Simulate session end
    setTimeout(() => {
      eventParser.parseEvent({
        type: 'session_end',
        session_id: sessionId,
        status: 'success',
        timestamp: new Date().toISOString()
      });
      
      broadcast({
        type: 'SESSION_UPDATE',
        data: {
          id: sessionId,
          status: 'completed',
          endTime: new Date()
        }
      });
    }, 5000);
    
  }, 15000); // New session every 15 seconds
}

console.log(`✅ Bridge Server ready!`);
console.log(`📡 WebSocket: ws://localhost:${BRIDGE_PORT}`);

// Start simulation mode (replace with real Gateway connection later)
startGatewaySimulation();