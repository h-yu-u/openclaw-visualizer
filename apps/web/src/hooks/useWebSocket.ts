import { useEffect, useRef, useCallback } from 'react';
import { useTaskStore } from '../store';
import { TaskSession, ToolCall } from '../types';

const BRIDGE_URL = import.meta.env.VITE_BRIDGE_URL || 'ws://localhost:3001';

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const isActiveRef = useRef(true);
  
  // Use selectors to get specific actions, not the whole store
  const setConnectionStatus = useTaskStore(state => state.setConnectionStatus);
  const setSessions = useTaskStore(state => state.setSessions);
  const addSession = useTaskStore(state => state.addSession);
  const updateSession = useTaskStore(state => state.updateSession);
  const setToolCalls = useTaskStore(state => state.setToolCalls);
  const addToolCall = useTaskStore(state => state.addToolCall);
  const updateToolCall = useTaskStore(state => state.updateToolCall);
  const setGatewayStatus = useTaskStore(state => state.setGatewayStatus);
  const selectedSessionId = useTaskStore(state => state.selectedSessionId);

  const connect = useCallback(() => {
    if (!isActiveRef.current) return;
    
    setConnectionStatus('connecting');

    try {
      const ws = new WebSocket(BRIDGE_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!isActiveRef.current) {
          ws.close();
          return;
        }
        console.log('Connected to Bridge Server');
        setConnectionStatus('connected');
        ws.send(JSON.stringify({ type: 'GET_SESSIONS' }));
        ws.send(JSON.stringify({ type: 'GET_GATEWAY_STATUS' }));
      };

      ws.onmessage = (event) => {
        if (!isActiveRef.current) return;
        try {
          const msg = JSON.parse(event.data);
          handleServerMessage(msg, {
            setSessions,
            addSession,
            updateSession,
            setToolCalls,
            addToolCall,
            updateToolCall,
            setGatewayStatus,
            selectedSessionId,
            wsRef
          });
        } catch (err) {
          console.error('Failed to parse message:', err);
        }
      };

      ws.onclose = () => {
        if (!isActiveRef.current) return;
        console.log('Disconnected from Bridge Server');
        setConnectionStatus('disconnected');
        reconnectTimeoutRef.current = setTimeout(connect, 3000);
      };

      ws.onerror = (error) => {
        if (!isActiveRef.current) return;
        // Silent error - connection failures are expected during reconnect
      };
    } catch (err) {
      if (!isActiveRef.current) return;
      console.error('Failed to connect:', err);
      setConnectionStatus('disconnected');
      reconnectTimeoutRef.current = setTimeout(connect, 3000);
    }
  }, [
    setConnectionStatus,
    setSessions,
    addSession,
    updateSession,
    setToolCalls,
    addToolCall,
    updateToolCall,
    setGatewayStatus,
    selectedSessionId
  ]);

  useEffect(() => {
    isActiveRef.current = true;
    connect();
    return () => {
      isActiveRef.current = false;
      clearTimeout(reconnectTimeoutRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  // Fetch tool calls when session selection changes
  useEffect(() => {
    if (selectedSessionId && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ 
        type: 'GET_TOOL_CALLS', 
        sessionId: selectedSessionId 
      }));
    }
  }, [selectedSessionId]);

  const send = useCallback((message: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  const connectionStatus = useTaskStore(state => state.connectionStatus);
  return { send, status: connectionStatus };
}

function handleServerMessage(msg: any, store: any) {
  switch (msg.type) {
    case 'SESSIONS':
      store.setSessions(msg.data.map(parseSession));
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
