import { WebSocket } from 'ws';
import { EventEmitter } from 'events';
import { RawGatewayEvent } from './types.js';

interface GatewayClientOptions {
  url: string;
  token: string;
  reconnectInterval?: number;
  maxReconnectInterval?: number;
  heartbeatInterval?: number;
}

interface GatewayMessage {
  type: string;
  [key: string]: any;
}

export class GatewayClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private options: GatewayClientOptions;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private isIntentionallyClosed = false;
  private messageQueue: GatewayMessage[] = [];

  constructor(options: GatewayClientOptions) {
    super();
    this.options = {
      reconnectInterval: 3000,
      maxReconnectInterval: 30000,
      heartbeatInterval: 30000,
      ...options
    };
  }

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log('[GatewayClient] Already connected');
      return;
    }

    this.isIntentionallyClosed = false;
    
    try {
      console.log(`[GatewayClient] Connecting to ${this.options.url}...`);
      
      // Connect with auth token in headers
      this.ws = new WebSocket(this.options.url, {
        headers: {
          'Authorization': `Bearer ${this.options.token}`
        }
      });

      this.setupEventHandlers();
    } catch (err) {
      console.error('[GatewayClient] Connection error:', err);
      this.scheduleReconnect();
    }
  }

  private setupEventHandlers(): void {
    if (!this.ws) return;

    this.ws.on('open', () => {
      console.log('[GatewayClient] Connected to Gateway');
      this.reconnectAttempts = 0;
      this.emit('connected');
      this.startHeartbeat();
      this.flushMessageQueue();
    });

    this.ws.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleMessage(message);
      } catch (err) {
        console.error('[GatewayClient] Failed to parse message:', err);
      }
    });

    this.ws.on('close', (code: number, reason: Buffer) => {
      console.log(`[GatewayClient] Connection closed: ${code} ${reason.toString()}`);
      this.stopHeartbeat();
      this.emit('disconnected', code, reason.toString());
      
      if (!this.isIntentionallyClosed) {
        this.scheduleReconnect();
      }
    });

    this.ws.on('error', (err: Error) => {
      console.error('[GatewayClient] WebSocket error:', err.message);
      this.emit('error', err);
    });

    this.ws.on('ping', () => {
      // Respond with pong
      this.ws?.pong();
    });
  }

  private handleMessage(message: GatewayMessage): void {
    // Emit raw message for processing
    this.emit('message', message);

    // Handle specific message types
    switch (message.type) {
      case 'welcome':
        console.log('[GatewayClient] Gateway welcome:', message.message);
        break;
      
      case 'error':
        console.error('[GatewayClient] Gateway error:', message.error);
        this.emit('gateway_error', message.error);
        break;
      
      case 'pong':
        // Heartbeat response
        break;
      
      default:
        // Forward OpenClaw events
        if (this.isOpenClawEvent(message)) {
          this.emit('event', message as RawGatewayEvent);
        }
    }
  }

  private isOpenClawEvent(message: GatewayMessage): boolean {
    // Check if message looks like an OpenClaw event
    return [
      'session_start', 'session_end',
      'tool_call', 'tool_result',
      'model_usage', 'agent_thought',
      'decision', 'error_event'
    ].includes(message.type);
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;

    const delay = Math.min(
      this.options.reconnectInterval! * Math.pow(1.5, this.reconnectAttempts),
      this.options.maxReconnectInterval!
    );

    this.reconnectAttempts++;
    console.log(`[GatewayClient] Reconnecting in ${Math.round(delay)}ms (attempt ${this.reconnectAttempts})...`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.send({ type: 'ping' });
      }
    }, this.options.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0) {
      const msg = this.messageQueue.shift();
      if (msg) this.send(msg);
    }
  }

  send(message: GatewayMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      this.messageQueue.push(message);
    }
  }

  disconnect(): void {
    this.isIntentionallyClosed = true;
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    this.stopHeartbeat();
    
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    
    console.log('[GatewayClient] Disconnected');
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  getConnectionState(): 'connected' | 'connecting' | 'disconnected' {
    if (!this.ws) return 'disconnected';
    switch (this.ws.readyState) {
      case WebSocket.OPEN: return 'connected';
      case WebSocket.CONNECTING: return 'connecting';
      default: return 'disconnected';
    }
  }
}
