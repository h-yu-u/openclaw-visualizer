import { useEffect, useCallback, useRef } from 'react';
import { useTaskStore } from '../store';

export interface NotificationOptions {
  title: string;
  body?: string;
  icon?: string;
  tag?: string;
  requireInteraction?: boolean;
  onClick?: () => void;
}

export function useNotifications() {
  const enabledRef = useRef(false);
  const sessionsRef = useRef<Set<string>>(new Set());
  
  const sessions = useTaskStore(state => state.sessions);
  const runningSessions = useTaskStore(state => state.getRunningSessions());
  
  // Request permission
  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) {
      console.log('Notifications not supported');
      return false;
    }
    
    if (Notification.permission === 'granted') {
      enabledRef.current = true;
      return true;
    }
    
    if (Notification.permission === 'denied') {
      console.log('Notification permission denied');
      return false;
    }
    
    const permission = await Notification.requestPermission();
    enabledRef.current = permission === 'granted';
    return enabledRef.current;
  }, []);
  
  // Send notification
  const notify = useCallback((options: NotificationOptions) => {
    if (!enabledRef.current || Notification.permission !== 'granted') {
      return;
    }
    
    const notification = new Notification(options.title, {
      body: options.body,
      icon: options.icon || '/favicon.ico',
      tag: options.tag,
      requireInteraction: options.requireInteraction || false,
    });
    
    notification.onclick = () => {
      window.focus();
      options.onClick?.();
      notification.close();
    };
  }, []);
  
  // Notify on new session
  useEffect(() => {
    if (!enabledRef.current) return;
    
    sessions.forEach(session => {
      if (!sessionsRef.current.has(session.id)) {
        sessionsRef.current.add(session.id);
        
        // Only notify for new sessions started recently (within last 10 seconds)
        const sessionStart = new Date(session.startTime).getTime();
        const now = Date.now();
        if (now - sessionStart < 10000) {
          notify({
            title: 'New Session Started',
            body: `Session: ${session.name || session.id.slice(0, 8)}`,
            tag: `session-${session.id}`,
          });
        }
      }
    });
  }, [sessions, notify]);
  
  // Notify when session completes
  useEffect(() => {
    if (!enabledRef.current) return;
    
    const completedSessions = sessions.filter(s => 
      (s.status === 'completed' || s.status === 'failed') && 
      s.endTime &&
      new Date(s.endTime).getTime() > Date.now() - 5000 // Completed within last 5 seconds
    );
    
    completedSessions.forEach(session => {
      const isError = session.status === 'failed';
      notify({
        title: isError ? 'Session Failed' : 'Session Completed',
        body: `${session.name || session.id.slice(0, 8)} - ${session.toolCalls.length} tool calls`,
        tag: `complete-${session.id}`,
        requireInteraction: isError,
      });
    });
  }, [sessions, notify]);
  
  return {
    requestPermission,
    notify,
    enabled: enabledRef.current,
    permission: Notification.permission,
  };
}