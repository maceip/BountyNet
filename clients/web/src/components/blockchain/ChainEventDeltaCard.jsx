/**
 * Copyright IBM Corp. 2025, 2026
 *
 * This source code is licensed under the Apache-2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { Tag } from '@carbon/react';

const SPARK = [12, 18, 15, 28, 22, 31, 27, 38, 34, 46];

const buildPath = (values) =>
  values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * 220;
      const y = 52 - value;
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');

export const ChainEventDeltaCard = ({
  title = 'BountyCreated delta',
  value = '+12.4%',
  detail = '24h growth in claimable contexts',
}) => {
  return (
    <section className="bn-delta-card" aria-label="Chain event delta card">
      <div className="bn-delta-card__header">
        <div>
          <p className="bn-section-label">Chain event delta</p>
          <h3>{title}</h3>
        </div>
        <Tag type="green">{value}</Tag>
      </div>
      <p>{detail}</p>
      <svg
        className="bn-delta-card__sparkline"
        viewBox="0 0 220 64"
        role="img"
        aria-label="Inline sparkline showing event delta trend"
      >
        <path
          d={buildPath(SPARK)}
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
        />
      </svg>
    </section>
  );
};
