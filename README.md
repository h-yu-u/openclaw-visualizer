# OpenClaw Visualizer

A comprehensive dashboard for visualizing OpenClaw task execution in real-time.

## Features

- 🔴 **Real-time Monitoring** - Connect to OpenClaw Gateway via WebSocket
- 📊 **Task Visualization** - Gantt timelines, decision graphs, performance charts
- 💰 **Cost Tracking** - Token usage and cost estimation
- 📜 **Structured Logs** - Searchable tool call history with JSON syntax highlighting
- 📤 **Export** - JSON/CSV export for analysis

## Architecture

```
┌─────────────┐     WebSocket      ┌──────────────┐     WebSocket      ┌─────────────┐
│   Browser   │ ◄────────────────► │ Bridge Server│ ◄────────────────► │   OpenClaw  │
│  (React)    │      (Port 3001)   │  (Node.js)   │   (Port 18789)     │   Gateway   │
└─────────────┘                    └──────────────┘                    └─────────────┘
                                          │
                                          ▼
                                    ┌──────────────┐
                                    │   SQLite     │
                                    │  (History)   │
                                    └──────────────┘
```

## Quick Start

### Prerequisites
- Node.js 18+
- OpenClaw Gateway running on port 18789

### Installation

```bash
# Clone repository
git clone https://github.com/h-yu-u/openclaw-visualizer.git
cd openclaw-visualizer

# Install dependencies
npm install

# Configure environment
cp apps/bridge/.env.example apps/bridge/.env
# Edit apps/bridge/.env with your OpenClaw token

# Start development
npm run dev
```

### Configuration

Create `apps/bridge/.env`:

```env
OPENCLAW_TOKEN=your_gateway_token_here
BRIDGE_PORT=3001
DATABASE_PATH=./data/visualizer.db
```

## Development Phases

- [x] Phase 1: Foundation - Bridge server + React shell
- [ ] Phase 2: Core Visualization - Task list + Overview tab
- [ ] Phase 3: Detailed Views - All 5 tabs
- [ ] Phase 4: Polish & Persistence - History, export, settings
- [ ] Phase 5: Deployment - GitHub Pages + Docker

## License

MIT
