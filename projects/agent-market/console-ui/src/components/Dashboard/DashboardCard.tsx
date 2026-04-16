import React from 'react';
import { Icon } from '../Common/Icon';
import './Dashboard.css';

export const DashboardCard: React.FC = () => {
  const samples = ['LRU cache', 'Load balancer', 'Crypto trading bot'];

  const handleSamplePrompt = (prompt: string) => {
    console.log('Selected sample prompt:', prompt);
    // TODO: Implement sample prompt selection
  };

  const handleGitHubConnect = () => {
    console.log('Connect to GitHub clicked');
    // TODO: Implement GitHub authentication
  };

  return (
    <div className="dashboard-card">
      <div className="dashboard-card-header">
        <div className="dashboard-card-title">
          <Icon name="github" size="md" />
          Import your repos
        </div>
        <button
          className="dashboard-github-btn"
          onClick={handleGitHubConnect}
        >
          Connect to GitHub
        </button>
      </div>

      <div className="dashboard-card-samples">
        <div className="sample-prompts-label">
          <Icon name="edit_note" size="md" />
          Try BountyNet out
        </div>
        <div className="dashboard-prompts">
          {samples.map((sample) => (
            <button
              key={sample}
              className="dashboard-prompt-btn"
              onClick={() => handleSamplePrompt(sample)}
            >
              {sample}
            </button>
          ))}
        </div>
      </div>

      <div className="integration-links">
        <a
          href="/settings/integrations"
          className="integration-link"
        >
          <svg
            className="integration-icon"
            viewBox="0 0 11 11"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M8.38254 0.0031077C6.94635 -0.0642076 5.73862 0.970001 5.5326 2.33263C5.52442 2.39586 5.51218 2.45706 5.50198 2.51826C5.18169 4.21541 3.69044 5.50053 1.89928 5.50053C1.26074 5.50053 0.660973 5.33735 0.138723 5.05176C0.0754816 5.01709 0 5.06196 0 5.13337V5.49849V11H5.49995V6.87541C5.49995 6.11657 6.11605 5.50053 6.87495 5.50053H8.24991C9.80646 5.50053 11.059 4.20931 10.9978 2.63861C10.9428 1.22498 9.79628 0.0704231 8.38254 0.0031077Z"
              fill="currentColor"
            />
          </svg>
          Configure Render
        </a>
        <a
          href="https://developers.circle.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="integration-link"
        >
          <Icon name="download" size="sm" />
          Download CLI
        </a>
        <a
          href="https://developers.circle.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="integration-link"
        >
          <Icon name="code" size="sm" />
          Try API
        </a>
      </div>
    </div>
  );
};
