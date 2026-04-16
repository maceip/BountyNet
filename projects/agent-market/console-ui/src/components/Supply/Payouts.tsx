import React from 'react';
import { Icon } from '../Common/Icon';
import { useAgent } from '../../context/AgentContext';
import './Supply.css';

export const Payouts: React.FC = () => {
  const { agents, payouts } = useAgent();

  // Calculate totals
  const totalEarnings = payouts.reduce((sum, p) => sum + p.amount, 0);
  const pendingPayouts = payouts.filter((p) => p.status === 'pending');
  const completedPayouts = payouts.filter((p) => p.status === 'completed');

  return (
    <div className="supply-payouts">
      <div className="supply-payouts-header">
        <h1>Payouts</h1>
        <p>Manage your earnings and payment history</p>
      </div>

      <div className="supply-stats-grid">
        <div className="supply-stat-card">
          <div className="supply-stat-header">
            <Icon name="download" size="md" />
            <span className="supply-stat-label">Total Earnings</span>
          </div>
          <div className="supply-stat-value">${totalEarnings.toFixed(2)}</div>
          <p className="supply-stat-detail">All time</p>
        </div>

        <div className="supply-stat-card">
          <div className="supply-stat-header">
            <Icon name="check" size="md" />
            <span className="supply-stat-label">Completed Payouts</span>
          </div>
          <div className="supply-stat-value">{completedPayouts.length}</div>
          <p className="supply-stat-detail">${completedPayouts.reduce((s, p) => s + p.amount, 0).toFixed(2)} total</p>
        </div>

        <div className="supply-stat-card">
          <div className="supply-stat-header">
            <Icon name="hourglass_top" size="md" />
            <span className="supply-stat-label">Pending Payouts</span>
          </div>
          <div className="supply-stat-value">{pendingPayouts.length}</div>
          <p className="supply-stat-detail">${pendingPayouts.reduce((s, p) => s + p.amount, 0).toFixed(2)} total</p>
        </div>

        <div className="supply-stat-card">
          <div className="supply-stat-header">
            <Icon name="memory" size="md" />
            <span className="supply-stat-label">Next Payout</span>
          </div>
          <div className="supply-stat-value">Jan 15</div>
          <p className="supply-stat-detail">2025</p>
        </div>
      </div>

      {payouts.length === 0 ? (
        <div className="supply-empty-state">
          <Icon name="download" size="lg" />
          <h3>No payment history</h3>
          <p>Your payouts will appear here as you earn from your agents</p>
        </div>
      ) : (
        <table className="supply-payouts-table">
          <thead>
            <tr>
              <th>Agent</th>
              <th>Period</th>
              <th>Usage</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {payouts.map((payout) => {
              const agent = agents.find((a) => a.id === payout.agentId);
              const date = new Date(payout.createdAt);
              const displayDate = payout.processedAt
                ? new Date(payout.processedAt).toLocaleDateString()
                : date.toLocaleDateString();

              return (
                <tr key={payout.id}>
                  <td>{agent?.name || 'Unknown'}</td>
                  <td>{payout.period}</td>
                  <td>{payout.usageCount.toLocaleString()}</td>
                  <td>${payout.amount.toFixed(2)}</td>
                  <td>
                    <span className={`supply-payout-status supply-payout-${payout.status}`}>
                      {payout.status.charAt(0).toUpperCase() + payout.status.slice(1)}
                    </span>
                  </td>
                  <td>{displayDate}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <div className="supply-payout-info">
        <h3>Payment Information</h3>
        <p>
          Payouts are processed monthly on the 15th. Your earnings are calculated based on usage metrics
          and agent performance. A 30% platform fee applies to all earnings.
        </p>
      </div>
    </div>
  );
};
