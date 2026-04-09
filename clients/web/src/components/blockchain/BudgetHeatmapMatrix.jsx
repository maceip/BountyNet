/**
 * Copyright IBM Corp. 2025, 2026
 *
 * This source code is licensed under the Apache-2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { Tag } from '@carbon/react';

const ROWS = ['Lint', 'Unit', 'Integration', 'Deploy'];
const COLS = ['<25k', '25k-75k', '75k-150k', '150k+'];
const VALUES = [
  [1, 2, 1, 0],
  [1, 3, 2, 1],
  [0, 2, 3, 2],
  [0, 1, 2, 3],
];

export const BudgetHeatmapMatrix = () => {
  return (
    <section className="bn-heatmap" aria-label="Budget heatmap matrix">
      <div className="bn-heatmap__header">
        <div>
          <p className="bn-section-label">Budget heatmap matrix</p>
          <h3>Failure class versus expected spend band</h3>
        </div>
        <div className="bn-inline-tags">
          <Tag type="cool-gray">Cold</Tag>
          <Tag type="blue">Warm</Tag>
          <Tag type="green">Hot</Tag>
        </div>
      </div>

      <div className="bn-heatmap__grid" role="grid">
        <div className="bn-heatmap__corner" />
        {COLS.map((column) => (
          <div className="bn-heatmap__label" key={column}>
            {column}
          </div>
        ))}
        {ROWS.map((row, rowIndex) => (
          <div className="bn-heatmap__row" key={row}>
            <div className="bn-heatmap__label">{row}</div>
            {VALUES[rowIndex].map((value, columnIndex) => (
              <div
                className={`bn-heatmap__cell bn-heatmap__cell--${value}`}
                key={`${row}-${COLS[columnIndex]}`}
                role="gridcell"
              >
                <strong>
                  {value === 0
                    ? 'Low'
                    : value === 1
                      ? 'Guard'
                      : value === 2
                        ? 'Scale'
                        : 'Escrow'}
                </strong>
                <span>{row}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
};
