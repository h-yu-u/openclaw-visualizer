import { useEffect, useRef, useCallback } from 'react';
import { useTaskStore } from '../store';
import { TaskSession, ToolCall } from '../types';

const BRIDGE_URL = import.meta.env.VITE_BRIDGE_URL || 'ws://localhost:3001';

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const store = useTaskStore();

  const connect = useCallback(() => {
    store.setConnectionStatus('connecting');

    try {
      const ws = new WebSocket(BRIDGE_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('Connected to Bridge Server');
        store.setConnectionStatus('connected');
        ws.send(JSON.stringify({ type: 'GET_SESSIONS' }));
        ws.send(JSON.stringify({ type: 'GET_GATEWAY_STATUS' }));
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          handleServerMessage(msg, store);
        } catch (err) {
          console.error('Failed to parse message:', err);
        }
      };

      ws.onclose = () => {
        console.log('Disconnected from Bridge Server');
        store.setConnectionStatus('disconnected');
        reconnectTimeoutRef.current = setTimeout(connect, 3000);
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        store.setConnectionStatus('disconnected');
      };
    } catch (err) {
      console.error('Failed to connect:', err);
      store.setConnectionStatus('disconnected');
      reconnectTimeoutRef.current = setTimeout(connect, 3000);
    }
  }, [store]);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimeoutRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  // Fetch tool calls when session selection changes
  useEffect(() => {
    const { selectedSessionId } = store;
    if (selectedSessionId && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ 
        type: 'GET_TOOL_CALLS', 
        sessionId: selectedSessionId 
      }));
    }
  }, [store.selectedSessionId]);

  const send = useCallback((message: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  return { send, status: store.connectionStatus };
}

function handleServerMessage(msg: any, store: any) {
  switch (msg.type) {
    case 'SESSIONS':
      store.setSessions(msg.data.map(parseSession));
      // Also fetch tool calls for selected session if any
      if (store.selectedSessionId) {
        const ws = store._wsRef?.current;
        if (ws?.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ 
            type: 'GET_TOOL_CALLS', 
            sessionId: store.selectedSessionId 
          }));
        }
      }
      break;
    
    case 'SESSION_START':
      store.addSession(parseSession(msg.data));
      break;
    
    case 'SESSION_UPDATE':
      store.updateSession(msg.data.id, {
        ...msg.data,
        endTime: msg.data.endTime ? new Date(msg.data.endTime) : undefined
      });
      break;
    
    case 'TOOL_CALLS':
      // Store tool calls for the session
      if (msg.sessionId && msg.data) {
        const calls = msg.data.map(parseToolCall);
        store.setToolCalls(msg.sessionId, calls);
      }
      break;
    
    case 'TOOL_CALL':
      store.addToolCall(msg.sessionId, parseToolCall(msg.data));
      break;
    
    case 'TOOL_UPDATE':
      store.updateToolCall(msg.sessionId, msg.data.id, {
        ...msg.data,
        endTime: msg.data.endTime ? new Date(msg.data.endTime) : undefined
      });
      break;

    case 'GATEWAY_STATUS':
      store.setGatewayStatus(msg.data);
      break;
  }
}

function parseSession(data: any): TaskSession {
  return {
    ...data,
    startTime: new Date(data.startTime),
    endTime: data.endTime ? new Date(data.endTime) : undefined,
    toolCalls: data.toolCalls || []
  };
}

function parseToolCall(data: any): ToolCall {
  return {
    ...data,
    startTime: new Date(data.startTime),
    endTime: data.endTime ? new Date(data.endTime) : undefined
  };
}
