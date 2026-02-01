import React from 'react';
import { useTaskStore } from '../../store';
import { OverviewTab } from '../tabs/OverviewTab';
import { TimelineTab } from '../tabs/TimelineTab';
import { LogsTab } from '../tabs/LogsTab';
import './MainContent.css';

export function MainContent() {
  const { activeTab, setActiveTab, getSelectedSession } = useTaskStore();
  const selectedSession = getSelectedSession();

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'timeline', label: 'Timeline' },
    { id: 'logs', label: 'Logs' },
    { id: 'graph', label: 'Graph' },
    { id: 'performance', label: 'Performance' },
  ];

  const renderTab = () => {
    if (!selectedSession) {
      return (
        <div className="empty-state">
          <p>Select a session to view details</p>
        </div>
      );
    }

    switch (activeTab) {
      case 'overview':
        return <OverviewTab session={selectedSession} />;
      case 'timeline':
        return <TimelineTab session={selectedSession} />;
      case 'logs':
        return <LogsTab session={selectedSession} />;
      default:
        return <OverviewTab session={selectedSession} />;
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