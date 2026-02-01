import React, { useState, useMemo, useCallback } from 'react';
import { TaskSession, ToolCall } from '../../types';
import { 
  ChevronDown, ChevronRight, Terminal, Search, 
  Filter, Copy, Check, Download, X, Clock, Zap
} from 'lucide-react';
import './LogsTab.css';

interface Props {
  session: TaskSession;
  toolCalls?: ToolCall[];
}

type FilterStatus = 'all' | 'success' | 'error' | 'running';

// Syntax highlighter for JSON
function SyntaxHighlightedJSON({ data }: { data: any }) {
  if (data === undefined || data === null) {
    return <pre className="syntax-highlighted"><span className="json-null">null</span></pre>;
  }
  
  const jsonString = JSON.stringify(data, null, 2);
  
  const highlighted = jsonString
    .replace(/"([^"]+)":/g, '<span class="json-key">"$1":</span>')
    .replace(/: "([^"]*)"/g, ': <span class="json-string">"$1"</span>')
    .replace(/: (\d+)/g, ': <span class="json-number">$1</span>')
    .replace(/: (true|false)/g, ': <span class="json-boolean">$1</span>')
    .replace(/: (null)/g, ': <span class="json-null">$1</span>');

  return (
    <pre 
      className="syntax-highlighted"
      dangerouslySetInnerHTML={{ __html: highlighted }}
    />
  );
}

export function LogsTab({ session, toolCalls = [] }: Props) {
  const [expandedCalls, setExpandedCalls] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Filter and search
  const filteredCalls = useMemo(() => {
    return toolCalls.filter(call => {
      // Status filter
      if (statusFilter !== 'all' && call.status !== statusFilter) {
        return false;
      }
      
      // Search query
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const searchContent = [
          call.toolName,
          call.status,
          JSON.stringify(call.parameters),
          JSON.stringify(call.result),
          call.error
        ].join(' ').toLowerCase();
        
        return searchContent.includes(query);
      }
      
      return true;
    });
  }, [toolCalls, searchQuery, statusFilter]);

  const toggleExpand = useCallback((callId: string) => {
    setExpandedCalls(prev => {
      const newSet = new Set(prev);
      if (newSet.has(callId)) {
        newSet.delete(callId);
      } else {
        newSet.add(callId);
      }
      return newSet;
    });
  }, []);

  const expandAll = useCallback(() => {
    setExpandedCalls(new Set(filteredCalls.map(c => c.id)));
  }, [filteredCalls]);

  const collapseAll = useCallback(() => {
    setExpandedCalls(new Set());
  }, []);

  const copyToClipboard = useCallback(async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  const exportLogs = useCallback(() => {
    const data = {
      session,
      toolCalls: filteredCalls,
      exportedAt: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `session-${session.id}-logs.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [session, filteredCalls]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return '#10b981';
      case 'error': return '#ef4444';
      case 'running': return '#22d3ee';
      default: return '#94a3b8';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return '✓';
      case 'error': return '✗';
      case 'running': return '⟳';
      default: return '○';
    }
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return '-';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const stats = useMemo(() => ({
    total: toolCalls.length,
    filtered: filteredCalls.length,
    success: filteredCalls.filter(c => c.status === 'success').length,
    error: filteredCalls.filter(c => c.status === 'error').length,
    running: filteredCalls.filter(c => c.status === 'running').length
  }), [toolCalls, filteredCalls]);

  return (
    <div className="logs-tab">
      {/* Header */}
      <div className="logs-header">
        <div className="logs-title">
          <Terminal size={18} />
          <span>Tool Call Logs</span>
          <span className="logs-count">
            {stats.filtered} / {stats.total}
          </span>
        </div>
        
        <div className="logs-actions">
          <button className="action-btn" onClick={expandAll}>
            Expand All
          </button>
          <button className="action-btn" onClick={collapseAll}>
            Collapse All
          </button>
          <button className="action-btn primary" onClick={exportLogs}>
            <Download size={14} />
            Export
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="logs-stats">
        <div className="stat-pill success">
          <span className="stat-dot" />
          {stats.success} success
        </div>
        <div className="stat-pill error">
          <span className="stat-dot" />
          {stats.error} error
        </div>
        <div className="stat-pill running">
          <span className="stat-dot" />
          {stats.running} running
        </div>
      </div>

      {/* Filters */}
      <div className="logs-filters">
        <div className="search-box">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Search logs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button 
              className="clear-search" 
              onClick={() => setSearchQuery('')}
            >
              <X size={14} />
            </button>
          )}
        </div>
        
        <div className="filter-group">
          <Filter size={14} />
          <select 
            value={statusFilter} 
            onChange={(e) => setStatusFilter(e.target.value as FilterStatus)}
          >
            <option value="all">All Status</option>
            <option value="success">Success</option>
            <option value="error">Error</option>
            <option value="running">Running</option>
          </select>
        </div>
      </div>

      {/* Logs List */}
      <div className="logs-list">
        {filteredCalls.length === 0 ? (
          <div className="empty-logs">
            {searchQuery || statusFilter !== 'all' ? (
              <>
                <Search size={48} />
                <p>No logs match your filters</p>
                <button 
                  className="clear-filters-btn"
                  onClick={() => { setSearchQuery(''); setStatusFilter('all'); }}
                >
                  Clear Filters
                </button>
              </>
            ) : (
              <>
                <Terminal size={48} />
                <p>No tool calls recorded</p>
              </>
            )}
          </div>
        ) : (
          filteredCalls.map((call, index) => (
            <div 
              key={`${call.id}-${index}-${call.toolName}`}
              className={`log-item ${call.status} ${expandedCalls.has(call.id) ? 'expanded' : ''}`}
              style={{ animationDelay: `${index * 30}ms` }}
            >
              <div 
                className="log-header"
                onClick={() => toggleExpand(call.id)}
              >
                <div className="log-header-left">
                  {expandedCalls.has(call.id) ? 
                    <ChevronDown size={16} className="expand-icon" /> : 
                    <ChevronRight size={16} className="expand-icon" />
                  }
                  
                  <span 
                    className="log-status-badge"
                    style={{ 
                      color: getStatusColor(call.status),
                      borderColor: getStatusColor(call.status)
                    }}
                  >
                    {getStatusIcon(call.status)} {call.status}
                  </span>
                  
                  <span className="log-tool">{call.toolName}</span>
                </div>
                
                <div className="log-header-right">
                  <span className="log-time">
                    <Clock size={12} />
                    {new Date(call.startTime).toLocaleTimeString()}
                  </span>
                  {call.durationMs && (
                    <span className="log-duration">
                      <Zap size={12} />
                      {formatDuration(call.durationMs)}
                    </span>
                  )}
                </div>
              </div>

              {expandedCalls.has(call.id) && (
                <div className="log-details">
                  <div className="log-section">
                    <div className="section-header">
                      <h4>Parameters</h4>
                      <button 
                        className="copy-btn"
                        onClick={() => copyToClipboard(JSON.stringify(call.parameters, null, 2), `params-${call.id}`)}
                      >
                        {copiedId === `params-${call.id}` ? <Check size={14} /> : <Copy size={14} />}
                      </button>
                    </div>
                    <SyntaxHighlightedJSON data={call.parameters} />
                  </div>

                  {call.result && (
                    <div className="log-section">
                      <div className="section-header">
                        <h4>Result</h4>
                        <button 
                          className="copy-btn"
                          onClick={() => copyToClipboard(JSON.stringify(call.result, null, 2), `result-${call.id}`)}
                        >
                          {copiedId === `result-${call.id}` ? <Check size={14} /> : <Copy size={14} />}
                        </button>
                      </div>
                      <SyntaxHighlightedJSON data={call.result} />
                    </div>
                  )}

                  {call.error && (
                    <div className="log-section error">
                      <div className="section-header">
                        <h4>Error</h4>
                        <button 
                          className="copy-btn"
                          onClick={() => copyToClipboard(call.error || '', `error-${call.id}`)}
                        >
                          {copiedId === `error-${call.id}` ? <Check size={14} /> : <Copy size={14} />}
                        </button>
                      </div>
                      <pre className="error-content">{call.error}</pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
