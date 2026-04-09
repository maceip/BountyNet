/**
 * Copyright IBM Corp. 2025, 2026
 *
 * This source code is licensed under the Apache-2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { InlineNotification, Tag } from '@carbon/react';

const ITEMS = [
  {
    title: 'Lint & Format',
    status: 'info',
    repo: 'maceip/freehold-relay',
    detail: 'TEE proof queued for agent-12',
  },
  {
    title: 'Unit tests',
    status: 'success',
    repo: 'stare/lit-router',
    detail: 'ValidationRegistry updated',
  },
  {
    title: 'Deploy gate',
    status: 'warning',
    repo: 'bountynet/web',
    detail: 'Oracle waiting on rerun',
  },
];

export const ValidationQueueStrip = () => {
  return (
    <section
      className="bn-validation-strip"
      aria-label="Validation queue strip"
    >
      <div className="bn-validation-strip__header">
        <div>
          <p className="bn-section-label">Validation queue strip</p>
          <h3>Queue state across oracle-backed checks</h3>
        </div>
        <Tag type="cool-gray">Streaming queue</Tag>
      </div>
      <div className="bn-validation-strip__list">
        {ITEMS.map((item) => (
          <div
            className="bn-validation-strip__item"
            key={`${item.repo}-${item.title}`}
          >
            <InlineNotification
              lowContrast
              hideCloseButton
              kind={item.status}
              title={item.title}
              subtitle={item.detail}
            />
            <span>{item.repo}</span>
          </div>
        ))}
      </div>
    </section>
  );
};
