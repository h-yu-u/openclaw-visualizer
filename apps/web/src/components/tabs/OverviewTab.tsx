import React from 'react';
import { TaskSession, ToolCall } from '../../types';
import { Activity, DollarSign, Clock, Layers, Cpu, Zap } from 'lucide-react';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line, AreaChart, Area
} from 'recharts';
import './OverviewTab.css';

interface Props {
  session: TaskSession;
  toolCalls?: ToolCall[];
}

const COLORS = ['#22d3ee', '#10b981', '#f59e0b', '#ef4444', '#a855f7', '#3b82f6'];

export function OverviewTab({ session, toolCalls = [] }: Props) {
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

  // Calculate tool usage distribution
  const toolUsageData = React.useMemo(() => {
    const counts: Record<string, number> = {};
    toolCalls.forEach(call => {
      counts[call.toolName] = (counts[call.toolName] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [toolCalls]);

  // Token distribution data
  const tokenData = [
    { name: 'Input', value: session.totalTokensIn, color: '#22d3ee' },
    { name: 'Output', value: session.totalTokensOut, color: '#10b981' }
  ];

  // Tool execution time data
  const toolTimingData = React.useMemo(() => {
    return toolCalls
      .filter(call => call.durationMs)
      .map(call => ({
        name: call.toolName,
        duration: call.durationMs || 0
      }))
      .slice(-10);
  }, [toolCalls]);

  // Status distribution
  const statusData = React.useMemo(() => {
    const counts: Record<string, number> = { success: 0, error: 0, running: 0, pending: 0 };
    toolCalls.forEach(call => {
      counts[call.status] = (counts[call.status] || 0) + 1;
    });
    return [
      { name: 'Success', value: counts.success, color: '#10b981' },
      { name: 'Error', value: counts.error, color: '#ef4444' },
      { name: 'Running', value: counts.running, color: '#22d3ee' },
      { name: 'Pending', value: counts.pending, color: '#94a3b8' }
    ].filter(d => d.value > 0);
  }, [toolCalls]);

  const stats = [
    {
      icon: Layers,
      label: 'Tool Calls',
      value: toolCalls.length,
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
    },
    {
      icon: Cpu,
      label: 'Tokens/Call',
      value: toolCalls.length > 0 
        ? Math.round((session.totalTokensIn + session.totalTokensOut) / toolCalls.length).toLocaleString()
        : '0',
      color: 'blue'
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

      <div className="charts-grid">
        {/* Token Distribution */}
        <div className="chart-card">
          <h4>Token Distribution</h4>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={tokenData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {tokenData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip 
                  formatter={(value: number) => value.toLocaleString()}
                  contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="chart-legend">
              {tokenData.map((item, i) => (
                <div key={i} className="legend-item">
                  <span className="legend-color" style={{ backgroundColor: item.color }} />
                  <span className="legend-label">{item.name}: {item.value.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Tool Usage Distribution */}
        <div className="chart-card">
          <h4>Tool Usage</h4>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={toolUsageData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis type="number" stroke="#94a3b8" fontSize={12} />
                <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={11} width={80} />
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }}
                />
                <Bar dataKey="value" fill="#22d3ee" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Execution Status */}
        <div className="chart-card">
          <h4>Execution Status</h4>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  dataKey="value"
                  label={({ name, value }) => value > 0 ? `${name}: ${value}` : ''}
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Tool Execution Time */}
        <div className="chart-card wide">
          <h4>Recent Tool Execution Times (ms)</h4>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={toolTimingData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={12} />
                <RechartsTooltip 
                  formatter={(value: number) => `${value}ms`}
                  contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }}
                />
                <Bar dataKey="duration" fill="#a855f7" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
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
        {session.agentId && (
          <div className="detail-row">
            <span className="label">Agent:</span>
            <span className="value">{session.agentId}</span>
          </div>
        )}
      </div>
    </div>
  );
}
