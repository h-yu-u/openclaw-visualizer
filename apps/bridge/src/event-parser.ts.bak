import { RawGatewayEvent, ToolCall, TaskSession } from './types.js';
import { createSession, updateSession, createToolCall, updateToolCall } from './database.js';

// Pricing per 1K tokens
const PRICING: Record<string, { in: number; out: number }> = {
  'gpt-4': { in: 0.03, out: 0.06 },
  'gpt-4-turbo': { in: 0.01, out: 0.03 },
  'gpt-4o': { in: 0.005, out: 0.015 },
  'claude-3-opus': { in: 0.015, out: 0.075 },
  'claude-3-sonnet': { in: 0.003, out: 0.015 },
  'claude-3-haiku': { in: 0.00025, out: 0.00125 },
  'kimi-k2': { in: 0.01, out: 0.03 },
  'kimi-k2.5': { in: 0.01, out: 0.03 },
};

export function calculateCost(model: string, tokensIn: number, tokensOut: number): number {
  const rate = PRICING[model] || PRICING['gpt-4'];
  return ((tokensIn * rate.in) + (tokensOut * rate.out)) / 1000;
}

export class EventParser {
  private activeSessions: Map<string, TaskSession> = new Map();

  parseEvent(event: RawGatewayEvent): void {
    switch (event.type) {
      case 'session_start':
        this.handleSessionStart(event);
        break;
      case 'tool_call':
        this.handleToolCall(event);
        break;
      case 'tool_result':
        this.handleToolResult(event);
        break;
      case 'model_usage':
        this.handleModelUsage(event);
        break;
      case 'session_end':
        this.handleSessionEnd(event);
        break;
      default:
        // Unknown event type, log for debugging
        console.log('Unknown event type:', event.type);
    }
  }

  private handleSessionStart(event: RawGatewayEvent): void {
    const sessionId = event.session_id || `session_${Date.now()}`;
    const session: TaskSession = {
      id: sessionId,
      name: `Session ${sessionId.slice(0, 8)}`,
      status: 'running',
      startTime: new Date(event.timestamp || Date.now()),
      totalTokensIn: 0,
      totalTokensOut: 0,
      estimatedCost: 0,
      toolCalls: [],
      channel: event.channel,
      userId: event.user_id,
      agentId: event.agent_id
    };

    this.activeSessions.set(sessionId, session);
    createSession(session);
    
    console.log(`[Session Started] ${sessionId}`);
  }

  private handleToolCall(event: RawGatewayEvent): void {
    const sessionId = event.session_id;
    if (!sessionId) return;

    const call: ToolCall = {
      id: event.call_id || `call_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      sessionId,
      toolName: event.tool || 'unknown',
      parameters: event.params || {},
      status: 'running',
      startTime: new Date(event.timestamp || Date.now())
    };

    createToolCall(call);
    console.log(`[Tool Call] ${call.toolName} (${call.id.slice(0, 8)})`);
  }

  private handleToolResult(event: RawGatewayEvent): void {
    const sessionId = event.session_id;
    const callId = event.call_id;
    if (!sessionId || !callId) return;

    const startTime = event.timestamp ? new Date(event.timestamp).getTime() : Date.now();
    const updates: Partial<ToolCall> = {
      status: event.status === 'success' ? 'success' : 'error',
      result: event.result,
      error: event.error,
      endTime: new Date(event.timestamp || Date.now()),
      tokensIn: event.tokens?.input,
      tokensOut: event.tokens?.output
    };

    if (event.timestamp) {
      // Estimate duration if we have timestamps
      updates.durationMs = 100; // Placeholder
    }

    updateToolCall(callId, sessionId, updates);
    console.log(`[Tool Result] ${callId.slice(0, 8)} - ${updates.status}`);
  }

  private handleModelUsage(event: RawGatewayEvent): void {
    const sessionId = event.session_id;
    if (!sessionId) return;

    const session = this.activeSessions.get(sessionId);
    if (session && event.tokens) {
      session.totalTokensIn += event.tokens.input || 0;
      session.totalTokensOut += event.tokens.output || 0;
      
      if (event.model) {
        const cost = calculateCost(
          event.model,
          event.tokens.input || 0,
          event.tokens.output || 0
        );
        session.estimatedCost += cost;
      }

      updateSession(sessionId, {
        totalTokensIn: session.totalTokensIn,
        totalTokensOut: session.totalTokensOut,
        estimatedCost: session.estimatedCost
      });
    }
  }

  private handleSessionEnd(event: RawGatewayEvent): void {
    const sessionId = event.session_id;
    if (!sessionId) return;

    const session = this.activeSessions.get(sessionId);
    if (session) {
      session.status = event.status === 'error' ? 'failed' : 'completed';
      session.endTime = new Date(event.timestamp || Date.now());
      
      updateSession(sessionId, {
        status: session.status,
        endTime: session.endTime
      });

      this.activeSessions.delete(sessionId);
      console.log(`[Session Ended] ${sessionId} - ${session.status}`);
    }
  }

  getActiveSessions(): TaskSession[] {
    return Array.from(this.activeSessions.values());
  }
}