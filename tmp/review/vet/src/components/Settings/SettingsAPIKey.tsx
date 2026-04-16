import React from 'react';
import { Icon } from '../Common/Icon';

export const SettingsAPIKey: React.FC = () => {
  const handleCreateKey = () => {
    // TODO: Implement API key creation
    console.log('Create API key clicked');
  };

  return (
    <div className="settings-content settings-api-key-content">
      <div className="settings-api-key-header">
        <h2 className="settings-api-key-title">API key</h2>
        <button className="settings-api-key-create-button" onClick={handleCreateKey}>
          Create key
        </button>
      </div>

      <p className="settings-api-key-description">
        For information about how to use the API, see the{' '}
        <a href="https://developers.google.com/jules/api" target="_blank" rel="noopener noreferrer" className="settings-action-link">
          API documentation
        </a>
        . Your API keys are listed below.
      </p>

      {/* Abuse Detection Banner */}
      <div className="settings-api-key-banner">
        <Icon name="warning" size="md" />
        <div className="settings-api-key-banner-content">
          <p className="settings-api-key-banner-title">Abuse auto-detection on</p>
          <p className="settings-api-key-banner-text">
            For your protection, we{' '}
            <a href="https://cloud.google.com/resource-manager/docs/organization-policy/restricting-service-accounts#disable-exposed-keys" target="_blank" rel="noopener noreferrer" className="settings-action-link">
              automatically disable
            </a>{' '}
            any API keys found to be publicly exposed to prevent abuse.
          </p>
        </div>
      </div>

      {/* API Keys Table */}
      <table className="settings-api-key-table">
        <thead>
          <tr>
            <th>API key</th>
            <th>Created at</th>
            <th>Last used</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colSpan={4} className="settings-api-key-empty">
              No keys to display
            </td>
          </tr>
        </tbody>
      </table>

      <p className="settings-api-key-footer">
        Remember to use your API keys securely. Don't share or embed them in
        public code. Learn more{' '}
        <a href="https://cloud.google.com/docs/authentication/api-keys-best-practices" target="_blank" rel="noopener noreferrer" className="settings-action-link">
          here
        </a>
      </p>
    </div>
  );
};
