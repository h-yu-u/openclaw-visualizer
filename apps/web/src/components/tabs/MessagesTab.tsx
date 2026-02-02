import React, { useState, useMemo } from 'react';
import { Message } from '../../types';
import { MessageSquare, User, Bot, Cpu, ChevronDown, ChevronRight } from 'lucide-react';
import './MessagesTab.css';

interface Props {
  messages: Message[];
}

export function MessagesTab({ messages }: Props) {
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpandedMessages(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'user': return <User size={14} />;
      case 'assistant': return <Bot size={14} />;
      case 'system': return <Cpu size={14} />;
      default: return <MessageSquare size={14} />;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'user': return '#22d3ee';
      case 'assistant': return '#10b981';
      case 'system': return '#94a3b8';
      default: return '#64748b';
    }
  };

  const formatContent = (content: any): string => {
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
      return content.map(c => {
        if (typeof c === 'string') return c;
        if (c.type === 'text') return c.text;
        return JSON.stringify(c);
      }).join('\n');
    }
    return JSON.stringify(content, null, 2);
  };

  const sortedMessages = useMemo(() => {
    return [...messages].sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="messages-tab empty">
        <MessageSquare size={48} />
        <p>No messages in this session</p>
      </div>
    );
  }

  return (
    <div className="messages-tab">
      <div className="messages-header">
        <MessageSquare size={16} />
        <span>Conversation ({messages.length} messages)</span>
      </div>

      <div className="messages-list">
        {sortedMessages.map((message, index) => {
          const isExpanded = expandedMessages.has(message.id);
          const content = formatContent(message.content);
          const isLong = content.length > 200;

          return (
            <div
              key={`${message.id}-${index}`}
              className={`message-item ${message.role}`}
            >
              <div className="message-header">
                <div
                  className="message-role"
                  style={{ color: getRoleColor(message.role) }}
                >
                  {getRoleIcon(message.role)}
                  <span className="role-name">{message.role}</span>
                </div>

                <div className="message-meta">
                  {message.model && (
                    <span className="message-model">{message.model}</span>
                  )}
                  <span className="message-time">
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </span>

                  {(message.tokensIn || message.tokensOut) && (
                    <span className="message-tokens">
                      ↓{message.tokensIn || 0} ↑{message.tokensOut || 0}
                    </span>
                  )}
                </div>
              </div>

              <div className={`message-content ${isExpanded ? 'expanded' : ''}`}>
                <pre>{isLong && !isExpanded ? content.slice(0, 200) + '...' : content}</pre>
              </div>

              {isLong && (
                <button
                  className="expand-btn"
                  onClick={() => toggleExpand(message.id)}
                >
                  {isExpanded ? (
                    <><ChevronDown size={14} /> Show less</>
                  ) : (
                    <><ChevronRight size={14} /> Show more</>
                  )}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
