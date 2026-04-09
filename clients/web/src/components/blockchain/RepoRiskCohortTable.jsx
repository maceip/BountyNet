/**
 * Copyright IBM Corp. 2025, 2026
 *
 * This source code is licensed under the Apache-2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */
import {
  ProgressBar,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tag,
} from '@carbon/react';

const DEFAULT_ROWS = [
  {
    repo: 'maceip/freehold-relay',
    cohort: 'Core',
    risk: 81,
    streak: 4,
    policy: 'Escrow-first',
  },
  {
    repo: 'stare/lit-router',
    cohort: 'Growth',
    risk: 62,
    streak: 2,
    policy: 'Token-budget',
  },
  {
    repo: 'bountynet/web',
    cohort: 'UI',
    risk: 39,
    streak: 1,
    policy: 'Low-cost',
  },
];

export const RepoRiskCohortTable = ({ rows = DEFAULT_ROWS }) => {
  return (
    <section className="bn-risk-table" aria-label="Repo risk cohort table">
      <div className="bn-risk-table__header">
        <div>
          <p className="bn-section-label">Repo risk cohort table</p>
          <h3>Group repos by risk posture, not just activity</h3>
        </div>
      </div>

      <Table size="md" useZebraStyles={false}>
        <TableHead>
          <TableRow>
            <TableHeader>Repo</TableHeader>
            <TableHeader>Cohort</TableHeader>
            <TableHeader>Risk score</TableHeader>
            <TableHeader>Failure streak</TableHeader>
            <TableHeader>Policy</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.repo}>
              <TableCell>{row.repo}</TableCell>
              <TableCell>
                <Tag
                  type={
                    row.cohort === 'Core'
                      ? 'red'
                      : row.cohort === 'Growth'
                        ? 'blue'
                        : 'cool-gray'
                  }
                >
                  {row.cohort}
                </Tag>
              </TableCell>
              <TableCell>
                <ProgressBar
                  hideLabel
                  helperText=""
                  label={`${row.risk}`}
                  max={100}
                  value={row.risk}
                />
              </TableCell>
              <TableCell>{row.streak}</TableCell>
              <TableCell>{row.policy}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  );
};
