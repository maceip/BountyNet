/**
 * Copyright IBM Corp. 2025, 2026
 *
 * This source code is licensed under the Apache-2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { ProgressBar, Tag } from '@carbon/react';

export const SolverStakerSplitComparisonRail = ({
  solver = 70,
  treasury = 30,
  tokenSpend = 28100,
  payout = '5.00 EURC',
}) => {
  return (
    <section
      className="bn-split-rail"
      aria-label="Solver versus staker split comparison"
    >
      <div className="bn-split-rail__header">
        <div>
          <p className="bn-section-label">Split comparison rail</p>
          <h3>Compare budget burn to final payout allocation</h3>
        </div>
        <Tag type="purple">{payout}</Tag>
      </div>

      <div className="bn-split-rail__tracks">
        <div>
          <ProgressBar
            label={`Solver share ${solver}%`}
            helperText={`${tokenSpend.toLocaleString()} tokens burned to capture solver payout`}
            max={100}
            value={solver}
          />
        </div>
        <div>
          <ProgressBar
            label={`Treasury share ${treasury}%`}
            helperText="Protocol retention after validation succeeds"
            max={100}
            value={treasury}
          />
        </div>
      </div>
    </section>
  );
};
