import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Icon } from '../Common/Icon';
import { useSession, type SessionMessage } from '../../context/SessionContext';
import { useToast } from '../../context/ToastContext';
import './Session.css';

interface CodeBlock {
  file: string;
  language: string;
  content: string;
  highlight?: string;
}

function formatTimestamp(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;

  const hours = date.getHours();
  const mins = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${mins}`;
}

export const SessionPage: React.FC = () => {
  const { id: sessionId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getSession, addMessage } = useSession();
  const { addToast } = useToast();
  const [inputValue, setInputValue] = useState('');
  const [isLoadingResponse, setIsLoadingResponse] = useState(false);

  // Get session from context
  const session = sessionId ? getSession(sessionId) : null;

  // Show error if session not found
  if (sessionId && !session) {
    return (
      <div className="session-page session-not-found">
        <div className="session-error-content">
          <Icon name="warning" size="lg" />
          <h2>Session not found</h2>
          <p>The session you're looking for doesn't exist or has been deleted.</p>
          <button
            className="session-error-button"
            onClick={() => navigate('/')}
          >
            Back to dashboard
          </button>
        </div>
      </div>
    );
  }

  const messages = session?.messages || [];

  const selectedCodeBlock: CodeBlock = {
    file: '/src/components/App.tsx',
    language: 'typescript',
    content: `import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { SettingsProvider } from './context/SettingsContext';
import { SessionProvider } from './context/SessionContext';
import { ToastProvider } from './context/ToastContext';
import { Root } from './components/Layout/Root';
import { Toast } from './components/Common/Toast';
import { DashboardPage } from './components/Dashboard/DashboardPage';

function App() {
  return (
    <ToastProvider>
      <SettingsProvider>
        <SessionProvider>
          <BrowserRouter>
            <Root>
              <Routes>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/session/:id" element={<SessionPage />} />
              </Routes>
            </Root>
          </BrowserRouter>
          <Toast />
        </SessionProvider>
      </SettingsProvider>
    </ToastProvider>
  );
}

export default App;`,
    highlight: '<SessionProvider>',
  };

  const handleSendMessage = async () => {
    if (!sessionId || !session) {
      addToast('Session not found', 'error');
      return;
    }

    if (!inputValue.trim()) {
      addToast('Please enter a message', 'warning');
      return;
    }

    // Add user message to session
    const userMessage: SessionMessage = {
      id: Math.random().toString(36).substring(2) + Date.now().toString(36),
      role: 'user',
      content: inputValue,
      timestamp: new Date(),
    };

    addMessage(sessionId, userMessage);
    setInputValue('');

    // Simulate assistant response
    setIsLoadingResponse(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));

      const assistantMessage: SessionMessage = {
        id: Math.random().toString(36).substring(2) + Date.now().toString(36),
        role: 'assistant',
        content: 'I\'ve analyzed your request and prepared the necessary changes. The code is ready for review.',
        timestamp: new Date(),
      };

      addMessage(sessionId, assistantMessage);
    } finally {
      setIsLoadingResponse(false);
    }
  };

  if (!session) {
    return (
      <div className="session-page session-loading">
        <div className="session-empty-content">
          <p>Loading session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="session-page">
      <div className="session-chat">
        <div className="session-header">
          <div>
            <h2 className="session-title">{session.name}</h2>
            <p className="session-id">{session.id}</p>
          </div>
          <button className="session-download" title="Download session">
            <Icon name="download" size="md" />
          </button>
        </div>

        <div className="session-messages">
          {messages.length === 0 ? (
            <div className="session-empty-state">
              <Icon name="chat" size="md" />
              <p>No messages yet. Start by asking Jules a question.</p>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`session-message session-message-${message.role}`}
              >
                <div className="session-message-content">
                  {message.content}
                </div>
                <div className="session-message-time">{formatTimestamp(message.timestamp)}</div>
              </div>
            ))
          )}
        </div>

        <div className="session-input-area">
          <div className="session-input-container">
            <input
              type="text"
              className="session-input"
              placeholder="Tell Jules what to fix..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              disabled={isLoadingResponse}
            />
            <button
              className="session-send-btn"
              onClick={handleSendMessage}
              title="Send message"
              disabled={isLoadingResponse || !inputValue.trim()}
            >
              {isLoadingResponse ? (
                <Icon name="hourglass_top" size="md" />
              ) : (
                <Icon name="keyboard_return" size="md" />
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="session-code">
        <div className="code-header">
          <div className="code-tabs">
            <span className="code-tab active">{selectedCodeBlock.file}</span>
          </div>
          <Icon name="close" size="sm" />
        </div>

        <div className="code-viewer">
          <pre>
            <code className={`language-${selectedCodeBlock.language}`}>
              {selectedCodeBlock.content}
            </code>
          </pre>
        </div>
      </div>
    </div>
  );
};
