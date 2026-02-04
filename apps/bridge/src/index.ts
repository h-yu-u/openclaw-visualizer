import 'dotenv/config';
import { WebSocketServer, WebSocket } from 'ws';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { DatabaseManager } from './database.js';
import { OpenClawFileWatcher, SessionData, ToolCallData, MessageData } from './file-watcher.js';
import { ClientCommand, ServerEvent } from './types.js';

const BRIDGE_PORT = parseInt(process.env.BRIDGE_PORT || '3001');
const DB_PATH = process.env.DATABASE_PATH || './data/visualizer.db';

// Initialize database
const db = new DatabaseManager(DB_PATH);

// Store connected browser clients
const clients: Set<WebSocket> = new Set();

// Initialize File Watcher
const fileWatcher = new OpenClawFileWatcher();

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

// Handle file watcher events
fileWatcher.on('session_start', (session: SessionData) => {
  console.log('[Bridge] Session started:', session.id);
  
  // Save to database
  db.createSession({
    id: session.id,
    name: session.name,
    status: session.status,
    startTime: new Date(session.startTime),
    totalTokensIn: session.totalTokensIn,
    totalTokensOut: session.totalTokensOut,
    estimatedCost: session.estimatedCost
  });

  // Broadcast to clients
  broadcast({ 
    type: 'SESSION_START', 
    data: convertSession(session) 
  });
});

fileWatcher.on('session_update', (session: SessionData) => {
  // Update database
  db.updateSession(session.id, {
    status: session.status,
    endTime: session.endTime ? new Date(session.endTime) : undefined,
    totalTokensIn: session.totalTokensIn,
    totalTokensOut: session.totalTokensOut,
    estimatedCost: session.estimatedCost
  });

  // Broadcast to clients
  broadcast({ 
    type: 'SESSION_UPDATE', 
    data: {
      id: session.id,
      status: session.status,
      endTime: session.endTime ? new Date(session.endTime) : undefined,
      totalTokensIn: session.totalTokensIn,
      totalTokensOut: session.totalTokensOut,
      estimatedCost: session.estimatedCost
    }
  });
});

fileWatcher.on('tool_call', ({ sessionId, toolCall }: { sessionId: string; toolCall: ToolCallData }) => {
  // Save to database
  db.createToolCall({
    id: toolCall.id,
    sessionId,
    toolName: toolCall.toolName,
    status: toolCall.status,
    startTime: new Date(toolCall.startTime),
    parameters: toolCall.parameters
  });

  // Broadcast to clients
  broadcast({
    type: 'TOOL_CALL',
    sessionId,
    data: convertToolCall(toolCall, sessionId)
  });
});

fileWatcher.on('tool_update', ({ sessionId, toolCall }: { sessionId: string; toolCall: ToolCallData }) => {
  // Update database
  db.updateToolCall(toolCall.id, sessionId, {
    status: toolCall.status,
    endTime: toolCall.endTime ? new Date(toolCall.endTime) : undefined,
    durationMs: toolCall.durationMs,
    result: toolCall.result,
    error: toolCall.error
  });

  // Broadcast to clients
  broadcast({
    type: 'TOOL_UPDATE',
    sessionId,
    data: {
      id: toolCall.id,
      status: toolCall.status,
      endTime: toolCall.endTime ? new Date(toolCall.endTime) : undefined,
      result: toolCall.result,
      error: toolCall.error
    }
  });
});

fileWatcher.on('message', ({ sessionId, message }: { sessionId: string; message: MessageData }) => {
  // Broadcast to clients
  broadcast({
    type: 'MESSAGE',
    sessionId,
    data: convertMessage(message)
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
        // First check live file watcher sessions (for active sessions)
        const liveCalls = fileWatcher.getToolCalls(command.sessionId);
        if (liveCalls.length > 0) {
          // Active session - use live data
          const convertedCalls = liveCalls.map(tc => convertToolCall(tc, command.sessionId!));
          sendToClient(ws, { type: 'TOOL_CALLS', sessionId: command.sessionId, data: convertedCalls });
        } else {
          // Historical session - load from database
          const calls = db.getToolCalls(command.sessionId);
          sendToClient(ws, { type: 'TOOL_CALLS', sessionId: command.sessionId, data: calls });
        }
      }
      break;
    
    case 'GET_MESSAGES':
      if (command.sessionId) {
        const liveMessages = fileWatcher.getMessages(command.sessionId);
        const convertedMessages = liveMessages.map(m => convertMessage(m));
        sendToClient(ws, { type: 'MESSAGES', sessionId: command.sessionId, data: convertedMessages });
      }
      break;
    
    case 'GET_HISTORY':
      const sessions = db.getSessions(command.limit || 100);
      sendToClient(ws, { type: 'SESSIONS', data: sessions });
      break;
    
    case 'GET_GATEWAY_STATUS':
      sendToClient(ws, { 
        type: 'GATEWAY_STATUS', 
        data: { 
          connected: true,
          state: 'file_watcher',
          url: 'filesystem'
        } 
      });
      break;
    
    case 'PING':
      sendToClient(ws, { type: 'PONG' });
      break;
    
    default:
      console.log('Unknown command:', command.type);
  }
}

function sendSessions(ws: WebSocket): void {
  // Get all sessions including historical ones from database
  const allSessions = fileWatcher.getAllSessions();
  
  // For sessions that are currently active in file watcher, merge with real-time tool calls
  const enrichedSessions = allSessions.map(session => {
    const liveSession = fileWatcher.getSession(session.id);
    if (liveSession) {
      // Merge live data with stored data
      return {
        ...session,
        toolCalls: liveSession.toolCalls,
        totalTokensIn: liveSession.totalTokensIn || session.totalTokensIn,
        totalTokensOut: liveSession.totalTokensOut || session.totalTokensOut,
        estimatedCost: liveSession.estimatedCost || session.estimatedCost,
        status: liveSession.status // Live status takes precedence
      };
    }
    return session;
  });
  
  // Convert and sort by start time (newest first)
  const sessions = enrichedSessions.map(convertSession).sort((a, b) => 
    new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
  );
  
  sendToClient(ws, { type: 'SESSIONS', data: sessions });
}

function sendToClient(ws: WebSocket, event: ServerEvent): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(event));
  }
}

// Broadcast to all connected clients
function broadcast(event: ServerEvent): void {
  const message = JSON.stringify(event);
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// Helper functions
function convertSession(session: SessionData): any {
  return {
    id: session.id,
    name: session.name,
    status: session.status,
    startTime: new Date(session.startTime),
    endTime: session.endTime ? new Date(session.endTime) : undefined,
    totalTokensIn: session.totalTokensIn,
    totalTokensOut: session.totalTokensOut,
    estimatedCost: session.estimatedCost,
    agentId: session.agentId,
    channel: session.channel,
    toolCalls: session.toolCalls.map(tc => convertToolCall(tc, session.id)),
    messages: session.messages?.map(m => convertMessage(m)) || []
  };
}

function convertToolCall(tc: ToolCallData, sessionId: string): any {
  return {
    id: tc.id,
    sessionId,
    toolName: tc.toolName,
    status: tc.status,
    startTime: new Date(tc.startTime),
    endTime: tc.endTime ? new Date(tc.endTime) : undefined,
    parameters: tc.parameters,
    result: tc.result,
    error: tc.error,
    tokensIn: tc.tokensIn,
    tokensOut: tc.tokensOut
  };
}

function convertMessage(m: MessageData): any {
  return {
    id: m.id,
    role: m.role,
    content: m.content,
    timestamp: new Date(m.timestamp),
    model: m.model,
    tokensIn: m.tokensIn,
    tokensOut: m.tokensOut
  };
}

// Load historical sessions from database on startup
function loadHistoricalSessions(): void {
  try {
    const historicalSessions = db.getSessions(100); // Get last 100 sessions
    const convertedSessions: SessionData[] = historicalSessions.map(session => ({
      id: session.id,
      name: session.name,
      status: session.status,
      startTime: session.startTime.getTime(),
      endTime: session.endTime?.getTime(),
      totalTokensIn: session.totalTokensIn || 0,
      totalTokensOut: session.totalTokensOut || 0,
      estimatedCost: session.estimatedCost || 0,
      agentId: session.agentId,
      channel: session.channel,
      toolCalls: [], // Tool calls will be loaded on demand
      messages: []   // Messages will be loaded on demand
    }));
    
    fileWatcher.loadHistoricalSessions(convertedSessions);
    console.log(`📚 Loaded ${convertedSessions.length} historical sessions from database`);
  } catch (err) {
    console.error('[Bridge] Error loading historical sessions:', err);
  }
}

// Start file watcher
fileWatcher.start();

// Load historical data
loadHistoricalSessions();

console.log(`✅ Bridge Server ready!`);
console.log(`🌐 WebSocket: ws://localhost:${BRIDGE_PORT}`);
console.log(`📁 Watching OpenClaw sessions...`);

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down...');
  fileWatcher.stop();
  wss.close(() => {
    process.exit(0);
  });
});
