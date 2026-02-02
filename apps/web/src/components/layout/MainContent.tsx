import React from 'react';
import { useTaskStore } from '../../store';
import { OverviewTab } from '../tabs/OverviewTab';
import { TimelineTab } from '../tabs/TimelineTab';
import { LogsTab } from '../tabs/LogsTab';
import { DecisionGraphTab } from '../tabs/DecisionGraphTab';
import { PerformanceTab } from '../tabs/PerformanceTab';
import { MessagesTab } from '../tabs/MessagesTab';
import './MainContent.css';

export function MainContent() {
  const { activeTab, setActiveTab, getSelectedSession, getSelectedToolCalls, getSelectedMessages } = useTaskStore();
  const selectedSession = getSelectedSession();
  const toolCalls = getSelectedToolCalls();
  const messages = getSelectedMessages();

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'messages', label: 'Messages' },
    { id: 'timeline', label: 'Timeline' },
    { id: 'logs', label: 'Logs' },
    { id: 'graph', label: 'Graph' },
    { id: 'performance', label: 'Performance' },
  ];

  const renderTab = () => {
    if (!selectedSession) {
      return (
        <div className="empty-state">
          <div className="empty-state-content">
            <div className="empty-icon">📊</div>
            <h3>Welcome to OpenClaw Visualizer</h3>
            <p>Select a session from the sidebar to view detailed analytics</p>
          </div>
        </div>
      );
    }

    switch (activeTab) {
      case 'overview':
        return <OverviewTab session={selectedSession} toolCalls={toolCalls} />;
      case 'messages':
        return <MessagesTab messages={messages} />;
      case 'timeline':
        return <TimelineTab session={selectedSession} toolCalls={toolCalls} />;
      case 'logs':
        return <LogsTab session={selectedSession} toolCalls={toolCalls} />;
      case 'graph':
        return <DecisionGraphTab session={selectedSession} toolCalls={toolCalls} />;
      case 'performance':
        return <PerformanceTab session={selectedSession} toolCalls={toolCalls} />;
      default:
        return <OverviewTab session={selectedSession} toolCalls={toolCalls} />;
    }
  };

  return (
    <main className="main-content">
      <div className="tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id as any)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="tab-content">
        {renderTab()}
      </div>
    </main>
  );
}
