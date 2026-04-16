import React from 'react';
import { Icon } from '../Common/Icon';
import { useAgent } from '../../context/AgentContext';
import './Supply.css';

export const EvalAgent: React.FC = () => {
  const { agents, evals } = useAgent();

  return (
    <div className="supply-dashboard">
      <div className="supply-dashboard-header">
        <h1>Agent Evaluation</h1>
        <p className="supply-dashboard-subtitle">
          Monitor your agents' performance, user ratings, and success metrics
        </p>
      </div>

      {agents.length === 0 ? (
        <div className="supply-empty-state">
          <Icon name="memory" size="lg" />
          <h3>No agents to evaluate</h3>
          <p>Register an agent first to see evaluation metrics</p>
        </div>
      ) : (
        <div className="supply-content-section">
          <div className="supply-section-header">
            <h2>Agent Performance</h2>
          </div>

          <div className="supply-agents-list">
            {agents.map((agent) => {
              const stats = evals.find((e) => e.agentId === agent.id);
              if (!stats) return null;

              return (
                <div key={agent.id} className="supply-eval-card">
                  <h3>{agent.name}</h3>
                  <p className="supply-eval-description">{agent.description}</p>

                  <div className="supply-eval-metrics">
                    <div className="supply-eval-metric">
                      <div className="supply-eval-metric-label">Overall Rating</div>
                      <div className="supply-eval-metric-value">
                        {stats.rating.toFixed(1)}
                        <span className="supply-eval-metric-unit">/ 5.0</span>
                      </div>
                    </div>

                    <div className="supply-eval-metric">
                      <div className="supply-eval-metric-label">Success Rate</div>
                      <div className="supply-eval-metric-value">
                        {stats.successRate}
                        <span className="supply-eval-metric-unit">%</span>
                      </div>
                    </div>

                    <div className="supply-eval-metric">
                      <div className="supply-eval-metric-label">Usage Count</div>
                      <div className="supply-eval-metric-value">
                        {stats.usageCount.toLocaleString()}
                        <span className="supply-eval-metric-unit">calls</span>
                      </div>
                    </div>

                    <div className="supply-eval-metric">
                      <div className="supply-eval-metric-label">Avg Response Time</div>
                      <div className="supply-eval-metric-value">
                        {stats.averageResponseTime}
                        <span className="supply-eval-metric-unit">ms</span>
                      </div>
                    </div>
                  </div>

                  <div className="supply-eval-progress">
                    <div className="supply-eval-progress-label">Success Rate</div>
                    <div className="supply-eval-progress-bar">
                      <div
                        className="supply-eval-progress-fill"
                        style={{ width: `${stats.successRate}%` }}
                      />
                    </div>
                  </div>

                  {stats.userFeedback.length > 0 && (
                    <div className="supply-eval-feedback">
                      <div className="supply-eval-feedback-label">Recent Feedback</div>
                      <div className="supply-eval-feedback-list">
                        {stats.userFeedback.slice(0, 3).map((feedback, idx) => (
                          <div key={idx} className="supply-eval-feedback-item">
                            {feedback}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
