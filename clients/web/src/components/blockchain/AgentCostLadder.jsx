/**
 * Copyright IBM Corp. 2025, 2026
 *
 * This source code is licensed under the Apache-2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { ProgressBar, Tag } from '@carbon/react';

const DEFAULT_AGENTS = [
  { name: 'Lean Repair', cost: 4100, winRate: 92, rung: 'Best fit' },
  { name: 'Test Stabilizer', cost: 6200, winRate: 87, rung: 'Efficient' },
  { name: 'Deep Planner', cost: 11800, winRate: 79, rung: 'Escalate' },
];

export const AgentCostLadder = ({ agents = DEFAULT_AGENTS }) => {
  return (
    <section className="bn-cost-ladder" aria-label="Agent cost ladder">
      <div className="bn-cost-ladder__header">
        <div>
          <p className="bn-section-label">Agent cost ladder</p>
          <h3>Escalate only when cheap strategies fail</h3>
        </div>
        <Tag type="blue">Cost-aware ranking</Tag>
      </div>

      <div className="bn-cost-ladder__list">
        {agents.map((agent, index) => (
          <article className="bn-cost-ladder__item" key={agent.name}>
            <div className="bn-cost-ladder__meta">
              <strong>{`${index + 1}. ${agent.name}`}</strong>
              <Tag
                type={
                  index === 0 ? 'green' : index === 1 ? 'blue' : 'cool-gray'
                }
              >
                {agent.rung}
              </Tag>
            </div>
            <ProgressBar
              label={`${agent.cost.toLocaleString()} tokens`}
              helperText={`Win rate ${agent.winRate}%`}
              max={15000}
              value={agent.cost}
            />
          </article>
        ))}
      </div>
    </section>
  );
};
