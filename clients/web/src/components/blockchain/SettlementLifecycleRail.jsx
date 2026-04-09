/**
 * Copyright IBM Corp. 2025, 2026
 *
 * This source code is licensed under the Apache-2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { ProgressIndicator, ProgressStep, Tag } from '@carbon/react';

const DEFAULT_STAGES = [
  {
    label: 'Stake',
    detail: 'Budget escrowed',
    status: 'complete',
  },
  {
    label: 'Claim',
    detail: 'Solver assigned',
    status: 'current',
  },
  {
    label: 'Infer',
    detail: 'Gateway metering active',
    status: 'incomplete',
  },
  {
    label: 'Validate',
    detail: 'TEE verdict pending',
    status: 'incomplete',
  },
  {
    label: 'Settle',
    detail: 'Treasury and solver split',
    status: 'incomplete',
  },
];

export const SettlementLifecycleRail = ({
  stages = DEFAULT_STAGES,
  currentIndex = 1,
}) => {
  return (
    <section
      className="bn-settlement-rail"
      aria-label="Bounty settlement lifecycle"
    >
      <div className="bn-settlement-rail__header">
        <div>
          <p className="bn-section-label">Lifecycle rail</p>
          <h3>From failed check to final settlement</h3>
        </div>
        <Tag type="blue">Context-bound workflow</Tag>
      </div>

      <ProgressIndicator
        currentIndex={currentIndex}
        spaceEqually
        vertical={false}
      >
        {stages.map((stage) => (
          <ProgressStep
            key={stage.label}
            label={stage.label}
            secondaryLabel={stage.detail}
            current={stage.status === 'current'}
            complete={stage.status === 'complete'}
            disabled={stage.status === 'disabled'}
          />
        ))}
      </ProgressIndicator>

      <div className="bn-settlement-rail__details">
        {stages.map((stage) => (
          <article
            className="bn-settlement-rail__detail-card"
            key={stage.label}
          >
            <Tag
              type={
                stage.status === 'complete'
                  ? 'green'
                  : stage.status === 'current'
                    ? 'blue'
                    : 'cool-gray'
              }
            >
              {stage.label}
            </Tag>
            <p>{stage.detail}</p>
          </article>
        ))}
      </div>
    </section>
  );
};
