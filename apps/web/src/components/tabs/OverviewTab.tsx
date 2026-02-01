import React from 'react';
import { TaskSession } from '../../types';
import { Activity, DollarSign, Clock, Layers } from 'lucide-react';
import './OverviewTab.css';

interface Props {
  session: TaskSession;
}

export function OverviewTab({ session }: Props) {
  const duration = session.endTime 
    ? new Date(session.endTime).getTime() - new Date(session.startTime).getTime()
    : Date.now() - new Date(session.startTime).getTime();

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  const stats = [
    {
      icon: Layers,
      label: 'Tool Calls',
      value: session.toolCalls?.length || 0,
      color: 'blue'
    },
    {
      icon: Activity,
      label: 'Tokens In',
      value: session.totalTokensIn.toLocaleString(),
      color: 'green'
    },
    {
      icon: Activity,
      label: 'Tokens Out',
      value: session.totalTokensOut.toLocaleString(),
      color: 'purple'
    },
    {
      icon: DollarSign,
      label: 'Est. Cost',
      value: `$${session.estimatedCost.toFixed(4)}`,
      color: 'orange'
    },
    {
      icon: Clock,
      label: 'Duration',
      value: formatDuration(duration),
      color: 'cyan'
    }
  ];

  return (
    <div className="overview-tab">
      <div className="stats-grid">
        {stats.map((stat, index) => (
          <div key={index} className={`stat-card ${stat.color}`}>
            <div className="stat-icon">
              <stat.icon size={24} />
            </div>
            <div className="stat-content">
              <div className="stat-value">{stat.value}</div>
              <div className="stat-label">{stat.label}</div>
            </div>
          </div>
        ))}
      </div>
      
      <div className="session-details">
        <h3>Session Details</h3>
        <div className="detail-row">
          <span className="label">Session ID:</span>
          <span className="value">{session.id}</span>
        </div>
        <div className="detail-row">
          <span className="label">Status:</span>
          <span className={`value status-${session.status}`}>{session.status}</span>
        </div>
        <div className="detail-row">
          <span className="label">Started:</span>
          <span className="value">{new Date(session.startTime).toLocaleString()}</span>
        </div>
        {session.endTime && (
          <div className="detail-row">
            <span className="label">Ended:</span>
            <span className="value">{new Date(session.endTime).toLocaleString()}</span>
          </div>
        )}
        {session.channel && (
          <div className="detail-row">
            <span className="label">Channel:</span>
            <span className="value">{session.channel}</span>
          </div>
        )}
      </div>
    </div>
  );
}