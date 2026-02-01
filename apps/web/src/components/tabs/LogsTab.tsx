import React, { useState } from 'react';
import { TaskSession, ToolCall } from '../../types';
import { ChevronDown, ChevronRight, Terminal } from 'lucide-react';
import './LogsTab.css';

interface Props {
  session: TaskSession;
}

export function LogsTab({ session }: Props) {
  const [expandedCalls, setExpandedCalls] = useState<Set<string>>(new Set());
  const { toolCalls } = session;

  const toggleExpand = (callId: string) => {
    const newSet = new Set(expandedCalls);
    if (newSet.has(callId)) {
      newSet.delete(callId);
    } else {
      newSet.add(callId);
    }
    setExpandedCalls(newSet);
  };

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

  return (
    <div className="logs-tab">
      <div className="logs-header">
        <Terminal size={18} />
        <span>{toolCalls.length} tool call{toolCalls.length !== 1 ? 's' : ''}</span>
      </div>

      {toolCalls.length === 0 ? (
        <div className="empty-state">
          <p>No tool calls recorded</p>
        </div>
      ) : (
        <div className="logs-list">
          {toolCalls.map((call) => (
            <div key={call.id} className="log-item">
              <div 
                className="log-header"
                onClick={() => toggleExpand(call.id)}
              >
                {expandedCalls.has(call.id) ? 
                  <ChevronDown size={16} /> : 
                  <ChevronRight size={16} />
                }
                <span 
                  className="log-status"
                  style={{ color: getStatusColor(call.status) }}
                >
                  [{call.status.toUpperCase()}]
                </span>
                
                <span className="log-tool">{call.toolName}</span>
                
                <span className="log-time">
                  {new Date(call.startTime).toLocaleTimeString()}
                </span>
              </div>

              {expandedCalls.has(call.id) && (
                <div className="log-details">
                  <div className="log-section">
                    <h4>Parameters</h4>
                    <pre>{JSON.stringify(call.parameters, null, 2)}</pre>
                  </div>

                  {call.result && (
                    <div className="log-section">
                      <h4>Result</h4>
                      <pre>{JSON.stringify(call.result, null, 2)}</pre>
                    </div>
                  )}

                  {call.error && (
                    <div className="log-section error">
                      <h4>Error</h4>
                      <pre>{call.error}</pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}