import { create } from 'zustand';
import { TaskSession, ToolCall, ConnectionStatus, TabType } from '../types';

interface TaskStore {
  // State
  sessions: TaskSession[];
  selectedSessionId: string | null;
  toolCalls: Record<string, ToolCall[]>;
  connectionStatus: ConnectionStatus;
  activeTab: TabType;
  gatewayStatus: { connected: boolean; state: string; url: string } | null;

  // Actions
  setSessions: (sessions: TaskSession[]) => void;
  addSession: (session: TaskSession) => void;
  updateSession: (id: string, updates: Partial<TaskSession>) => void;
  selectSession: (id: string | null) => void;
  setToolCalls: (sessionId: string, calls: ToolCall[]) => void;
  addToolCall: (sessionId: string, call: ToolCall) => void;
  updateToolCall: (sessionId: string, callId: string, updates: Partial<ToolCall>) => void;
  setConnectionStatus: (status: ConnectionStatus) => void;
  setActiveTab: (tab: TabType) => void;
  setGatewayStatus: (status: { connected: boolean; state: string; url: string } | null) => void;

  // Selectors
  getSelectedSession: () => TaskSession | undefined;
  getSelectedToolCalls: () => ToolCall[];
  getRunningSessions: () => TaskSession[];
}

export const useTaskStore = create<TaskStore>((set, get) => ({
  sessions: [],
  selectedSessionId: null,
  toolCalls: {},
  connectionStatus: 'disconnected',
  activeTab: 'overview',
  gatewayStatus: null,

  setSessions: (sessions) => set({ sessions }),

  addSession: (session) => set((state) => ({
    sessions: [session, ...state.sessions]
  })),

  updateSession: (id, updates) => set((state) => ({
    sessions: state.sessions.map(s => 
      s.id === id ? { ...s, ...updates } : s
    )
  })),

  selectSession: (id) => set({ selectedSessionId: id }),

  setToolCalls: (sessionId, calls) => set((state) => ({
    toolCalls: {
      ...state.toolCalls,
      [sessionId]: calls
    }
  })),

  addToolCall: (sessionId, call) => set((state) => ({
    toolCalls: {
      ...state.toolCalls,
      [sessionId]: [...(state.toolCalls[sessionId] || []), call]
    }
  })),

  updateToolCall: (sessionId, callId, updates) => set((state) => ({
    toolCalls: {
      ...state.toolCalls,
      [sessionId]: state.toolCalls[sessionId]?.map(c =>
        c.id === callId ? { ...c, ...updates } : c
      ) || []
    }
  })),

  setConnectionStatus: (status) => set({ connectionStatus: status }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  setGatewayStatus: (status) => set({ gatewayStatus: status }),

  getSelectedSession: () => {
    const { sessions, selectedSessionId } = get();
    return sessions.find(s => s.id === selectedSessionId);
  },

  getSelectedToolCalls: () => {
    const { toolCalls, selectedSessionId } = get();
    return selectedSessionId ? toolCalls[selectedSessionId] || [] : [];
  },

  getRunningSessions: () => {
    return get().sessions.filter(s => s.status === 'running');
  }
}));
