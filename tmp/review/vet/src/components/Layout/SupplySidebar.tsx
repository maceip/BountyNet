import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Logo } from '../Common/Logo';
import { Icon } from '../Common/Icon';
import './Layout.css';

interface SupplySidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SupplySidebar: React.FC<SupplySidebarProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const [isLoggedIn] = useState(true); // TODO: Connect to actual auth state

  const supplyMenuItems = [
    { path: '/supply', icon: 'dashboard', label: 'Dashboard', exact: true },
    { path: '/supply/register', icon: 'edit_note', label: 'Register Agent' },
    { path: '/supply/agents', icon: 'checklist', label: 'My Agents' },
    { path: '/supply/evaluation', icon: 'memory', label: 'Evaluation' },
    { path: '/supply/payouts', icon: 'download', label: 'Payouts' },
  ];

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

      <div className="sidebar-sections">
        {isLoggedIn && (
          <div className="sidebar-section">
            <div className="sidebar-section-header">
              <span>Supply Tools</span>
            </div>
            <div className="sidebar-section-content">
              <nav className="sidebar-supply-menu">
                {supplyMenuItems.map((item) => (
                  <button
                    key={item.path}
                    className="sidebar-supply-item"
                    onClick={() => {
                      navigate(item.path);
                      onClose();
                    }}
                  >
                    <Icon name={item.icon as any} size="sm" />
                    <span>{item.label}</span>
                  </button>
                ))}
              </nav>
            </div>
          </div>
        )}
      </div>

      <div className="sidebar-footer">
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
