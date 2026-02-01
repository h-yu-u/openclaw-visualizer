import React from 'react';
import { TaskSession } from '../../types';
import './TimelineTab.css';

interface Props {
  session: TaskSession;
}

export function TimelineTab({ session }: Props) {
  const { toolCalls } = session;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return '#10b981';
      case 'error':
        return '#ef4444';
      case 'running':
        return '#22d3ee';
      default:
        return '#94a3b8';
    }
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return 'N/A';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <div className="timeline-tab">
      <h3>Tool Execution Timeline</h3>
      
      {toolCalls.length === 0 ? (
        <div className="empty-state">
          <p>No tool calls recorded for this session</p>
        </div>
      ) : (
        <div className="timeline">
          {toolCalls.map((call, index) => (
            <div key={call.id} className="timeline-item">
              <div className="timeline-marker" style={{ backgroundColor: getStatusColor(call.status) }} />
              <div className="timeline-content">
                <div className="tool-header">
                  <span className="tool-name">{call.toolName}</span>
                  <span className="tool-status" style={{ color: getStatusColor(call.status) }}>
                    {call.status}
                  </span>
                </div>
                
                <div className="tool-details">
                  <div className="detail">
                    <span className="label">Duration:</span>
                    <span className="value">{formatDuration(call.durationMs)}</span>
                  </div>
                  
                  {call.tokensIn !== undefined && (
                    <div className="detail">
                      <span className="label">Tokens:</span>
                      <span className="value">{call.tokensIn} in / {call.tokensOut} out</span>
                    </div>
                  )}
                </div>
                
                {call.error && (
                  <div className="tool-error">
                    <span className="error-label">Error:</span>
                    {call.error}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}