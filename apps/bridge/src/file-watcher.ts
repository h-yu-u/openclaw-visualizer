import { EventEmitter } from 'events';
import { createReadStream, watch, existsSync, readdirSync, statSync } from 'fs';
import { resolve } from 'path';
import { createInterface } from 'readline';

interface MessageData {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: any;
  timestamp: number;
  model?: string;
  tokensIn?: number;
  tokensOut?: number;
}

interface SessionData {
  id: string;
  name: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  startTime: number;
  endTime?: number;
  totalTokensIn: number;
  totalTokensOut: number;
  estimatedCost: number;
  agentId?: string;
  channel?: string;
  toolCalls: ToolCallData[];
  messages: MessageData[];
}

interface ToolCallData {
  id: string;
  toolName: string;
  status: 'pending' | 'running' | 'success' | 'error';
  startTime: number;
  endTime?: number;
  durationMs?: number;
  parameters?: any;
  result?: any;
  error?: string;
  tokensIn?: number;
  tokensOut?: number;
}

export class OpenClawFileWatcher extends EventEmitter {
  private sessionsDir: string;
  private watchedFiles: Map<string, { size: number; mtime: number }> = new Map();
  private fsWatcher: any;
  private pollInterval: NodeJS.Timeout | null = null;
  private sessions: Map<string, SessionData> = new Map();
  private pendingToolCalls: Map<string, ToolCallData> = new Map(); // Track by toolCall ID

  constructor(sessionsDir = '~/.openclaw/agents/main/sessions') {
    super();
    this.sessionsDir = sessionsDir.replace('~', process.env.HOME || '/Users/haoyu');
  }

  start(): void {
    console.log('[FileWatcher] Starting file watcher...');
    console.log('[FileWatcher] Watching:', this.sessionsDir);

    if (!existsSync(this.sessionsDir)) {
      console.warn('[FileWatcher] Sessions directory does not exist:', this.sessionsDir);
      return;
    }

    // Initial scan
    this.scanFiles();

    // Set up polling
    this.pollInterval = setInterval(() => this.scanFiles(), 2000);

    console.log('[FileWatcher] Started');
  }

  stop(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    if (this.fsWatcher) {
      this.fsWatcher.close();
      this.fsWatcher = null;
    }
    console.log('[FileWatcher] Stopped');
  }

  private scanFiles(): void {
    try {
      const files = readdirSync(this.sessionsDir)
        .filter(f => f.endsWith('.jsonl'))
        .filter(f => !f.includes('.deleted.'))
        .filter(f => !f.endsWith('.lock'));

      for (const file of files) {
        const filepath = resolve(this.sessionsDir, file);
        const stats = statSync(filepath);
        const key = file.replace('.jsonl', '');
        const existing = this.watchedFiles.get(key);

        if (!existing) {
          // New file
          this.watchedFiles.set(key, { size: stats.size, mtime: stats.mtimeMs });
          this.parseFile(filepath, key, 0);
        } else if (existing.size !== stats.size || existing.mtime !== stats.mtimeMs) {
          // File modified
          const oldSize = existing.size;
          this.watchedFiles.set(key, { size: stats.size, mtime: stats.mtimeMs });
          this.parseFile(filepath, key, oldSize);
        }
      }
    } catch (err) {
      console.error('[FileWatcher] Scan error:', err);
    }
  }

  private async parseFile(filepath: string, sessionId: string, startFromByte: number): Promise<void> {
    try {
      const fileStream = createReadStream(filepath, { start: startFromByte });
      const rl = createInterface({ input: fileStream, crlfDelay: Infinity });

      let isNewSession = !this.sessions.has(sessionId);

      for await (const line of rl) {
        if (!line.trim()) continue;

        try {
          const event = JSON.parse(line);
          this.processEvent(sessionId, event);
        } catch (err) {
          // Invalid JSON line, skip
        }
      }

      // Emit session update
      const session = this.sessions.get(sessionId);
      if (session) {
        if (isNewSession) {
          this.emit('session_start', session);
        } else {
          this.emit('session_update', session);
        }
      }
    } catch (err) {
      console.error('[FileWatcher] Parse error:', err);
    }
  }

  private processEvent(sessionId: string, event: any): void {
    let session = this.sessions.get(sessionId);

    if (!session) {
      session = {
        id: sessionId,
        name: sessionId.slice(0, 8),
        status: 'running',
        startTime: Date.now(),
        totalTokensIn: 0,
        totalTokensOut: 0,
        estimatedCost: 0,
        toolCalls: [],
        messages: []
      };
      this.sessions.set(sessionId, session);
    }

    switch (event.type) {
      case 'session':
        session.name = event.id?.slice(0, 8) || session.name;
        session.startTime = new Date(event.timestamp).getTime();
        break;

      case 'message':
        if (event.message?.usage) {
          const usage = event.message.usage;
          session.totalTokensIn += usage.input || 0;
          session.totalTokensOut += usage.output || 0;
        }

        // Capture LLM message content (not tool calls)
        if (event.message?.role && event.message.role !== 'tool') {
          const message: MessageData = {
            id: `${sessionId}-${event.timestamp}`,
            role: event.message.role,
            content: event.message.content,
            timestamp: new Date(event.timestamp).getTime(),
            model: event.message.model,
            tokensIn: event.message.usage?.input,
            tokensOut: event.message.usage?.output
          };
          
          // Check if we already have this message
          const existingIndex = session.messages.findIndex(m => m.id === message.id);
          if (existingIndex === -1) {
            session.messages.push(message);
            this.emit('message', { sessionId, message });
            console.log('[FileWatcher] Message captured:', message.role, message.id);
          }
        }

        // Process tool calls from message content
        if (event.message?.content && Array.isArray(event.message.content)) {
          for (const content of event.message.content) {
            if (content.type === 'toolCall') {
              // Tool call start
              const toolCall: ToolCallData = {
                id: content.id || `${sessionId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                toolName: content.name || 'unknown',
                status: 'running',
                startTime: new Date(event.timestamp).getTime(),
                parameters: content.arguments || {}
              };
              
              // Check if we already have this tool call
              const existingIndex = session.toolCalls.findIndex(tc => tc.id === toolCall.id);
              if (existingIndex === -1) {
                session.toolCalls.push(toolCall);
                this.pendingToolCalls.set(toolCall.id, toolCall);
                this.emit('tool_call', { sessionId, toolCall });
                console.log('[FileWatcher] Tool call detected:', toolCall.toolName, toolCall.id);
              }
            }
            
            // Check for tool results (different formats)
            if (content.type === 'tool_result' || content.type === 'toolResult') {
              const toolCallId = content.toolCallId || content.tool_use_id || content.id;
              const existingCall = this.pendingToolCalls.get(toolCallId) || 
                                  session.toolCalls.find(tc => tc.id === toolCallId);
              
              if (existingCall) {
                existingCall.status = content.error ? 'error' : 'success';
                existingCall.endTime = new Date(event.timestamp).getTime();
                existingCall.durationMs = existingCall.endTime - existingCall.startTime;
                existingCall.result = content.result || content.output || content.content;
                existingCall.error = content.error;
                this.pendingToolCalls.delete(toolCallId);
                this.emit('tool_update', { sessionId, toolCall: existingCall });
                console.log('[FileWatcher] Tool result detected:', existingCall.toolName, toolCallId, 'duration:', existingCall.durationMs + 'ms');
              }
            }
          }
        }

        // Check for tool results in the message itself (some formats put results here)
        if (event.message?.role === 'user' && event.message?.content) {
          const content = Array.isArray(event.message.content) 
            ? event.message.content[0] 
            : event.message.content;
          
          // If content has tool_use_id, it might be a tool result
          if (content && (content.tool_use_id || content.toolCallId)) {
            const toolCallId = content.tool_use_id || content.toolCallId;
            const existingCall = this.pendingToolCalls.get(toolCallId) || 
                                session.toolCalls.find(tc => tc.id === toolCallId);
            
            if (existingCall) {
              existingCall.status = content.error ? 'error' : 'success';
              existingCall.endTime = new Date(event.timestamp).getTime();
              existingCall.durationMs = existingCall.endTime - existingCall.startTime;
              existingCall.result = content.result || content.content || content.text;
              existingCall.error = content.error;
              this.pendingToolCalls.delete(toolCallId);
              this.emit('tool_update', { sessionId, toolCall: existingCall });
              console.log('[FileWatcher] Tool result from user message:', existingCall.toolName, toolCallId, 'duration:', existingCall.durationMs + 'ms');
            }
          }
        }
        break;

      case 'tool_start':
      case 'tool_call':
        // Legacy format support
        const toolCall: ToolCallData = {
          id: event.id || `${sessionId}-${Date.now()}`,
          toolName: event.tool || event.toolName || 'unknown',
          status: 'running',
          startTime: new Date(event.timestamp).getTime(),
          parameters: event.params || event.parameters || {}
        };
        
        const existingIndex = session.toolCalls.findIndex(tc => tc.id === toolCall.id);
        if (existingIndex === -1) {
          session.toolCalls.push(toolCall);
          this.pendingToolCalls.set(toolCall.id, toolCall);
          this.emit('tool_call', { sessionId, toolCall });
        }
        break;

      case 'tool_end':
      case 'tool_result':
        // Legacy format support
        const call = this.pendingToolCalls.get(event.id) || 
                    session.toolCalls.find(c => c.id === event.id || c.id === event.call_id);
        if (call) {
          call.status = event.error ? 'error' : 'success';
          call.endTime = new Date(event.timestamp).getTime();
          call.durationMs = call.endTime - call.startTime;
          call.result = event.result;
          call.error = event.error;
          this.pendingToolCalls.delete(event.id);
          this.emit('tool_update', { sessionId, toolCall: call });
          console.log('[FileWatcher] Tool result (legacy):', call.toolName, event.id, 'duration:', call.durationMs + 'ms');
        }
        break;

      case 'session_end':
        session.status = event.status === 'error' ? 'failed' : 'completed';
        session.endTime = new Date(event.timestamp).getTime();
        break;
    }
  }

  getSessions(): SessionData[] {
    return Array.from(this.sessions.values()).sort((a, b) => b.startTime - a.startTime);
  }

  getSession(id: string): SessionData | undefined {
    return this.sessions.get(id);
  }

  getToolCalls(sessionId: string): ToolCallData[] {
    return this.sessions.get(sessionId)?.toolCalls || [];
  }

  getMessages(sessionId: string): MessageData[] {
    return this.sessions.get(sessionId)?.messages || [];
  }

  // Load historical sessions from database
  loadHistoricalSessions(sessions: SessionData[]): void {
    for (const session of sessions) {
      // Only add if not already in memory (file watcher takes precedence for active sessions)
      if (!this.sessions.has(session.id)) {
        this.sessions.set(session.id, session);
      }
    }
    console.log(`[FileWatcher] Loaded ${sessions.length} historical sessions from database`);
  }

  // Get all sessions including historical ones
  getAllSessions(): SessionData[] {
    return Array.from(this.sessions.values()).sort((a, b) => b.startTime - a.startTime);
  }
}

export type { SessionData, ToolCallData, MessageData };
