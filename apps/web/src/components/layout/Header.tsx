import React from 'react';
import { useTaskStore } from '../../store';
import { Wifi, WifiOff, Loader2 } from 'lucide-react';
import './Header.css';

export function Header() {
  const { connectionStatus, sessions, getRunningSessions } = useTaskStore();
  const runningCount = getRunningSessions().length;

  const getStatusIcon = () => {
    switch (connectionStatus) {
      case 'connected':
        return <Wifi className="status-icon connected" size={18} />;
      case 'connecting':
        return <Loader2 className="status-icon connecting" size={18} />;
      default:
        return <WifiOff className="status-icon disconnected" size={18} />;
    }
  };

  const getStatusText = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'Live';
      case 'connecting':
        return 'Connecting...';
      default:
        return 'Disconnected';
    }
  };

  return (
    <header className="header">
      <div className="header-left">
        <h1>OpenClaw Visualizer</h1>
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
        <div className={`connection-status ${connectionStatus}`}>
          {getStatusIcon()}
          <span>{getStatusText()}</span>
        </div>
      </div>
    </header>
  );
}