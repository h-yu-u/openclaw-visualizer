import React from 'react';
import { useTaskStore } from '../../store';
import { Play, CheckCircle, XCircle, Clock } from 'lucide-react';
import './Sidebar.css';

export function Sidebar() {
  const { sessions, selectedSessionId, selectSession } = useTaskStore();

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <Play className="status-icon running" size={16} />;
      case 'completed':
        return <CheckCircle className="status-icon completed" size={16} />;
      case 'failed':
        return <XCircle className="status-icon failed" size={16} />;
      default:
        return <Clock className="status-icon pending" size={16} />;
    }
  };

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h2>Sessions</h2>
        <span className="session-count">{sessions.length}</span>
      </div>
      
      <div className="session-list">
        {sessions.length === 0 ? (
          <div className="empty-state">
            <p>No sessions yet</p>
            <p className="hint">Waiting for OpenClaw tasks...</p>
          </div>
        ) : (
          sessions.map((session) => (
            <div
              key={session.id}
              className={`session-item ${selectedSessionId === session.id ? 'selected' : ''}`}
              onClick={() => selectSession(session.id)}
            >
              <div className="session-status">
                {getStatusIcon(session.status)}
              </div>
              <div className="session-info">
                <div className="session-name">
                  {session.name || `Session ${session.id.slice(0, 8)}`}
                </div>
                <div className="session-meta">
                  <span>{formatTime(session.startTime)}</span>
                  {session.estimatedCost > 0 && (
                    <span className="cost">${session.estimatedCost.toFixed(4)}</span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}