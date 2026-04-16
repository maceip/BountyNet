import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../Common/Icon';
import { useAgent } from '../../context/AgentContext';
import './Supply.css';

export const SupplyDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { agents, evals } = useAgent();

  // Calculate aggregate stats
  const totalAgents = agents.length;
  const activeAgents = agents.filter((a) => a.status === 'active').length;
  const totalUsage = evals.reduce((sum, e) => sum + e.usageCount, 0);
  const avgRating =
    evals.length > 0
      ? (evals.reduce((sum, e) => sum + e.rating, 0) / evals.length).toFixed(1)
      : '0.0';

  return (
    <div className="supply-dashboard">
      <div className="supply-dashboard-header">
        <h1>Agent Dashboard</h1>
        <p className="supply-dashboard-subtitle">
          Manage your agents, track performance, and monitor earnings
        </p>
      </div>

      <div className="supply-stats-grid">
        <div className="supply-stat-card">
          <div className="supply-stat-header">
            <Icon name="checklist" size="md" />
            <span className="supply-stat-label">Total Agents</span>
          </div>
          <div className="supply-stat-value">{totalAgents}</div>
          <p className="supply-stat-detail">{activeAgents} active</p>
        </div>

        <div className="supply-stat-card">
          <div className="supply-stat-header">
            <Icon name="memory" size="md" />
            <span className="supply-stat-label">Total Usage</span>
          </div>
          <div className="supply-stat-value">{totalUsage.toLocaleString()}</div>
          <p className="supply-stat-detail">API calls this month</p>
        </div>

        <div className="supply-stat-card">
          <div className="supply-stat-header">
            <Icon name="check" size="md" />
            <span className="supply-stat-label">Avg Rating</span>
          </div>
          <div className="supply-stat-value">{avgRating}</div>
          <p className="supply-stat-detail">out of 5.0</p>
        </div>

        <div className="supply-stat-card">
          <div className="supply-stat-header">
            <Icon name="download" size="md" />
            <span className="supply-stat-label">Pending Payouts</span>
          </div>
          <div className="supply-stat-value">$0.00</div>
          <p className="supply-stat-detail">Next payout: Jan 15</p>
        </div>
      </div>

      <div className="supply-content-section">
        <div className="supply-section-header">
          <h2>Your Agents</h2>
          <button
            className="supply-action-btn supply-action-primary"
            onClick={() => navigate('/supply/register')}
          >
            <Icon name="add" size="sm" />
            Register Agent
          </button>
        </div>

        {agents.length === 0 ? (
          <div className="supply-empty-state">
            <Icon name="checklist" size="lg" />
            <h3>No agents yet</h3>
            <p>Register your first agent to get started earning</p>
            <button
              className="supply-action-btn supply-action-primary"
              onClick={() => navigate('/supply/register')}
            >
              Create Your First Agent
            </button>
          </div>
        ) : (
          <div className="supply-agents-list">
            {agents.map((agent) => {
              const stats = evals.find((e) => e.agentId === agent.id);
              return (
                <div key={agent.id} className="supply-agent-card">
                  <div className="supply-agent-header">
                    <div className="supply-agent-info">
                      <h3>{agent.name}</h3>
                      <p className="supply-agent-category">{agent.category}</p>
                    </div>
                    <span className={`supply-status-badge supply-status-${agent.status}`}>
                      {agent.status}
                    </span>
                  </div>

                  <p className="supply-agent-description">{agent.description}</p>

                  <div className="supply-agent-stats">
                    <div className="supply-agent-stat">
                      <span className="supply-stat-label">Model</span>
                      <span className="supply-stat-value-small">{agent.model}</span>
                    </div>
                    <div className="supply-agent-stat">
                      <span className="supply-stat-label">Usage</span>
                      <span className="supply-stat-value-small">{stats?.usageCount || 0}</span>
                    </div>
                    <div className="supply-agent-stat">
                      <span className="supply-stat-label">Rating</span>
                      <span className="supply-stat-value-small">{stats?.rating.toFixed(1) || '0.0'}</span>
                    </div>
                    <div className="supply-agent-stat">
                      <span className="supply-stat-label">Success Rate</span>
                      <span className="supply-stat-value-small">{stats?.successRate || 0}%</span>
                    </div>
                  </div>

                  <div className="supply-agent-actions">
                    <button className="supply-action-btn supply-action-secondary">
                      View Details
                    </button>
                    <button className="supply-action-btn supply-action-secondary">
                      Edit
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
