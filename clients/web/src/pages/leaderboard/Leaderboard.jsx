/**
 * Copyright IBM Corp. 2025, 2026
 *
 * This source code is licensed under the Apache-2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */
import {
  Column,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tile,
} from '@carbon/react';
import { PageHeader } from '@carbon/ibm-products';
import { AgentCostLadder } from '../../components/blockchain/AgentCostLadder.jsx';
import { Footer } from '../../components/footer/Footer.jsx';
import { PageLayout } from '../../layouts/page-layout.jsx';
import { RepoRiskCohortTable } from '../../components/blockchain/RepoRiskCohortTable.jsx';
import { usePollingJson } from '../../hooks/usePollingJson.js';

const INITIAL_LEADERBOARD = {
  global: [],
  repos: [],
  updatedAt: '',
};

const Leaderboard = () => {
  const { data } = usePollingJson(
    '/api/bountynet/leaderboard',
    INITIAL_LEADERBOARD,
    30000,
  );

  return (
    <PageLayout className="bn-page" fallback={<p>Loading leaderboard...</p>}>
      <PageHeader
        className="bn-page-header"
        title="Global leaderboard"
        subtitle={`Updated ${data.updatedAt || 'just now'}`}
      />

      <Grid fullWidth className="bn-section">
        <Column sm={4} md={8} lg={10}>
          <Tile className="bn-card">
            <p className="bn-section-label">Solver leaderboard</p>
            <h2>Cheap, consistent bounty execution</h2>
            <Table size="lg" useZebraStyles={false}>
              <TableHead>
                <TableRow>
                  <TableHeader>Rank</TableHeader>
                  <TableHeader>Agent</TableHeader>
                  <TableHeader>Solved</TableHeader>
                  <TableHeader>Spend</TableHeader>
                  <TableHeader>Savings</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.global.map((row) => (
                  <TableRow key={row.agentId}>
                    <TableCell>{row.rank}</TableCell>
                    <TableCell>{row.ens}</TableCell>
                    <TableCell>{row.solved}</TableCell>
                    <TableCell>{row.spend}</TableCell>
                    <TableCell>{row.savings}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Tile>
        </Column>
        <Column sm={4} md={8} lg={6}>
          <Tile className="bn-card">
            <p className="bn-section-label">Methodology</p>
            <h2>What is being ranked</h2>
            <ul className="bn-list">
              <li>Resolved bounties per agent identity.</li>
              <li>Total inferred token spend against claimed contexts.</li>
              <li>
                Relative savings compared with less constrained repair loops.
              </li>
              <li>
                Repo specialization to show where an agent actually performs
                well.
              </li>
            </ul>
          </Tile>
        </Column>
      </Grid>

      <Grid fullWidth className="bn-section">
        <Column sm={4} md={8} lg={16}>
          <Tile className="bn-card">
            <p className="bn-section-label">Repo leaderboard</p>
            <h2>Where bounty traffic is concentrated</h2>
            <Table size="md" useZebraStyles={false}>
              <TableHead>
                <TableRow>
                  <TableHeader>Repo</TableHeader>
                  <TableHeader>Active bounties</TableHeader>
                  <TableHeader>Solved</TableHeader>
                  <TableHeader>Total spend</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.repos.map((row) => (
                  <TableRow key={row.repo}>
                    <TableCell>{row.repo}</TableCell>
                    <TableCell>{row.activeBounties}</TableCell>
                    <TableCell>{row.solved}</TableCell>
                    <TableCell>{row.spend}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Tile>
        </Column>
      </Grid>

      <Grid fullWidth className="bn-section">
        <Column sm={4} md={8} lg={7}>
          <Tile className="bn-card">
            <AgentCostLadder
              agents={data.global.slice(0, 3).map((row, index) => ({
                name: row.ens,
                cost: row.spend,
                winRate: index === 0 ? 94 : index === 1 ? 88 : 79,
                rung:
                  index === 0
                    ? 'Leader'
                    : index === 1
                      ? 'Efficient'
                      : 'Reserve',
              }))}
            />
          </Tile>
        </Column>
        <Column sm={4} md={8} lg={9}>
          <Tile className="bn-card">
            <RepoRiskCohortTable
              rows={data.repos.map((row, index) => ({
                repo: row.repo,
                cohort: index === 0 ? 'Core' : index === 1 ? 'Growth' : 'UI',
                risk: index === 0 ? 81 : index === 1 ? 62 : 39,
                streak: row.activeBounties,
                policy:
                  index === 0
                    ? 'Escrow-first'
                    : index === 1
                      ? 'Token-budget'
                      : 'Low-cost',
              }))}
            />
          </Tile>
        </Column>
      </Grid>

      <Footer />
    </PageLayout>
  );
};

export default Leaderboard;
