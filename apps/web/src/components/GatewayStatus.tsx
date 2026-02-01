import React from 'react';
import { Wifi, WifiOff, Loader2, Server } from 'lucide-react';
import './GatewayStatus.css';

interface Props {
  status: 'connected' | 'disconnected' | 'connecting';
  gatewayUrl?: string;
}

export function GatewayStatus({ status, gatewayUrl }: Props) {
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
          label: 'Connecting...',
          className: 'status-connecting',
          pulse: true
        };
      case 'disconnected':
      default:
        return {
          icon: WifiOff,
          label: 'Disconnected',
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
      
      {gatewayUrl && (
        <span className="status-url" title={gatewayUrl}>
          <Server size={12} />
          {new URL(gatewayUrl).host}
        </span>
      )}
    </div>
  );
}
