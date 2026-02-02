import { useEffect, useRef, useCallback, useState } from 'react';
import { useTaskStore } from '../store';
import { TaskSession, ToolCall, Message } from '../types';

const BRIDGE_URL = import.meta.env.VITE_BRIDGE_URL || 'ws://localhost:3001';
const MAX_RECONNECT_ATTEMPTS = 10;
const INITIAL_RECONNECT_DELAY = 1000;
const MAX_RECONNECT_DELAY = 30000;
const HEARTBEAT_INTERVAL = 30000;
const HEARTBEAT_TIMEOUT = 10000;

export interface WebSocketState {
  status: 'connected' | 'disconnected' | 'connecting';
  reconnectAttempts: number;
  lastConnectedAt: Date | null;
}

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval>>();
  const heartbeatTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const isActiveRef = useRef(true);
  const reconnectAttemptsRef = useRef(0);
  const lastConnectedAtRef = useRef<Date | null>(null);
  
  const [state, setState] = useState<WebSocketState>({
    status: 'disconnected',
    reconnectAttempts: 0,
    lastConnectedAt: null
  });
  
  // Use selectors to get specific actions, not the whole store
  const setConnectionStatus = useTaskStore(state => state.setConnectionStatus);
  const setSessions = useTaskStore(state => state.setSessions);
  const addSession = useTaskStore(state => state.addSession);
  const updateSession = useTaskStore(state => state.updateSession);
  const setToolCalls = useTaskStore(state => state.setToolCalls);
  const addToolCall = useTaskStore(state => state.addToolCall);
  const updateToolCall = useTaskStore(state => state.updateToolCall);
  const setMessages = useTaskStore(state => state.setMessages);
  const addMessage = useTaskStore(state => state.addMessage);
  const setGatewayStatus = useTaskStore(state => state.setGatewayStatus);
  const selectedSessionId = useTaskStore(state => state.selectedSessionId);

  // Calculate exponential backoff delay
  const getReconnectDelay = useCallback(() => {
    const delay = Math.min(
      INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectAttemptsRef.current),
      MAX_RECONNECT_DELAY
    );
    // Add jitter to prevent thundering herd
    return delay + Math.random() * 1000;
  }, []);

  // Send heartbeat ping
  const sendHeartbeat = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'PING' }));
      
      // Set timeout for pong response
      heartbeatTimeoutRef.current = setTimeout(() => {
        console.log('Heartbeat timeout, reconnecting...');
        wsRef.current?.close();
      }, HEARTBEAT_TIMEOUT);
    }
  }, []);

  // Start heartbeat
  const startHeartbeat = useCallback(() => {
    heartbeatIntervalRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);
  }, [sendHeartbeat]);

  // Stop heartbeat
  const stopHeartbeat = useCallback(() => {
    clearInterval(heartbeatIntervalRef.current);
    clearTimeout(heartbeatTimeoutRef.current);
  }, []);

  const connect = useCallback(() => {
    if (!isActiveRef.current) return;

    // Check max reconnect attempts
    if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
      console.error('Max reconnect attempts reached');
      setState(prev => ({ ...prev, status: 'disconnected' }));
      setConnectionStatus('disconnected');
      return;
    }

    setState(prev => ({ ...prev, status: 'connecting' }));
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
        reconnectAttemptsRef.current = 0;
        lastConnectedAtRef.current = new Date();
        setState({
          status: 'connected',
          reconnectAttempts: 0,
          lastConnectedAt: new Date()
        });
        setConnectionStatus('connected');

        // Start heartbeat
        startHeartbeat();

        ws.send(JSON.stringify({ type: 'GET_SESSIONS' }));
        ws.send(JSON.stringify({ type: 'GET_GATEWAY_STATUS' }));
      };

      ws.onmessage = (event) => {
        if (!isActiveRef.current) return;
        try {
          const msg = JSON.parse(event.data);

          // Handle pong
          if (msg.type === 'PONG') {
            clearTimeout(heartbeatTimeoutRef.current);
            return;
          }

          handleServerMessage(msg, {
            setSessions,
            addSession,
            updateSession,
            setToolCalls,
            addToolCall,
            updateToolCall,
            setMessages,
            addMessage,
            setGatewayStatus,
            selectedSessionId,
            wsRef
          });
        } catch (err) {
          console.error('Failed to parse message:', err);
        }
      };

      ws.onclose = (event) => {
        if (!isActiveRef.current) return;

        stopHeartbeat();

        // Don't reconnect if closed cleanly
        if (event.wasClean) {
          console.log('Connection closed cleanly');
          setState(prev => ({ ...prev, status: 'disconnected' }));
          setConnectionStatus('disconnected');
          return;
        }

        console.log('Disconnected from Bridge Server');
        reconnectAttemptsRef.current++;
        const delay = getReconnectDelay();
        console.log(`Reconnecting in ${Math.round(delay)}ms (attempt ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})`);

        setState(prev => ({
          ...prev,
          status: 'disconnected',
          reconnectAttempts: reconnectAttemptsRef.current
        }));
        setConnectionStatus('disconnected');

        reconnectTimeoutRef.current = setTimeout(connect, delay);
      };

      ws.onerror = (error) => {
        if (!isActiveRef.current) return;
        // Silent error - connection failures are expected during reconnect
      };
    } catch (err) {
      if (!isActiveRef.current) return;
      console.error('Failed to connect:', err);
      reconnectAttemptsRef.current++;
      const delay = getReconnectDelay();

      setState(prev => ({
        ...prev,
        status: 'disconnected',
        reconnectAttempts: reconnectAttemptsRef.current
      }));
      setConnectionStatus('disconnected');

      reconnectTimeoutRef.current = setTimeout(connect, delay);
    }
  }, [
    setConnectionStatus,
    setSessions,
    addSession,
    updateSession,
    setToolCalls,
    addToolCall,
    updateToolCall,
    setMessages,
    addMessage,
    setGatewayStatus,
    selectedSessionId,
    getReconnectDelay,
    startHeartbeat,
    stopHeartbeat
  ]);

  // Manual reconnect function
  const reconnect = useCallback(() => {
    reconnectAttemptsRef.current = 0;
    wsRef.current?.close();
    connect();
  }, [connect]);

  useEffect(() => {
    isActiveRef.current = true;
    connect();
    return () => {
      isActiveRef.current = false;
      clearTimeout(reconnectTimeoutRef.current);
      stopHeartbeat();
      wsRef.current?.close();
    };
  }, [connect, stopHeartbeat]);

  // Fetch tool calls and messages when session selection changes
  useEffect(() => {
    if (selectedSessionId && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ 
        type: 'GET_TOOL_CALLS', 
        sessionId: selectedSessionId 
      }));
      wsRef.current.send(JSON.stringify({ 
        type: 'GET_MESSAGES', 
        sessionId: selectedSessionId 
      }));
    }
  }, [selectedSessionId]);

  const send = useCallback((message: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  return { 
    send, 
    status: state.status,
    reconnectAttempts: state.reconnectAttempts,
    lastConnectedAt: state.lastConnectedAt,
    reconnect
  };
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

    case 'MESSAGES':
      if (msg.sessionId && msg.data) {
        const messages = msg.data.map(parseMessage);
        store.setMessages(msg.sessionId, messages);
      }
      break;

    case 'MESSAGE':
      store.addMessage(msg.sessionId, parseMessage(msg.data));
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

function parseMessage(data: any): Message {
  return {
    ...data,
    timestamp: new Date(data.timestamp)
  };
}
