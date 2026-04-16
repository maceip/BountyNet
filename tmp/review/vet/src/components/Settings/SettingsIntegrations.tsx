import React, { useState } from 'react';
import { Icon } from '../Common/Icon';

export const SettingsIntegrations: React.FC = () => {
  const [apiKey, setApiKey] = useState('');

  return (
    <div className="settings-content">
      <div className="settings-integration-section">
        <div className="settings-integration-header">
          <Icon name="code" size="md" />
          <h2>Render</h2>
        </div>
        <p className="settings-description">
          Connect Render to allow Jules to automatically fix preview deployment
          build errors on PRs created by itself.
        </p>

        <div className="settings-integration-input-group">
          <input
            type="password"
            placeholder="Paste your Render API key"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="settings-integration-input"
          />
          <button
            className="settings-integration-send-button"
            disabled={!apiKey}
            title="Add API Key"
          >
            <Icon name="send" size="sm" />
          </button>
        </div>

        <p className="settings-small-text">
          Paste your API key from your{' '}
          <a href="https://dashboard.render.com/jules?utm_source=jules" target="_blank" rel="noopener noreferrer" className="settings-action-link">
            Render dashboard
          </a>
        </p>

        <div className="settings-integration-info-box">
          <strong>Quick Setup</strong>
          <ol>
            <li>
              Navigate to your Render dashboard &gt; Help menu on the top-right
              and click the Coding Agents button to provision an API key for
              Jules. Alternatively, click{' '}
              <a href="https://dashboard.render.com/jules?utm_source=jules" target="_blank" rel="noopener noreferrer" className="settings-action-link">
                here
              </a>
              .
            </li>
            <li>Create a Jules API key and copy the key displayed.</li>
            <li>Paste the token above and submit.</li>
          </ol>
        </div>

        <div className="settings-integration-info-box">
          <strong>Important</strong>
          <p>
            Ensure you have confirmed the recently updated{' '}
            <a href="https://github.com/settings/installations" target="_blank" rel="noopener noreferrer" className="settings-action-link">
              GitHub permissions
            </a>{' '}
            and have{' '}
            <a href="https://render.com/docs/service-previews?utm_source=jules#pull-request-previews-git-backed" target="_blank" rel="noopener noreferrer" className="settings-action-link">
              preview deployments
            </a>{' '}
            enabled so that Jules can connect to Render correctly.
          </p>
          <p>
            Render is a third-party service with a separate{' '}
            <a href="https://render.com/terms" target="_blank" rel="noopener noreferrer" className="settings-action-link">
              Terms of Service
            </a>{' '}
            and{' '}
            <a href="https://render.com/privacy" target="_blank" rel="noopener noreferrer" className="settings-action-link">
              Privacy Policy
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
};
