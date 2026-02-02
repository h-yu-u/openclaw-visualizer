import React from 'react';
import { Bell, BellOff } from 'lucide-react';
import { useTaskStore } from '../../store';
import { GatewayStatus } from '../GatewayStatus';
import './Header.css';

interface HeaderProps {
  connectionStatus: 'connected' | 'disconnected' | 'connecting';
  reconnectAttempts?: number;
  onReconnect?: () => void;
  notificationsEnabled?: boolean;
  onToggleNotifications?: () => void;
}

export function Header({ 
  connectionStatus, 
  reconnectAttempts = 0, 
  onReconnect,
  notificationsEnabled,
  onToggleNotifications
}: HeaderProps) {
  const { sessions, getRunningSessions, gatewayStatus } = useTaskStore();
  const runningCount = getRunningSessions().length;

  return (
    <header className="header">
      <div className="header-left">
        <div className="logo">
          <div className="logo-icon">⚡</div>
          <h1>OpenClaw Visualizer</h1>
        </div>
      </div>
      
      <div className="header-center">
        <div className="stats">
          <div className="stat">
            <span className="stat-value">{sessions.length}</span>
            <span className="stat-label">Total Sessions</span>
          </div>
          {runningCount > 0 && (
            <div className="stat">
              <span className="stat-value running">{runningCount}</span>
              <span className="stat-label">Running</span>
            </div>
          )}
        </div>
      </div>
      
      <div className="header-right">
        {onToggleNotifications && (
          <button 
            className={`notification-btn ${notificationsEnabled ? 'enabled' : 'disabled'}`}
            onClick={onToggleNotifications}
            title={notificationsEnabled ? 'Disable notifications' : 'Enable notifications'}
          >
            {notificationsEnabled ? <Bell size={16} /> : <BellOff size={16} />}
          </button>
        )}
        <div className="status-group">
          <GatewayStatus 
            status={connectionStatus} 
            gatewayUrl={gatewayStatus?.url}
            reconnectAttempts={reconnectAttempts}
            onReconnect={onReconnect}
          />
        </div>
      </div>
    </header>
  );
}
