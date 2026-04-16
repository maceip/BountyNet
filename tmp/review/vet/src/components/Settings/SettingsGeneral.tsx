import React from 'react';
import { Icon } from '../Common/Icon';
import { useSettings } from '../../context/SettingsContext';
import './Settings.css';

export const SettingsGeneral: React.FC = () => {
  const { settings, updateSettings } = useSettings();

  return (
    <div className="settings-content">
      {/* Plan Section */}
      <div className="settings-section">
        <div className="settings-section-header">
          <Icon name="settings" size="md" />
          <h2>Plan: Jules in Ultra</h2>
        </div>
        <div className="settings-section-body">
          <p className="settings-description">
            You've unlocked Jules' full potential—every tentacle, every tool,
            fully unleashed. This is our most powerful tier, built for serious
            coding scale and agent-first workflows.
            <a href="#" className="settings-link">
              Learn more about plans.
            </a>
          </p>
          <a href="#" className="settings-action-link">
            <span>Manage subscription</span>
            <Icon name="open_in_new" size="sm" />
          </a>
        </div>
      </div>

      {/* Model Settings */}
      <div className="settings-section">
        <div className="settings-section-header">
          <Icon name="chat" size="md" />
          <h2>Model settings</h2>
        </div>
        <div className="settings-section-body">
          <p className="settings-description">
            Set your preferences for which model Jules should use.
          </p>
          <div className="settings-control-group">
            <select
              className="settings-select"
              value={settings.selectedModel}
              onChange={(e) => updateSettings({ selectedModel: e.target.value })}
            >
              <option>Gemini 3.1 Pro</option>
              <option>Gemini 3 Flash</option>
              <option>Claude 3 Opus</option>
            </select>
          </div>
        </div>
      </div>

      {/* Notification Settings */}
      <div className="settings-section">
        <div className="settings-section-header">
          <Icon name="notifications" size="md" />
          <h2>Notification settings</h2>
        </div>
        <div className="settings-section-body">
          <p className="settings-description">
            Enable notifications to receive updates about your Jules
            conversations, including when a plan is created or when code is
            ready for review.
          </p>
          <div className="settings-checkbox-item">
            <label className="settings-checkbox-label">
              <input
                type="checkbox"
                className="settings-checkbox"
                checked={settings.notificationsEnabled}
                onChange={(e) => updateSettings({ notificationsEnabled: e.target.checked })}
              />
              <span>Enable notifications</span>
            </label>
          </div>
        </div>
      </div>

      {/* Email Settings */}
      <div className="settings-section">
        <div className="settings-section-header">
          <Icon name="mail" size="md" />
          <h2>Email settings</h2>
        </div>
        <div className="settings-section-body">
          <p className="settings-description">
            Set your preferences for when you want to be contacted by the
            Jules team about product updates and research opportunities.
          </p>
          <div className="settings-checkbox-item">
            <label className="settings-checkbox-label">
              <input
                type="checkbox"
                className="settings-checkbox"
                checked={settings.researchOptIn}
                onChange={(e) => updateSettings({ researchOptIn: e.target.checked })}
              />
              <span>
                I'd like to receive invitations to participate in research
                studies to help improve Google AI.
              </span>
            </label>
          </div>
          <div className="settings-checkbox-item">
            <label className="settings-checkbox-label">
              <input
                type="checkbox"
                className="settings-checkbox"
                checked={settings.marketingOptIn}
                onChange={(e) => updateSettings({ marketingOptIn: e.target.checked })}
              />
              <span>
                I'd like to receive emails for model updates, offers, useful
                tips and news about Google AI.
              </span>
            </label>
          </div>
          <div className="settings-checkbox-item">
            <label className="settings-checkbox-label">
              <input
                type="checkbox"
                className="settings-checkbox"
                checked={settings.proactivityOptIn}
                onChange={(e) => updateSettings({ proactivityOptIn: e.target.checked })}
              />
              <span>
                I'd like to receive emails about proactive suggestions from
                Jules.
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* Data Settings */}
      <div className="settings-section">
        <div className="settings-section-header">
          <Icon name="memory" size="md" />
          <h2>Data settings</h2>
        </div>
        <div className="settings-section-body">
          <div className="settings-checkbox-item">
            <label className="settings-checkbox-label">
              <input
                type="checkbox"
                className="settings-checkbox"
                checked={settings.dataOptIn}
                onChange={(e) => updateSettings({ dataOptIn: e.target.checked })}
              />
              <span>
                Allow AI model training on content from sessions linked to
                public repositories.
              </span>
            </label>
          </div>
          <p className="settings-small-text">
            Google does not train its generative AI models on content Jules
            receives from your sessions linked to private repositories or
            sessions not linked to any repositories.
            <a href="#" className="settings-link">
              Learn more
            </a>
            .
          </p>
        </div>
      </div>

      {/* Export Settings */}
      <div className="settings-section">
        <div className="settings-section-header">
          <Icon name="download" size="md" />
          <h2>Export settings</h2>
        </div>
        <div className="settings-section-body">
          <p className="settings-description">
            Set your preferences for how Jules should export the task when it
            is completed.
          </p>
          <div className="settings-checkbox-item">
            <label className="settings-checkbox-label">
              <input
                type="checkbox"
                className="settings-checkbox"
                checked={settings.exportAsPr}
                onChange={(e) => updateSettings({ exportAsPr: e.target.checked })}
              />
              <span>Export as pull request</span>
            </label>
          </div>
        </div>
      </div>

      {/* Git Commit Authoring */}
      <div className="settings-section">
        <div className="settings-section-header">
          <Icon name="github" size="md" />
          <h2>Git commit authoring</h2>
        </div>
        <div className="settings-section-body">
          <p className="settings-small-text">
            Choose how git commits are authored when Jules makes changes.
            Co-authored commits are recommended for best contribution
            tracking.
          </p>
          <div className="settings-control-group">
            <select
              className="settings-select"
              value={settings.commitAuthoring}
              onChange={(e) => updateSettings({ commitAuthoring: e.target.value })}
            >
              <option>User only</option>
              <option>Co-authored</option>
              <option>Jules only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Pull Request Settings */}
      <div className="settings-section">
        <div className="settings-section-header">
          <Icon name="github" size="md" />
          <h2>Pull Request settings</h2>
        </div>
        <div className="settings-section-body">
          <p className="settings-description">
            Set your preferences for how Jules creates and handles pull
            requests.
          </p>
          <div className="settings-checkbox-item">
            <label className="settings-checkbox-label">
              <input
                type="checkbox"
                className="settings-checkbox"
                checked={settings.prReactiveMode}
                onChange={(e) => updateSettings({ prReactiveMode: e.target.checked })}
              />
              <span>Only respond to comments that mention @jules</span>
            </label>
          </div>
          <div className="settings-checkbox-item">
            <label className="settings-checkbox-label">
              <input
                type="checkbox"
                className="settings-checkbox"
                checked={settings.prOpenAsDraft}
                onChange={(e) => updateSettings({ prOpenAsDraft: e.target.checked })}
              />
              <span>Open pull requests as drafts by default</span>
            </label>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <button className="settings-save-button">Save and close</button>
    </div>
  );
};
