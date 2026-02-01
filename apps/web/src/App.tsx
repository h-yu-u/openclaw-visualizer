import React from 'react';
import { useWebSocket } from './hooks/useWebSocket';
import { Sidebar } from './components/layout/Sidebar';
import { MainContent } from './components/layout/MainContent';
import { Header } from './components/layout/Header';
import './App.css';

function App() {
  useWebSocket();

  return (
    <div className="app">
      <Header />
      <div className="main-container">
        <Sidebar />
        <MainContent />
      </div>
    </div>
  );
}

export default App;