import React from 'react';
import { Wifi, WifiOff, Loader2, Server, RefreshCw } from 'lucide-react';
import './GatewayStatus.css';

interface Props {
  status: 'connected' | 'disconnected' | 'connecting';
  gatewayUrl?: string;
  reconnectAttempts?: number;
  onReconnect?: () => void;
}

export function GatewayStatus({ status, gatewayUrl, reconnectAttempts = 0, onReconnect }: Props) {
  const getStatusConfig = () => {
    switch (status) {
      case 'connected':
        return {
          icon: Wifi,
          label: 'Connected',
          className: 'status-connected',
          pulse: false
        };
      case 'connecting':
        return {
          icon: Loader2,
          label: reconnectAttempts > 0 ? `Reconnecting #${reconnectAttempts}` : 'Connecting...',
          className: 'status-connecting',
          pulse: true
        };
      case 'disconnected':
      default:
        return {
          icon: WifiOff,
          label: reconnectAttempts > 0 ? `Disconnected (${reconnectAttempts})` : 'Disconnected',
          className: 'status-disconnected',
          pulse: false
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <div className={`gateway-status ${config.className}`}>
      <Icon 
        size={14} 
        className={config.pulse ? 'animate-spin' : ''} 
      />
      <span className="status-label">{config.label}</span>
      
      {gatewayUrl && status === 'connected' && (
        <span className="status-url" title={gatewayUrl}>
          <Server size={12} />
          {(() => {
            try {
              return new URL(gatewayUrl).host;
            } catch {
              return gatewayUrl === 'filesystem' ? 'File Watcher' : gatewayUrl.slice(0, 20);
            }
          })()}
        </span>
      )}
      
      {status === 'disconnected' && onReconnect && (
        <button 
          className="reconnect-btn"
          onClick={onReconnect}
          title="Reconnect now"
        >
          <RefreshCw size={12} />
        </button>
      )}
    </div>
  );
}
