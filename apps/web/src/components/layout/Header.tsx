import React from 'react';
import { useTaskStore } from '../../store';
import { GatewayStatus } from '../GatewayStatus';
import './Header.css';

export function Header() {
  const { connectionStatus, sessions, getRunningSessions, gatewayStatus } = useTaskStore();
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
        <div className="status-group">
          {gatewayStatus && (
            <GatewayStatus 
              status={gatewayStatus.state as any} 
              gatewayUrl={gatewayStatus.url}
            />
          )}
        </div>
      </div>
    </header>
  );
}
