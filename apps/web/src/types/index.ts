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
  channel?: string;
  userId?: string;
  agentId?: string;
}

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

export type ConnectionStatus = 'connected' | 'disconnected' | 'connecting';

export type TabType = 'overview' | 'timeline' | 'logs' | 'graph' | 'performance';