import React, { useState } from 'react';
import { Icon } from '../Common/Icon';
import { useSession } from '../../context/SessionContext';
import { useToast } from '../../context/ToastContext';
import './Dashboard.css';

interface ContextItem {
  id: string;
  label: string;
  type: 'file' | 'repo' | 'search';
}

export const TaskCard: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [context, setContext] = useState<ContextItem[]>([]);
  const [isSpeedMenuOpen, setIsSpeedMenuOpen] = useState(false);
  const [selectedSpeed] = useState('Start');
  const [isLoading, setIsLoading] = useState(false);
  const [isContextDialogOpen, setIsContextDialogOpen] = useState(false);
  const [contextInput, setContextInput] = useState('');
  const { createSession, addMessage } = useSession();
  const { addToast } = useToast();

  const handleAddContext = () => {
    setIsContextDialogOpen(true);
  };

  const handleAddContextItem = () => {
    if (!contextInput.trim()) {
      addToast('Please enter context information', 'warning');
      return;
    }

    const newContext: ContextItem = {
      id: Math.random().toString(36).substring(2),
      label: contextInput,
      type: 'file',
    };

    setContext([...context, newContext]);
    setContextInput('');
    setIsContextDialogOpen(false);
    addToast('Context added successfully', 'success');
  };

  const handleSend = async () => {
    if (!prompt.trim()) {
      addToast('Please enter a prompt', 'warning');
      return;
    }

    setIsLoading(true);
    try {
      // Create a new session if one doesn't exist
      const session = createSession(prompt.substring(0, 50) + '...');

      // Add user message to session
      addMessage(session.id, {
        id: Math.random().toString(36).substring(2),
        role: 'user',
        content: prompt,
        timestamp: new Date(),
      });

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Add assistant response
      addMessage(session.id, {
        id: Math.random().toString(36).substring(2),
        role: 'assistant',
        content: 'I\'ve received your task. Processing... This is a demo response.',
        timestamp: new Date(),
      });

      addToast('Task sent successfully!', 'success');
      setPrompt('');
      setContext([]);
    } catch (error) {
      addToast('Failed to send task', 'error');
      console.error('Error sending task:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleContextRemove = (id: string) => {
    setContext(context.filter((c) => c.id !== id));
    addToast('Context removed', 'info');
  };

  return (
    <div className="task-card-outer-wrapper">
      <div className="task-card-wrapper">
        <div className="task-card-inner">
          <div className="task-card-content">
            <div className="task-card-editor-container">
              <textarea
                className="task-card-editor"
                placeholder="Help me fix this error..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                aria-label="Task prompt input"
              />
            </div>
          </div>

          <div className="task-card-context-area">
            {context.length > 0 && (
              <div className="task-card-context">
                {context.map((item) => (
                  <div key={item.id} className="task-context-tag">
                    {item.label}
                    <button
                      className="task-context-tag-close"
                      onClick={() => handleContextRemove(item.id)}
                      aria-label={`Remove ${item.label} context`}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="task-card-actions">
              <button
                className="task-add-context-btn"
                onClick={handleAddContext}
                title="Add context"
              >
                <Icon name="add" size="sm" />
              </button>

              <div className="task-card-actions-right">
                <button
                  className={`task-speed-dropdown ${
                    isSpeedMenuOpen ? 'visible' : ''
                  }`}
                  onClick={() => setIsSpeedMenuOpen(!isSpeedMenuOpen)}
                >
                  <Icon name="settings" size="sm" />
                  <span>{selectedSpeed}</span>
                  <Icon name="expand_more" size="sm" />
                </button>

                <button
                  className="task-send-btn"
                  onClick={handleSend}
                  disabled={!prompt.trim() || isLoading}
                  title="Send task (Enter)"
                >
                  {isLoading ? (
                    <Icon name="hourglass_top" size="sm" />
                  ) : (
                    <Icon name="keyboard_return" size="sm" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Context Dialog */}
      {isContextDialogOpen && (
        <div className="task-context-dialog-overlay">
          <div className="task-context-dialog">
            <div className="task-context-dialog-header">
              <h3>Add Context</h3>
              <button
                className="task-context-dialog-close"
                onClick={() => {
                  setIsContextDialogOpen(false);
                  setContextInput('');
                }}
              >
                <Icon name="close" size="sm" />
              </button>
            </div>

            <div className="task-context-dialog-content">
              <p className="task-context-dialog-text">
                Add files, repositories, or search results as context for Jules to use.
              </p>

              <div className="task-context-input-group">
                <input
                  type="text"
                  className="task-context-input"
                  placeholder="e.g., src/App.tsx, repository name, or search query"
                  value={contextInput}
                  onChange={(e) => setContextInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleAddContextItem();
                    }
                  }}
                />
                <button
                  className="task-context-add-btn"
                  onClick={handleAddContextItem}
                >
                  Add
                </button>
              </div>

              <div className="task-context-dialog-suggestions">
                <p className="task-context-dialog-label">Quick add:</p>
                <div className="task-context-suggestions-grid">
                  {['Current file', 'Git diff', 'PR description'].map((suggestion) => (
                    <button
                      key={suggestion}
                      className="task-context-suggestion-btn"
                      onClick={() => {
                        setContext([
                          ...context,
                          {
                            id: Math.random().toString(36).substring(2),
                            label: suggestion,
                            type: 'file',
                          },
                        ]);
                        addToast(`${suggestion} added`, 'success');
                        setIsContextDialogOpen(false);
                      }}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="task-context-dialog-footer">
              <button
                className="task-context-dialog-cancel-btn"
                onClick={() => {
                  setIsContextDialogOpen(false);
                  setContextInput('');
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
