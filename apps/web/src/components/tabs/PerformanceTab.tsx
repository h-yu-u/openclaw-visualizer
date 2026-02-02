import React, { useMemo, useState } from 'react';
import { TaskSession, ToolCall } from '../../types';
import { TrendingUp, DollarSign, Clock, Activity, BarChart3, Zap, Hash, Percent, ChevronDown, ChevronUp } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, LineChart, Line
} from 'recharts';
import './PerformanceTab.css';

interface Props {
  session: TaskSession;
  toolCalls?: ToolCall[];
}

const COLORS = ['#22d3ee', '#10b981', '#f59e0b', '#ef4444', '#a855f7', '#3b82f6'];

interface ToolStats {
  name: string;
  count: number;
  totalTokens: number;
  avgTokens: number;
  avgDuration: number;
  successRate: number;
  totalCost: number;
}

export function PerformanceTab({ session, toolCalls = [] }: Props) {
  // Token usage over time (simulated cumulative data)
  const tokenTimelineData = useMemo(() => {
    const data: Array<{ time: string; input: number; output: number; total: number }> = [];
    let cumulativeIn = 0;
    let cumulativeOut = 0;
    
    toolCalls.forEach((call, index) => {
      cumulativeIn += call.tokensIn || 0;
      cumulativeOut += call.tokensOut || 0;
      
      data.push({
        time: `Step ${index + 1}`,
        input: cumulativeIn,
        output: cumulativeOut,
        total: cumulativeIn + cumulativeOut
      });
    });
    
    // If no tool calls, show session totals
    if (data.length === 0 && (session.totalTokensIn > 0 || session.totalTokensOut > 0)) {
      data.push({
        time: 'Session',
        input: session.totalTokensIn,
        output: session.totalTokensOut,
        total: session.totalTokensIn + session.totalTokensOut
      });
    }
    
    return data;
  }, [toolCalls, session]);

  // Tool execution time distribution
  const executionTimeData = useMemo(() => {
    const buckets: Record<string, number> = {
      '<100ms': 0,
      '100-500ms': 0,
      '500ms-1s': 0,
      '1-3s': 0,
      '>3s': 0
    };
    
    toolCalls.forEach(call => {
      const duration = call.durationMs || 0;
      if (duration < 100) buckets['<100ms']++;
      else if (duration < 500) buckets['100-500ms']++;
      else if (duration < 1000) buckets['500ms-1s']++;
      else if (duration < 3000) buckets['1-3s']++;
      else buckets['>3s']++;
    });
    
    return Object.entries(buckets)
      .filter(([, count]) => count > 0)
      .map(([range, count]) => ({ range, count }));
  }, [toolCalls]);

  // Tool performance by average duration
  const toolPerformanceData = useMemo(() => {
    const toolStats: Record<string, { total: number; count: number; min: number; max: number }> = {};
    
    toolCalls.forEach(call => {
      const duration = call.durationMs || 0;
      if (!toolStats[call.toolName]) {
        toolStats[call.toolName] = { total: 0, count: 0, min: Infinity, max: 0 };
      }
      const stats = toolStats[call.toolName];
      stats.total += duration;
      stats.count++;
      stats.min = Math.min(stats.min, duration);
      stats.max = Math.max(stats.max, duration);
    });
    
    return Object.entries(toolStats)
      .map(([name, stats]) => ({
        name,
        avg: Math.round(stats.total / stats.count),
        min: stats.min === Infinity ? 0 : stats.min,
        max: stats.max
      }))
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 8);
  }, [toolCalls]);

  // Cost breakdown by tool (estimated)
  const costBreakdownData = useMemo(() => {
    const toolCosts: Record<string, number> = {};
    
    // Distribute session cost across tools proportionally by token usage
    const totalTokens = session.totalTokensIn + session.totalTokensOut;
    
    if (totalTokens > 0) {
      toolCalls.forEach(call => {
        const callTokens = (call.tokensIn || 0) + (call.tokensOut || 0);
        const proportion = callTokens / totalTokens;
        const estimatedCost = session.estimatedCost * proportion;
        toolCosts[call.toolName] = (toolCosts[call.toolName] || 0) + estimatedCost;
      });
    }
    
    return Object.entries(toolCosts)
      .map(([name, cost]) => ({ name, cost: parseFloat(cost.toFixed(4)) }))
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 6);
  }, [toolCalls, session]);

  const stats = useMemo(() => {
    const durations = toolCalls.map(c => c.durationMs || 0).filter(d => d > 0);
    const avgDuration = durations.length > 0 
      ? durations.reduce((a, b) => a + b, 0) / durations.length 
      : 0;
    const maxDuration = durations.length > 0 ? Math.max(...durations) : 0;
    
    return {
      totalCalls: toolCalls.length,
      avgDuration: Math.round(avgDuration),
      maxDuration,
      totalTokens: session.totalTokensIn + session.totalTokensOut,
      costPer1K: session.totalTokensIn + session.totalTokensOut > 0
        ? (session.estimatedCost / ((session.totalTokensIn + session.totalTokensOut) / 1000)).toFixed(4)
        : '0.0000'
    };
  }, [toolCalls, session]);

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  // Tool statistics table data
  const toolStatsTable: ToolStats[] = useMemo(() => {
    const stats: Record<string, ToolStats> = {};

    toolCalls.forEach(call => {
      if (!stats[call.toolName]) {
        stats[call.toolName] = {
          name: call.toolName,
          count: 0,
          totalTokens: 0,
          avgTokens: 0,
          avgDuration: 0,
          successRate: 0,
          totalCost: 0
        };
      }
      const s = stats[call.toolName];
      s.count++;
      s.totalTokens += (call.tokensIn || 0) + (call.tokensOut || 0);
      s.avgDuration += call.durationMs || 0;
      if (call.status === 'success') s.successRate++;
    });

    // Calculate averages
    const totalTokensAll = Object.values(stats).reduce((sum, s) => sum + s.totalTokens, 0);

    return Object.values(stats).map(s => ({
      ...s,
      avgTokens: Math.round(s.totalTokens / s.count),
      avgDuration: Math.round(s.avgDuration / s.count),
      successRate: Math.round((s.successRate / s.count) * 100),
      totalCost: totalTokensAll > 0
        ? (session.estimatedCost * (s.totalTokens / totalTokensAll))
        : 0
    })).sort((a, b) => b.count - a.count);
  }, [toolCalls, session]);

  const [sortConfig, setSortConfig] = useState<{ key: keyof ToolStats; direction: 'asc' | 'desc' } | null>(null);

  const sortedToolStats = useMemo(() => {
    if (!sortConfig) return toolStatsTable;
    return [...toolStatsTable].sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];
      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [toolStatsTable, sortConfig]);

  const handleSort = (key: keyof ToolStats) => {
    setSortConfig(current => {
      if (!current || current.key !== key) {
        return { key, direction: 'desc' };
      }
      return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
    });
  };

  return (
    <div className="performance-tab">
      {/* Stats Cards */}
      <div className="perf-stats-grid">
        <div className="perf-stat-card">
          <div className="perf-stat-icon">
            <Activity size={20} />
          </div>
          <div className="perf-stat-content">
            <div className="perf-stat-value">{stats.totalCalls}</div>
            <div className="perf-stat-label">Total Calls</div>
          </div>
        </div>

        <div className="perf-stat-card">
          <div className="perf-stat-icon cyan">
            <Clock size={20} />
          </div>
          <div className="perf-stat-content">
            <div className="perf-stat-value">{formatDuration(stats.avgDuration)}</div>
            <div className="perf-stat-label">Avg Duration</div>
          </div>
        </div>

        <div className="perf-stat-card">
          <div className="perf-stat-icon purple">
            <TrendingUp size={20} />
          </div>
          <div className="perf-stat-content">
            <div className="perf-stat-value">{formatDuration(stats.maxDuration)}</div>
            <div className="perf-stat-label">Max Duration</div>
          </div>
        </div>

        <div className="perf-stat-card">
          <div className="perf-stat-icon green">
            <BarChart3 size={20} />
          </div>
          <div className="perf-stat-content">
            <div className="perf-stat-value">{stats.totalTokens.toLocaleString()}</div>
            <div className="perf-stat-label">Total Tokens</div>
          </div>
        </div>

        <div className="perf-stat-card">
          <div className="perf-stat-icon orange">
            <DollarSign size={20} />
          </div>
          <div className="perf-stat-content">
            <div className="perf-stat-value">${stats.costPer1K}</div>
            <div className="perf-stat-label">Cost / 1K tokens</div>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="perf-charts-grid">
        {/* Token Usage Over Time */}
        <div className="perf-chart-card wide">
          <h4>Token Usage Over Time</h4>
          <div className="perf-chart-container">
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={tokenTimelineData}>
                <defs>
                  <linearGradient id="colorInput" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#22d3ee" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorOutput" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="time" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} />
                <RechartsTooltip 
                  contentStyle={{ 
                    backgroundColor: '#1e293b', 
                    border: 'none', 
                    borderRadius: '8px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                  }}
                  formatter={(value: number) => value.toLocaleString()}
                />
                <Area 
                  type="monotone" 
                  dataKey="input" 
                  name="Input Tokens"
                  stroke="#22d3ee" 
                  fillOpacity={1} 
                  fill="url(#colorInput)" 
                />
                <Area 
                  type="monotone" 
                  dataKey="output" 
                  name="Output Tokens"
                  stroke="#10b981" 
                  fillOpacity={1} 
                  fill="url(#colorOutput)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Execution Time Distribution */}
        <div className="perf-chart-card">
          <h4>Execution Time Distribution</h4>
          <div className="perf-chart-container">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={executionTimeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="range" stroke="#94a3b8" fontSize={10} angle={-45} textAnchor="end" height={60} />
                <YAxis stroke="#94a3b8" fontSize={11} />
                <RechartsTooltip 
                  contentStyle={{ 
                    backgroundColor: '#1e293b', 
                    border: 'none', 
                    borderRadius: '8px' 
                  }}
                />
                <Bar dataKey="count" fill="#a855f7" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Tool Performance */}
        <div className="perf-chart-card">
          <h4>Avg Duration by Tool</h4>
          <div className="perf-chart-container">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={toolPerformanceData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                <XAxis type="number" stroke="#94a3b8" fontSize={11} tickFormatter={(v) => `${v}ms`} />
                <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={10} width={80} />
                <RechartsTooltip 
                  contentStyle={{ 
                    backgroundColor: '#1e293b', 
                    border: 'none', 
                    borderRadius: '8px' 
                  }}
                  formatter={(value: number) => formatDuration(value)}
                />
                <Bar dataKey="avg" fill="#f59e0b" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Cost Breakdown */}
        <div className="perf-chart-card">
          <h4>Cost Breakdown by Tool</h4>
          <div className="perf-chart-container">
            {costBreakdownData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={costBreakdownData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="cost"
                    nameKey="name"
                  >
                    {costBreakdownData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    contentStyle={{ 
                      backgroundColor: '#1e293b', 
                      border: 'none', 
                      borderRadius: '8px' 
                    }}
                    formatter={(value: number) => `$${value.toFixed(4)}`}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="no-data">No cost data available</div>
            )}
            <div className="chart-legend-vertical">
              {costBreakdownData.map((item, i) => (
                <div key={item.name} className="legend-item">
                  <span className="legend-color" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                  <span className="legend-label">{item.name}: ${item.cost.toFixed(4)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Token Efficiency */}
        <div className="perf-chart-card wide">
          <h4>Token Usage per Tool Call</h4>
          <div className="perf-chart-container">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={toolCalls.filter(c => (c.tokensIn || 0) + (c.tokensOut || 0) > 0).map((call, i) => ({
                step: `Call ${i + 1}`,
                input: call.tokensIn || 0,
                output: call.tokensOut || 0,
                tool: call.toolName
              }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="step" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} />
                <RechartsTooltip 
                  contentStyle={{ 
                    backgroundColor: '#1e293b', 
                    border: 'none', 
                    borderRadius: '8px' 
                  }}
                  formatter={(value: number, name: string, props: any) => {
                    const tool = props?.payload?.tool;
                    return [`${value.toLocaleString()} tokens`, `${name}${tool ? ` (${tool})` : ''}`];
                  }}
                />
                <Bar dataKey="input" name="Input" stackId="a" fill="#22d3ee" radius={[0, 0, 4, 4]} />
                <Bar dataKey="output" name="Output" stackId="a" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Tool Statistics Table */}
      {toolStatsTable.length > 0 && (
        <div className="perf-table-section">
          <h4 className="perf-table-title">
            <BarChart3 size={16} />
            Tool Call Statistics
          </h4>
          <div className="perf-table-container">
            <table className="perf-table">
              <thead>
                <tr>
                  <th onClick={() => handleSort('name')} className="sortable">
                    Tool {sortConfig?.key === 'name' && (sortConfig.direction === 'asc' ? <ChevronUp size={14}/> : <ChevronDown size={14}/>)}
                  </th>
                  <th onClick={() => handleSort('count')} className="sortable numeric">
                    <Hash size={14}/> Calls {sortConfig?.key === 'count' && (sortConfig.direction === 'asc' ? <ChevronUp size={14}/> : <ChevronDown size={14}/>)}
                  </th>
                  <th onClick={() => handleSort('totalTokens')} className="sortable numeric">
                    <Zap size={14}/> Total Tokens {sortConfig?.key === 'totalTokens' && (sortConfig.direction === 'asc' ? <ChevronUp size={14}/> : <ChevronDown size={14}/>)}
                  </th>
                  <th onClick={() => handleSort('avgTokens')} className="sortable numeric">
                    Avg Tokens {sortConfig?.key === 'avgTokens' && (sortConfig.direction === 'asc' ? <ChevronUp size={14}/> : <ChevronDown size={14}/>)}
                  </th>
                  <th onClick={() => handleSort('avgDuration')} className="sortable numeric">
                    <Clock size={14}/> Avg Duration {sortConfig?.key === 'avgDuration' && (sortConfig.direction === 'asc' ? <ChevronUp size={14}/> : <ChevronDown size={14}/>)}
                  </th>
                  <th onClick={() => handleSort('successRate')} className="sortable numeric">
                    <Percent size={14}/> Success {sortConfig?.key === 'successRate' && (sortConfig.direction === 'asc' ? <ChevronUp size={14}/> : <ChevronDown size={14}/>)}
                  </th>
                  <th onClick={() => handleSort('totalCost')} className="sortable numeric">
                    <DollarSign size={14}/> Cost {sortConfig?.key === 'totalCost' && (sortConfig.direction === 'asc' ? <ChevronUp size={14}/> : <ChevronDown size={14}/>)}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedToolStats.map(tool => (
                  <tr key={tool.name}>
                    <td className="tool-name">{tool.name}</td>
                    <td className="numeric">{tool.count}</td>
                    <td className="numeric">{tool.totalTokens.toLocaleString()}</td>
                    <td className="numeric">{tool.avgTokens.toLocaleString()}</td>
                    <td className="numeric">{formatDuration(tool.avgDuration)}</td>
                    <td className="numeric">
                      <span className={`success-rate ${tool.successRate >= 90 ? 'high' : tool.successRate >= 50 ? 'medium' : 'low'}`}>
                        {tool.successRate}%
                      </span>
                    </td>
                    <td className="numeric">${tool.totalCost.toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
