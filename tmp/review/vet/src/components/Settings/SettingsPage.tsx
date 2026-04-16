import React, { useState } from 'react';
import { SettingsSidebar } from './SettingsSidebar';
import { SettingsGeneral } from './SettingsGeneral';
import { SettingsIntegrations } from './SettingsIntegrations';
import { SettingsMCP } from './SettingsMCP';
import { SettingsAPIKey } from './SettingsAPIKey';
import './Settings.css';

export const SettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('general');

  return (
    <div className="settings-page">
      <SettingsSidebar activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === 'general' && <SettingsGeneral />}
      {activeTab === 'integrations' && <SettingsIntegrations />}
      {activeTab === 'mcp' && <SettingsMCP />}
      {activeTab === 'api-key' && <SettingsAPIKey />}
    </div>
  );
};
