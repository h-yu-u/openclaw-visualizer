// Message in a session
export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: any;
  timestamp: Date;
  model?: string;
  tokensIn?: number;
  tokensOut?: number;
}

// Task Session - Top level container
export interface TaskSession {
  id: string;
  name: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  startTime: Date;
  endTime?: Date;
  totalTokensIn: number;
  totalTokensOut: number;
  estimatedCost: number;
  toolCalls: ToolCall[];
  messages: Message[];
  channel?: string;
  userId?: string;
  agentId?: string;
}

// Individual tool execution
export interface ToolCall {
  id: string;
  sessionId: string;
  toolName: string;
  parameters: Record<string, any>;
  result?: any;
  error?: string;
  status: 'pending' | 'running' | 'success' | 'error';
  startTime: Date;
  endTime?: Date;
  durationMs?: number;
  tokensIn?: number;
  tokensOut?: number;
  parentId?: string;
}

// Model usage tracking
export interface ModelUsage {
  sessionId: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  timestamp: Date;
}

// Raw event from OpenClaw Gateway
export interface RawGatewayEvent {
  type: string;
  session_id?: string;
  call_id?: string;
  tool?: string;
  params?: Record<string, any>;
  result?: any;
  error?: string;
  status?: string;
  timestamp?: string;
  tokens?: { input?: number; output?: number };
  model?: string;
  channel?: string;
  user_id?: string;
  agent_id?: string;
}

// Server events sent to browser
export interface ServerEvent {
  type: string;
  data?: any;
  sessionId?: string;
}

// Client commands from browser
export interface ClientCommand {
  type: string;
  sessionId?: string;
  format?: 'json' | 'csv';
  limit?: number;
  offset?: number;
}