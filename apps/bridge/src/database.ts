import Database from 'better-sqlite3';
import { TaskSession, ToolCall } from './types.js';

const db = new Database(process.env.DATABASE_PATH || './data/visualizer.db');

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed', 'cancelled')),
    start_time INTEGER NOT NULL,
    end_time INTEGER,
    total_tokens_in INTEGER DEFAULT 0,
    total_tokens_out INTEGER DEFAULT 0,
    estimated_cost REAL DEFAULT 0,
    channel TEXT,
    user_id TEXT,
    agent_id TEXT,
    tags TEXT,
    created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
  );

  CREATE TABLE IF NOT EXISTS tool_calls (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    tool_name TEXT NOT NULL,
    parameters TEXT NOT NULL,
    result TEXT,
    error TEXT,
    status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'success', 'error')),
    start_time INTEGER NOT NULL,
    end_time INTEGER,
    duration_ms INTEGER,
    tokens_in INTEGER,
    tokens_out INTEGER,
    parent_id TEXT,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES tool_calls(id)
  );

  CREATE TABLE IF NOT EXISTS model_usage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    model TEXT NOT NULL,
    tokens_in INTEGER NOT NULL,
    tokens_out INTEGER NOT NULL,
    timestamp INTEGER NOT NULL,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
  CREATE INDEX IF NOT EXISTS idx_sessions_start_time ON sessions(start_time DESC);
  CREATE INDEX IF NOT EXISTS idx_tool_calls_session ON tool_calls(session_id);
`);

export function createSession(session: TaskSession): void {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO sessions (id, name, status, start_time, end_time, 
      total_tokens_in, total_tokens_out, estimated_cost, channel, user_id, agent_id, tags)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(
    session.id,
    session.name,
    session.status,
    session.startTime.getTime(),
    session.endTime?.getTime(),
    session.totalTokensIn,
    session.totalTokensOut,
    session.estimatedCost,
    session.channel,
    session.userId,
    session.agentId,
    JSON.stringify([])
  );
}

export function updateSession(id: string, updates: Partial<TaskSession>): void {
  const fields: string[] = [];
  const values: any[] = [];
  
  if (updates.status) { fields.push('status = ?'); values.push(updates.status); }
  if (updates.endTime) { fields.push('end_time = ?'); values.push(updates.endTime.getTime()); }
  if (updates.totalTokensIn !== undefined) { fields.push('total_tokens_in = ?'); values.push(updates.totalTokensIn); }
  if (updates.totalTokensOut !== undefined) { fields.push('total_tokens_out = ?'); values.push(updates.totalTokensOut); }
  if (updates.estimatedCost !== undefined) { fields.push('estimated_cost = ?'); values.push(updates.estimatedCost); }
  
  if (fields.length === 0) return;
  
  const stmt = db.prepare(`UPDATE sessions SET ${fields.join(', ')} WHERE id = ?`);
  stmt.run(...values, id);
}

export function getSessions(limit = 100): TaskSession[] {
  const stmt = db.prepare(`
    SELECT * FROM sessions ORDER BY start_time DESC LIMIT ?
  `);
  
  const rows = stmt.all(limit) as any[];
  return rows.map(row => ({
    id: row.id,
    name: row.name,
    status: row.status,
    startTime: new Date(row.start_time),
    endTime: row.end_time ? new Date(row.end_time) : undefined,
    totalTokensIn: row.total_tokens_in,
    totalTokensOut: row.total_tokens_out,
    estimatedCost: row.estimated_cost,
    toolCalls: [],
    channel: row.channel,
    userId: row.user_id,
    agentId: row.agent_id
  }));
}

export function createToolCall(call: ToolCall): void {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO tool_calls 
    (id, session_id, tool_name, parameters, result, error, status, start_time, end_time, duration_ms, tokens_in, tokens_out, parent_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(
    call.id,
    call.sessionId,
    call.toolName,
    JSON.stringify(call.parameters),
    call.result ? JSON.stringify(call.result) : null,
    call.error,
    call.status,
    call.startTime.getTime(),
    call.endTime?.getTime(),
    call.durationMs,
    call.tokensIn,
    call.tokensOut,
    call.parentId
  );
}

export function updateToolCall(id: string, sessionId: string, updates: Partial<ToolCall>): void {
  const fields: string[] = [];
  const values: any[] = [];
  
  if (updates.status) { fields.push('status = ?'); values.push(updates.status); }
  if (updates.result) { fields.push('result = ?'); values.push(JSON.stringify(updates.result)); }
  if (updates.error) { fields.push('error = ?'); values.push(updates.error); }
  if (updates.endTime) { fields.push('end_time = ?'); values.push(updates.endTime.getTime()); }
  if (updates.durationMs) { fields.push('duration_ms = ?'); values.push(updates.durationMs); }
  if (updates.tokensIn !== undefined) { fields.push('tokens_in = ?'); values.push(updates.tokensIn); }
  if (updates.tokensOut !== undefined) { fields.push('tokens_out = ?'); values.push(updates.tokensOut); }
  
  if (fields.length === 0) return;
  
  const stmt = db.prepare(`UPDATE tool_calls SET ${fields.join(', ')} WHERE id = ? AND session_id = ?`);
  stmt.run(...values, id, sessionId);
}

export function getToolCalls(sessionId: string): ToolCall[] {
  const stmt = db.prepare(`
    SELECT * FROM tool_calls WHERE session_id = ? ORDER BY start_time ASC
  `);
  
  const rows = stmt.all(sessionId) as any[];
  return rows.map(row => ({
    id: row.id,
    sessionId: row.session_id,
    toolName: row.tool_name,
    parameters: JSON.parse(row.parameters),
    result: row.result ? JSON.parse(row.result) : undefined,
    error: row.error,
    status: row.status,
    startTime: new Date(row.start_time),
    endTime: row.end_time ? new Date(row.end_time) : undefined,
    durationMs: row.duration_ms,
    tokensIn: row.tokens_in,
    tokensOut: row.tokens_out,
    parentId: row.parent_id
  }));
}

export { db };