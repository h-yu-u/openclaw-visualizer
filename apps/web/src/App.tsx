import React, { useEffect } from 'react';
import { useWebSocket } from './hooks/useWebSocket';
import { useNotifications } from './hooks/useNotifications';
import { Sidebar } from './components/layout/Sidebar';
import { MainContent } from './components/layout/MainContent';
import { Header } from './components/layout/Header';
import './App.css';

function App() {
  const ws = useWebSocket();
  const notifications = useNotifications();

  // Request notification permission on first load
  useEffect(() => {
    // Auto-request permission after 3 seconds (give user time to see the app first)
    const timer = setTimeout(() => {
      if (notifications.permission === 'default') {
        notifications.requestPermission();
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, [notifications]);

  const handleToggleNotifications = () => {
    if (notifications.enabled) {
      // Can't actually disable without permission API, but we can track preference
      // For now just re-request to toggle
      notifications.requestPermission();
    } else {
      notifications.requestPermission();
    }
  };

  return (
    <div className="app">
      <Header 
        connectionStatus={ws.status}
        reconnectAttempts={ws.reconnectAttempts}
        onReconnect={ws.reconnect}
        notificationsEnabled={notifications.enabled}
        onToggleNotifications={handleToggleNotifications}
      />
      <div className="main-container">
        <Sidebar />
        <MainContent />
      </div>
    </div>
  );
}

export default App;