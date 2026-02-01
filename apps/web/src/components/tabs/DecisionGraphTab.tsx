import React, { useMemo, useCallback } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
  Position,
  Handle,
  Panel
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { TaskSession, ToolCall } from '../../types';
import { GitBranch, Cpu, CheckCircle, XCircle, PlayCircle } from 'lucide-react';
import './DecisionGraphTab.css';

interface Props {
  session: TaskSession;
  toolCalls?: ToolCall[];
}

// Custom node components
function StartNode({ data }: { data: any }) {
  return (
    <div className="node start-node">
      <Handle type="source" position={Position.Bottom} />
      <PlayCircle size={20} />
      <span>{data.label}</span>
    </div>
  );
}

function ToolNode({ data }: { data: any }) {
  return (
    <div className={`node tool-node ${data.status}`}>
      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />
      <div className="node-header">
        <Cpu size={16} />
        <span className="node-title">{data.toolName}</span>
        <span className={`node-status ${data.status}`}>
          {data.status === 'success' && <CheckCircle size={14} />}
          {data.status === 'error' && <XCircle size={14} />}
        </span>
      </div>
      {data.duration && (
        <div className="node-meta">{data.duration}</div>
      )}
    </div>
  );
}

function DecisionNode({ data }: { data: any }) {
  return (
    <div className="node decision-node">
      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} id="yes" />
      <Handle type="source" position={Position.Right} id="no" />
      <GitBranch size={18} />
      <span>{data.label}</span>
    </div>
  );
}

function EndNode({ data }: { data: any }) {
  return (
    <div className={`node end-node ${data.status}`}>
      <Handle type="target" position={Position.Top} />
      {data.status === 'success' && <CheckCircle size={20} />}
      {data.status === 'error' && <XCircle size={20} />}
      <span>{data.label}</span>
    </div>
  );
}

const nodeTypes = {
  start: StartNode,
  tool: ToolNode,
  decision: DecisionNode,
  end: EndNode
};

export function DecisionGraphTab({ session, toolCalls = [] }: Props) {
  // Build nodes and edges from tool calls
  const { initialNodes, initialEdges } = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    
    const startX = 250;
    const startY = 50;
    const nodeSpacing = 120;
    
    // Start node
    nodes.push({
      id: 'start',
      type: 'start',
      position: { x: startX, y: startY },
      data: { label: 'Session Start' }
    });
    
    // Tool nodes
    const sortedCalls = [...toolCalls].sort((a, b) => 
      new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );
    
    sortedCalls.forEach((call, index) => {
      const nodeId = `tool-${call.id}`;
      const prevId = index === 0 ? 'start' : `tool-${sortedCalls[index - 1].id}`;
      
      nodes.push({
        id: nodeId,
        type: 'tool',
        position: { 
          x: startX + (index % 2 === 0 ? 0 : 200), 
          y: startY + (index + 1) * nodeSpacing 
        },
        data: {
          toolName: call.toolName,
          status: call.status,
          duration: call.durationMs ? `${call.durationMs}ms` : null
        }
      });
      
      edges.push({
        id: `edge-${prevId}-${nodeId}`,
        source: prevId,
        target: nodeId,
        animated: call.status === 'running',
        style: { 
          stroke: call.status === 'error' ? '#ef4444' : '#22d3ee',
          strokeWidth: 2
        }
      });
    });
    
    // End node
    const lastCall = sortedCalls[sortedCalls.length - 1];
    const endY = startY + (sortedCalls.length + 1) * nodeSpacing;
    
    nodes.push({
      id: 'end',
      type: 'end',
      position: { x: startX, y: endY },
      data: { 
        label: session.status === 'running' ? 'Running...' : 'Session End',
        status: session.status === 'failed' ? 'error' : 'success'
      }
    });
    
    if (lastCall) {
      edges.push({
        id: `edge-tool-${lastCall.id}-end`,
        source: `tool-${lastCall.id}`,
        target: 'end',
        animated: session.status === 'running',
        style: { 
          stroke: session.status === 'failed' ? '#ef4444' : '#10b981',
          strokeWidth: 2
        }
      });
    } else {
      edges.push({
        id: 'edge-start-end',
        source: 'start',
        target: 'end',
        style: { stroke: '#22d3ee', strokeWidth: 2 }
      });
    }
    
    return { initialNodes: nodes, initialEdges: edges };
  }, [toolCalls, session]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Update nodes when data changes
  React.useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  const onConnect = useCallback(
    (params: any) => setEdges((eds) => [...eds, params]),
    [setEdges]
  );

  const formatDuration = (ms?: number) => {
    if (!ms) return 'N/A';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <div className="decision-graph-tab">
      <div className="graph-header">
        <div className="graph-title">
          <GitBranch size={18} />
          <h3>Decision Flow</h3>
          <span className="graph-subtitle">
            {toolCalls.length} steps · {formatDuration(
              toolCalls.reduce((sum, c) => sum + (c.durationMs || 0), 0)
            )} total
          </span>
        </div>
      </div>

      <div className="graph-container">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.2}
          maxZoom={2}
        >
          <Background color="#334155" gap={16} />
          <Controls />
          <MiniMap 
            nodeStrokeWidth={3}
            zoomable
            pannable
            style={{
              backgroundColor: '#1e293b',
              border: '1px solid #334155'
            }}
          />
          
          <Panel position="top-right" className="graph-legend">
            <div className="legend-item">
              <span className="legend-dot success" />
              <span>Success</span>
            </div>
            <div className="legend-item">
              <span className="legend-dot error" />
              <span>Error</span>
            </div>
            <div className="legend-item">
              <span className="legend-dot running" />
              <span>Running</span>
            </div>
          </Panel>
        </ReactFlow>
      </div>
    </div>
  );
}
