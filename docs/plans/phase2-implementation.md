# Phase 2 Implementation Plan

## Goals
1. Connect to real OpenClaw Gateway
2. Complete all 5 tabs with full functionality
3. Add charts and visualizations
4. Improve real-time updates

## Tasks

### 2.1 Gateway Connection (Real)
- [ ] Read OpenClaw token from config
- [ ] Connect to ws://127.0.0.1:18789
- [ ] Parse actual Gateway events
- [ ] Handle connection errors/reconnect

### 2.2 Overview Tab
- [ ] Add sparkline charts for token usage
- [ ] Real-time metrics updates
- [ ] Cost estimation display

### 2.3 Timeline Tab
- [ ] Gantt-style visualization
- [ ] Tool execution bars
- [ ] Zoom/pan controls

### 2.4 Logs Tab
- [ ] JSON syntax highlighting
- [ ] Search/filter functionality
- [ ] Copy buttons

### 2.5 Decision Graph Tab
- [ ] React Flow integration
- [ ] Node graph visualization
- [ ] Interactive pan/zoom

### 2.6 Performance Tab
- [ ] Token usage area chart
- [ ] Latency bar chart
- [ ] Cost breakdown pie chart

## Git Commits
1. `feat: connect to real OpenClaw Gateway`
2. `feat: Overview tab with charts`
3. `feat: Timeline Gantt view`
4. `feat: Logs with syntax highlighting`
5. `feat: Decision Graph with React Flow`
6. `feat: Performance charts with Recharts`