import React, { useMemo, useState } from 'react';
import { TaskSession, ToolCall } from '../../types';
import { Clock, ZoomIn, ZoomOut, MoveHorizontal } from 'lucide-react';
import './TimelineTab.css';

interface Props {
  session: TaskSession;
  toolCalls?: ToolCall[];
}

interface GanttItem {
  id: string;
  toolName: string;
  startOffset: number;
  duration: number;
  status: string;
  row: number;
}

const TOOL_COLORS: Record<string, string> = {
  exec: '#22d3ee',
  write: '#10b981',
  read: '#3b82f6',
  edit: '#f59e0b',
  browser: '#a855f7',
  web_search: '#ec4899',
  image: '#ef4444',
  tts: '#14b8a6',
  message: '#f97316',
  nodes: '#8b5cf6',
  process: '#06b6d4',
  canvas: '#84cc16'
};

export function TimelineTab({ session, toolCalls = [] }: Props) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState(0);

  const sessionStart = new Date(session.startTime).getTime();
  const sessionEnd = session.endTime 
    ? new Date(session.endTime).getTime()
    : Date.now();
  const totalDuration = sessionEnd - sessionStart;

  // Build Gantt items
  const ganttItems = useMemo(() => {
    const items: GanttItem[] = [];
    const rowOccupancy: Array<{ end: number } | null> = [];

    // Sort by start time
    const sortedCalls = [...toolCalls].sort((a, b) => 
      new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );

    sortedCalls.forEach(call => {
      const callStart = new Date(call.startTime).getTime();
      const startOffset = callStart - sessionStart;
      const duration = call.durationMs || (call.endTime 
        ? new Date(call.endTime).getTime() - callStart 
        : Date.now() - callStart);

      // Find a row where this item fits (no overlap)
      let row = 0;
      for (; row < rowOccupancy.length; row++) {
        const occupant = rowOccupancy[row];
        if (!occupant || occupant.end <= startOffset) {
          break;
        }
      }

      rowOccupancy[row] = { end: startOffset + duration };

      items.push({
        id: call.id,
        toolName: call.toolName,
        startOffset,
        duration,
        status: call.status,
        row
      });
    });

    return items;
  }, [toolCalls, sessionStart]);

  const maxRows = useMemo(() => {
    return ganttItems.reduce((max, item) => Math.max(max, item.row), 0) + 1;
  }, [ganttItems]);

  // Time markers
  const timeMarkers = useMemo(() => {
    const markers = [];
    const steps = 10;
    for (let i = 0; i <= steps; i++) {
      const time = (totalDuration / steps) * i;
      markers.push({
        offset: time,
        label: formatDuration(time)
      });
    }
    return markers;
  }, [totalDuration]);

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return '#10b981';
      case 'error': return '#ef4444';
      case 'running': return '#22d3ee';
      default: return '#94a3b8';
    }
  };

  const getToolColor = (toolName: string) => {
    return TOOL_COLORS[toolName] || '#64748b';
  };

  const timelineWidth = Math.max(800, totalDuration * 0.1 * zoom);
  const pixelsPerMs = timelineWidth / totalDuration;

  return (
    <div className="timeline-tab">
      <div className="timeline-header">
        <div className="timeline-title">
          <Clock size={18} />
          <h3>Tool Execution Gantt</h3>
          <span className="timeline-subtitle">
            {toolCalls.length} calls · {formatDuration(totalDuration)} total
          </span>
        </div>
        
        <div className="timeline-controls">
          <button 
            className="control-btn" 
            onClick={() => setZoom(z => Math.max(0.5, z - 0.25))}
            title="Zoom out"
          >
            <ZoomOut size={16} />
          </button>
          <span className="zoom-level">{Math.round(zoom * 100)}%</span>
          <button 
            className="control-btn" 
            onClick={() => setZoom(z => Math.min(3, z + 0.25))}
            title="Zoom in"
          >
            <ZoomIn size={16} />
          </button>
        </div>
      </div>

      {toolCalls.length === 0 ? (
        <div className="empty-state">
          <MoveHorizontal size={48} />
          <p>No tool calls recorded for this session</p>
        </div>
      ) : (
        <div className="gantt-container">
          {/* Legend */}
          <div className="gantt-legend">
            <span className="legend-title">Tools:</span>
            {Array.from(new Set(toolCalls.map(c => c.toolName))).map(tool => (
              <div key={tool} className="legend-item">
                <span 
                  className="legend-color" 
                  style={{ backgroundColor: getToolColor(tool) }}
                />
                <span className="legend-label">{tool}</span>
              </div>
            ))}
          </div>

          {/* Timeline */}
          <div className="gantt-timeline-wrapper">
            <div 
              className="gantt-timeline"
              style={{ 
                width: timelineWidth,
                height: Math.max(300, maxRows * 50 + 60)
              }}
            >
              {/* Time axis */}
              <div className="time-axis">
                {timeMarkers.map((marker, i) => (
                  <div 
                    key={i} 
                    className="time-marker"
                    style={{ left: marker.offset * pixelsPerMs }}
                  >
                    <div className="time-line" />
                    <span className="time-label">{marker.label}</span>
                  </div>
                ))}
              </div>

              {/* Grid lines */}
              <div className="grid-lines">
                {timeMarkers.map((marker, i) => (
                  <div 
                    key={i}
                    className="grid-line"
                    style={{ left: marker.offset * pixelsPerMs }}
                  />
                ))}
              </div>

              {/* Bars */}
              <div className="gantt-bars">
                {ganttItems.map(item => {
                  const left = item.startOffset * pixelsPerMs;
                  const width = Math.max(4, item.duration * pixelsPerMs);
                  const top = item.row * 50 + 10;

                  return (
                    <div
                      key={item.id}
                      className="gantt-bar"
                      style={{
                        left,
                        width,
                        top,
                        backgroundColor: getToolColor(item.toolName),
                        borderColor: getStatusColor(item.status),
                      }}
                      title={`${item.toolName}: ${formatDuration(item.duration)}`}
                    >
                      <span className="bar-label">
                        {width > 60 ? item.toolName : ''}
                      </span>
                      <div className="bar-tooltip">
                        <strong>{item.toolName}</strong>
                        <br />
                        Duration: {formatDuration(item.duration)}
                        <br />
                        Status: {item.status}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
