import React from 'react';
import { Icon } from '../Common/Icon';

interface MCPServer {
  id: string;
  name: string;
  description: string;
  official: boolean;
  auth: string[];
  connected?: boolean;
  docsUrl: string;
}

const availableMCPs: MCPServer[] = [
  {
    id: 'linear',
    name: 'Linear',
    description: 'Issue tracking and project management for software teams',
    official: true,
    auth: ['API Key'],
    connected: false,
    docsUrl: 'https://linear.app/docs/mcp',
  },
  {
    id: 'neon',
    name: 'Neon',
    description: 'Serverless Postgres. Manage projects, branches, and run SQL queries.',
    official: true,
    auth: ['API Key'],
    connected: false,
    docsUrl: 'https://neon.tech/docs/ai/neon-mcp-server',
  },
  {
    id: 'supabase',
    name: 'Supabase',
    description: 'Serverless Postgres database. Manage projects, branches, run SQL, and deploy Edge Functions.',
    official: true,
    auth: ['API Key'],
    connected: false,
    docsUrl: 'https://supabase.com/docs/reference/api/introduction',
  },
  {
    id: 'tinybird',
    name: 'Tinybird',
    description: 'Real-time analytics platform. Query data sources, execute endpoints, and analyze data with ClickHouse.',
    official: true,
    auth: ['API Key'],
    connected: false,
    docsUrl: 'https://www.tinybird.co/docs/forward/analytics-agents/mcp',
  },
  {
    id: 'context7',
    name: 'Context7',
    description: 'Up-to-date library documentation for LLMs. Get version-specific docs and code examples for any library.',
    official: true,
    auth: ['API Key'],
    connected: false,
    docsUrl: 'https://github.com/upstash/context7',
  },
  {
    id: 'v0',
    name: 'v0',
    description: 'AI-powered UI design and code generation by Vercel. Generate React components and interfaces using natural language.',
    official: true,
    auth: ['API Key'],
    connected: false,
    docsUrl: 'https://v0.dev/docs/mcp',
  },
];

export const SettingsMCP: React.FC = () => {
  return (
    <div className="settings-content settings-mcp-content">
      <div className="settings-mcp-header">
        <h1 className="settings-mcp-title">MCP</h1>
        <p className="settings-mcp-description">
          Connect Jules to MCP servers and to let it read and edit external resources.
        </p>
      </div>

      {/* Connected MCPs */}
      <div className="settings-mcp-section">
        <h2 className="settings-mcp-section-title">Connected MCPs</h2>
        <div className="settings-mcp-item">
          <div className="settings-mcp-item-header">
            <div className="settings-mcp-status-dot"></div>
            <Icon name="code" size="sm" />
            <span className="settings-mcp-item-name">Stitch</span>
          </div>
          <div className="settings-mcp-item-actions">
            <a href="https://stitch.withgoogle.com/docs/mcp/setup" target="_blank" rel="noopener noreferrer" className="settings-mcp-docs-link">
              <Icon name="menu_book" size="sm" />
              <span>Docs</span>
            </a>
            <button className="settings-mcp-action-button settings-mcp-disconnect">
              <Icon name="code" size="sm" />
              <span>Disconnect</span>
            </button>
          </div>
        </div>
      </div>

      {/* Render MCP */}
      <div className="settings-mcp-section">
        <h2 className="settings-mcp-section-title">Render</h2>
        <div className="settings-mcp-render-box">
          <div className="settings-mcp-render-header">
            <Icon name="code" size="sm" />
            <span className="settings-mcp-item-name">Render MCP</span>
            <span className="settings-mcp-status-badge">Not Connected</span>
          </div>
          <p className="settings-mcp-render-description">
            Render MCP is managed through the Integrations settings. Connect your
            Render API key there to enable MCP features.
          </p>
          <button className="settings-mcp-action-button">
            <Icon name="settings" size="sm" />
            <span>Manage in Integrations</span>
          </button>
        </div>
      </div>

      {/* Available MCPs */}
      <div className="settings-mcp-section">
        <h2 className="settings-mcp-section-title">Available MCPs</h2>
        <div className="settings-mcp-grid">
          {availableMCPs.map((mcp) => (
            <div key={mcp.id} className="settings-mcp-card">
              <div className="settings-mcp-card-header">
                <div className="settings-mcp-card-title">
                  <Icon name="code" size="sm" />
                  <span>{mcp.name}</span>
                </div>
                {mcp.official && (
                  <span className="settings-mcp-official-badge">Official</span>
                )}
              </div>
              <p className="settings-mcp-card-description">{mcp.description}</p>
              <div className="settings-mcp-card-auth">
                Auth: <span className="settings-mcp-auth-badge">{mcp.auth.join(', ')}</span>
              </div>
              <div className="settings-mcp-card-actions">
                <a href={mcp.docsUrl} target="_blank" rel="noopener noreferrer" className="settings-mcp-docs-link">
                  <Icon name="menu_book" size="sm" />
                  <span>Docs</span>
                </a>
                <button className="settings-mcp-action-button settings-mcp-connect">
                  <Icon name="code" size="sm" />
                  <span>Connect</span>
                </button>
              </div>
            </div>
          ))}

          {/* Suggest New MCP */}
          <button className="settings-mcp-suggest-button">
            <div className="settings-mcp-suggest-content">
              <Icon name="add" size="md" />
              <span>Suggest a new MCP server</span>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};
