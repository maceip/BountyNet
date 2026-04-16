import React from 'react';
import { useNavigate } from 'react-router-dom';
import { TaskCard } from './TaskCard';
import { DashboardCard } from './DashboardCard';
import './Dashboard.css';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  return (
    <div className="dashboard-page">
      <div className="dashboard-content">
        <div className="dashboard-intro">
          <span className="dashboard-intro-title">
            Meet Jules, when software builds itself
          </span>
          <br />
          Jules runs continuously in the cloud, learning your codebase and improving
          it over time. It turns understanding into action so progress keeps
          happening, even when you are away.
        </div>

        <div className="dashboard-sections">
          <div className="task-card-section">
            <TaskCard />
          </div>
          <DashboardCard />
        </div>
      </div>

      <div className="dashboard-footer">
        <span>
          Jules is powerful and can execute on any inputs and repositories
          received. For best results, read the{' '}
          <a
            href="https://jules.google/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="dashboard-footer-link"
          >
            usage guide
          </a>
          .
        </span>
      </div>

      <div className="dashboard-footer">
        <button
          onClick={() => navigate('/legal')}
          className="dashboard-footer-link"
        >
          Terms
        </button>
        <button
          onClick={() => navigate('/licenses')}
          className="dashboard-footer-link"
        >
          Open source licenses
        </button>
        <a
          href="https://g.co/legal/generative-code"
          target="_blank"
          rel="noopener noreferrer"
          className="dashboard-footer-link"
        >
          Use code with caution
        </a>
      </div>
    </div>
  );
};
