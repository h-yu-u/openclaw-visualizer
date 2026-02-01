import React, { useMemo } from 'react';
import { TaskSession, ToolCall } from '../../types';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  Position,
  Handle
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './DecisionGraphTab.css';

interface Props {
  session: TaskSession;
  toolCalls?: ToolCall[];
}

interface FlowNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: {
    label: string;
    toolName: string;
    status: string;
    duration?: number;
  };
  style?: React.CSSProperties;
}

const nodeTypes = {
  tool: ToolNode,
  start: StartNode,
  end: EndNode
};

function StartNode({ data }: any) {
  return (
    <div className="flow-node start-node">
      <Handle type="source" position={Position.Bottom} />
      <div className="node-content">
        <div className="node-icon">🚀</div>
        <div className="node-label">{data.label}</div>
      </div>
    </div>
  );
}

function EndNode({ data }: any) {
  return (
    <div className="flow-node end-node">
      <Handle type="target" position={Position.Top} />
      <div className="node-content">
        <div className="node-icon">🏁</div>
        <div className="node-label">{data.label}</div>
      </div>
    </div>
  );
}

function ToolNode({ data }: any) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return '#10b981';
      case 'error': return '#ef4444';
      case 'running': return '#22d3ee';
      default: return '#94a3b8';
    }
  };

  const getToolIcon = (toolName: string) => {
    const icons: Record<string, string> = {
      exec: '⚡',
      write: '✏️',
      read: '📖',
      edit: '🔧',
      browser: '🌐',
      web_search: '🔍',
      image: '🖼️',
      tts: '🔊',
      message: '💬',
      nodes: '📡',
      process: '⚙️',
      canvas: '🎨'
    };
    return icons[toolName] || '🔧';
  };

  return (
    <div 
      className="flow-node tool-node"
      style={{ borderColor: getStatusColor(data.status) }}
    >
      <Handle type="target" position={Position.Top} />
      <div className="node-content">
        <div className="node-icon">{getToolIcon(data.toolName)}</div>
        <div className="node-info">
          <div className="node-label">{data.toolName}</div>
          {data.duration && (
            <div className="node-duration">{data.duration}ms</div>
          )}
        </div>
        <div 
          className="node-status" 
          style={{ backgroundColor: getStatusColor(data.status) }}
        />
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

export function DecisionGraphTab({ session, toolCalls = [] }: Props) {
  const { nodes, edges } = useMemo(() => {
    const flowNodes: FlowNode[] = [];
    const flowEdges: Edge[] = [];

    // Add start node
    flowNodes.push({
      id: 'start',
      type: 'start',
      position: { x: 250, y: 0 },
      data: { 
        label: 'Session Start', 
        toolName: 'start',
        status: 'success'
      }
    });

    // Add tool nodes
    const sortedCalls = [...toolCalls].sort((a, b) =>
      new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );

    const rowWidth = 200;
    const rowHeight = 120;
    const itemsPerRow = 3;

    sortedCalls.forEach((call, index) => {
      const row = Math.floor(index / itemsPerRow);
      const col = index % itemsPerRow;
      const x = 100 + col * rowWidth;
      const y = 100 + row * rowHeight;
      const nodeId = `${call.id}-${index}`;

      flowNodes.push({
        id: nodeId,
        type: 'tool',
        position: { x, y },
        data: {
          label: call.toolName,
          toolName: call.toolName,
          status: call.status,
          duration: call.durationMs
        }
      });

      // Connect to previous node
      if (index === 0) {
        flowEdges.push({
          id: `e-start-${nodeId}`,
          source: 'start',
          target: nodeId,
          animated: call.status === 'running',
          style: { stroke: '#64748b' }
        });
      } else {
        const prevNodeId = `${sortedCalls[index - 1].id}-${index - 1}`;
        flowEdges.push({
          id: `e-${prevNodeId}-${nodeId}`,
          source: prevNodeId,
          target: nodeId,
          animated: call.status === 'running',
          style: { stroke: '#64748b' }
        });
      }
    });

    // Add end node
    const lastRow = Math.floor((sortedCalls.length - 1) / itemsPerRow);
    flowNodes.push({
      id: 'end',
      type: 'end',
      position: { 
        x: 250, 
        y: 150 + (lastRow + 1) * rowHeight 
      },
      data: { 
        label: session.status === 'completed' ? 'Completed' : 
               session.status === 'failed' ? 'Failed' : 'In Progress',
        toolName: 'end',
        status: session.status
      }
    });

    // Connect last tool to end
    if (sortedCalls.length > 0) {
      const lastNodeId = `${sortedCalls[sortedCalls.length - 1].id}-${sortedCalls.length - 1}`;
      flowEdges.push({
        id: `e-${lastNodeId}-end`,
        source: lastNodeId,
        target: 'end',
        animated: session.status === 'running',
        style: { 
          stroke: session.status === 'completed' ? '#10b981' : 
                  session.status === 'failed' ? '#ef4444' : '#64748b'
        }
      });
    }

    return { nodes: flowNodes, edges: flowEdges };
  }, [toolCalls, session.status]);

  if (toolCalls.length === 0) {
    return (
      <div className="graph-tab">
        <div className="empty-state">
          <div className="empty-icon">🕸️</div>
          <p>No tool calls to visualize</p>
        </div>
      </div>
    );
  }

  return (
    <div className="graph-tab">
      <div className="graph-header">
        <h3>Execution Flow</h3>
        <div className="graph-legend">
          <span className="legend-item">
            <span className="legend-dot" style={{ background: '#10b981' }} />
            Success
          </span>
          <span className="legend-item">
            <span className="legend-dot" style={{ background: '#ef4444' }} />
            Error
          </span>
          <span className="legend-item">
            <span className="legend-dot" style={{ background: '#22d3ee' }} />
            Running
          </span>
        </div>
      </div>
      
      <div className="graph-container">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          attributionPosition="bottom-left"
        >
          <Background color="#334155" gap={16} />
          <Controls />
          <MiniMap 
            nodeStrokeWidth={3}
            zoomable
            pannable
          />
        </ReactFlow>
      </div>
    </div>
  );
}
