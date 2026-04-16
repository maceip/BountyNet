import React from 'react';
import { Icon } from '../Common/Icon';
import './Settings.css';

interface SettingsSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const SettingsSidebar: React.FC<SettingsSidebarProps> = ({
  activeTab,
  onTabChange,
}) => {
  const tabs = [
    { id: 'general', label: 'General', icon: 'settings' as const },
    { id: 'integrations', label: 'Integrations', icon: 'code' as const, badge: 'BETA' },
    { id: 'mcp', label: 'MCP', icon: 'settings' as const, badge: 'BETA' },
    { id: 'api-key', label: 'API Key', icon: 'settings' as const },
  ];

  return (
    <aside className="settings-sidebar">
      <nav className="settings-nav">
        {tabs.map((tab) => (
          <li key={tab.id} className="settings-nav-item">
            <button
              className={`settings-nav-link ${
                activeTab === tab.id ? 'active' : ''
              }`}
              onClick={() => onTabChange(tab.id)}
            >
              <Icon name={tab.icon} size="sm" />
              <span>{tab.label}</span>
              {tab.badge && (
                <span className="settings-nav-badge">{tab.badge}</span>
              )}
            </button>
          </li>
        ))}
      </nav>
    </aside>
  );
};
