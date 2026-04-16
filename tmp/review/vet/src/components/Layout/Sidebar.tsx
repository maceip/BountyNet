import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Logo } from '../Common/Logo';
import { Icon } from '../Common/Icon';
import { useSession } from '../../context/SessionContext';
import './Layout.css';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Codebase {
  id: string;
  name: string;
  owner: string;
  stars?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { sessions } = useSession();
  const [isRecentSessionsExpanded, setIsRecentSessionsExpanded] = useState(true);
  const [isCodebasesExpanded, setIsCodebasesExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const isLoggedIn = true; // TODO: Connect to actual auth state

  const handleSessionClick = (sessionId: string) => {
    navigate(`/session/${sessionId}`);
  };

  // Mock codebases
  const allCodebases: Codebase[] = [
    { id: '1', name: 'assemblyxyz/core', owner: 'assemblyxyz', stars: 36 },
    { id: '2', name: 'co-browser/acme', owner: 'co-browser', stars: undefined },
    { id: '3', name: 'maceip/AEON', owner: 'maceip', stars: 52 },
  ];

  // Filter sessions and codebases based on search query
  const filteredSessions = useMemo(() =>
    sessions.filter((session) =>
      session.name.toLowerCase().includes(searchQuery.toLowerCase())
    ),
    [sessions, searchQuery]
  );

  const filteredCodebases = useMemo(() =>
    allCodebases.filter((codebase) =>
      codebase.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      codebase.owner.toLowerCase().includes(searchQuery.toLowerCase())
    ),
    [searchQuery]
  );

  const handleGitHubClick = () => {
    // TODO: Implement GitHub auth flow
    console.log('Connect to GitHub clicked');
  };

  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
      <div className="sidebar-rail-icon" />
      <div className="sidebar-header">
        <Logo onClick={onClose} />
        <button
          className="sidebar-close"
          onClick={onClose}
          title="Close sidebar"
        >
          <Icon name="close" size="sm" />
        </button>
      </div>

      <div className="sidebar-search">
        <input
          className="sidebar-search-input"
          type="text"
          placeholder="Search for repo or sessions"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <Icon
          name="search"
          size="sm"
          className="sidebar-search-icon"
        />
      </div>

      <div className="sidebar-sections">
        <div className="sidebar-section">
          <button
            className="sidebar-section-title"
            onClick={() =>
              setIsRecentSessionsExpanded(!isRecentSessionsExpanded)
            }
          >
            <span>Recent sessions</span>
            <Icon
              name="expand_more"
              size="sm"
              className={isRecentSessionsExpanded ? 'icon-expanded' : ''}
            />
          </button>
          {isRecentSessionsExpanded && (
            <div className="sidebar-section-content">
              {isLoggedIn && filteredSessions.length > 0 ? (
                <div className="sidebar-sessions-list">
                  {filteredSessions.map((session) => (
                    <button
                      key={session.id}
                      className={`sidebar-session-item sidebar-session-${session.status || 'completed'}`}
                      onClick={() => handleSessionClick(session.id)}
                    >
                      <div className="sidebar-session-icon">
                        {session.status === 'completed' && <span className="status-icon status-check">✓</span>}
                        {session.status === 'failed' && <span className="status-icon status-failed">●</span>}
                        {session.status === 'in_progress' && <span className="status-icon status-progress">●</span>}
                      </div>
                      <div className="sidebar-session-info">
                        <div className="sidebar-session-name" title={session.name}>{session.name}</div>
                        <div className="sidebar-session-time">{session.timestamp}</div>
                      </div>
                    </button>
                  ))}
                  {!searchQuery && (
                    <button className="sidebar-view-more">
                      <Icon name="add" size="sm" />
                      View more
                    </button>
                  )}
                </div>
              ) : (
                <div className="sidebar-empty-state">
                  <Icon name="checklist" size="sm" />
                  {searchQuery ? 'No sessions match' : 'Recent sessions'} <br /> {searchQuery ? 'your search' : 'will show up here'}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="sidebar-section">
          <button
            className="sidebar-section-title"
            onClick={() =>
              setIsCodebasesExpanded(!isCodebasesExpanded)
            }
          >
            <span>Codebases</span>
            <Icon
              name="expand_more"
              size="sm"
              className={isCodebasesExpanded ? 'icon-expanded' : ''}
            />
          </button>
          {isCodebasesExpanded && (
            <div className="sidebar-section-content">
              {filteredCodebases.length > 0 ? (
                <div className="sidebar-codebases-list">
                  {filteredCodebases.map((codebase) => (
                    <a
                      key={codebase.id}
                      href={`https://github.com/${codebase.owner}/${codebase.name.split('/')[1]}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="sidebar-codebase-item"
                    >
                      <Icon name="github" size="sm" />
                      <div className="sidebar-codebase-info">
                        <div className="sidebar-codebase-name">{codebase.name}</div>
                        {codebase.stars !== undefined && (
                          <div className="sidebar-codebase-stars">{codebase.stars}</div>
                        )}
                      </div>
                    </a>
                  ))}
                </div>
              ) : (
                <div className="sidebar-empty-state">
                  <Icon name="code" size="sm" />
                  No codebases match
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="sidebar-footer">
        <button
          className="sidebar-github-btn"
          onClick={handleGitHubClick}
        >
          <div className="sidebar-github-content">
            <Icon name="github" size="sm" />
            Connect to GitHub
          </div>
        </button>

        <div className="sidebar-session-limit">
          <div className="sidebar-session-limit-header">
            <span>Daily session limit</span>
            <strong>(0/15)</strong>
          </div>
          <div className="sidebar-session-bar">
            <div className="sidebar-session-progress" />
          </div>
        </div>

        <div className="sidebar-nav-links">
          <a
            href="https://jules.google/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="sidebar-nav-link"
          >
            Docs
          </a>
          <a
            href="https://discord.gg/googlelabs"
            target="_blank"
            rel="noopener noreferrer"
            className="sidebar-nav-link"
          >
            Discord
          </a>
          <a
            href="https://x.com/julesagent"
            target="_blank"
            rel="noopener noreferrer"
            className="sidebar-nav-link"
          >
            X
          </a>
        </div>
      </div>
    </aside>
  );
};
