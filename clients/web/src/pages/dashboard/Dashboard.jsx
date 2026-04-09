/**
 * Copyright IBM Corp. 2025, 2026
 *
 * This source code is licensed under the Apache-2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */
import {
  Button,
  Column,
  Grid,
  Loading,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tag,
  Tile,
} from '@carbon/react';
import { PageHeader } from '@carbon/ibm-products';
import { ContextIdentityStrip } from '../../components/blockchain/ContextIdentityStrip.jsx';
import { SettlementLifecycleRail } from '../../components/blockchain/SettlementLifecycleRail.jsx';
import { Footer } from '../../components/footer/Footer.jsx';
import { InsightsPanel } from '../../components/insights/InsightsPanel.jsx';
import { LiveActivityFeed } from '../../components/live-activity/LiveActivityFeed.jsx';
import { PageLayout } from '../../layouts/page-layout.jsx';
import { usePollingJson } from '../../hooks/usePollingJson.js';
import { lazy, Suspense } from 'react';

const AddressRepoDrilldownDrawer = lazy(() =>
  import('../../components/blockchain/AddressRepoDrilldownDrawer.jsx').then(
    (module) => ({
      default: module.AddressRepoDrilldownDrawer,
    }),
  ),
);
const ChainEventDeltaCard = lazy(() =>
  import('../../components/blockchain/ChainEventDeltaCard.jsx').then(
    (module) => ({
      default: module.ChainEventDeltaCard,
    }),
  ),
);
const ValidationQueueStrip = lazy(() =>
  import('../../components/blockchain/ValidationQueueStrip.jsx').then(
    (module) => ({
      default: module.ValidationQueueStrip,
    }),
  ),
);

const INITIAL_DASHBOARD = {
  authenticated: false,
  agent: {
    balances: {},
    reputation: {},
  },
  portfolioStats: [],
  repos: [],
  sessions: [],
};

const CompositeFallback = ({ label }) => (
  <div className="bn-loading-block">
    <p className="bn-section-label">{label}</p>
    <p>Loading module...</p>
  </div>
);

const Dashboard = () => {
  const { data, loading } = usePollingJson(
    '/api/bountynet/dashboard',
    INITIAL_DASHBOARD,
    12000,
  );

  if (loading && data.portfolioStats.length === 0) {
    return (
      <PageLayout fallback={<p>Loading dashboard...</p>}>
        <Loading withOverlay={false} description="Loading dashboard" />
      </PageLayout>
    );
  }

  return (
    <PageLayout className="bn-page" fallback={<p>Loading dashboard...</p>}>
      <PageHeader
        className="bn-page-header"
        title="Authenticated dashboard"
        subtitle={
          data.authenticated
            ? `Connected as ${data.agent.ens || `agent #${data.agent.agent_id}`}`
            : 'No local ~/.bountynet/agent.json found. Showing operational demo state.'
        }
      />

      <Grid fullWidth className="bn-section">
        <Column sm={4} md={8} lg={16}>
          <div className="bn-metric-strip">
            {data.portfolioStats.map((item) => (
              <Tile key={item.label}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </Tile>
            ))}
          </div>
        </Column>
      </Grid>

      <Grid fullWidth className="bn-section">
        <Column sm={4} md={8} lg={16}>
          <ContextIdentityStrip
            ens={data.agent.ens || `agent-${data.agent.agent_id}.maceip.eth`}
            wallet={data.agent.wallet}
            mode="api_key"
          />
        </Column>
      </Grid>

      <Grid fullWidth className="bn-section">
        <Column sm={4} md={8} lg={6}>
          <Tile className="bn-card">
            <p className="bn-section-label">Identity</p>
            <h2>{data.agent.ens || `Agent #${data.agent.agent_id}`}</h2>
            <p>{data.agent.wallet}</p>
            <div className="bn-inline-tags">
              <Tag type="green">
                EURC {data.agent.balances?.eurc || '23.50'}
              </Tag>
              <Tag type="blue">
                Native {data.agent.balances?.native || '1.9925'}
              </Tag>
              <Tag type="cool-gray">
                Solved {data.agent.reputation?.bounties_solved || 0}
              </Tag>
            </div>
          </Tile>
        </Column>
        <Column sm={4} md={8} lg={10}>
          <InsightsPanel
            persona="solver"
            repos={data.repos.map((repo) => repo.repo)}
            history={data.sessions.map((session) =>
              `${session.repo} ${session.check_name || ''}`.trim(),
            )}
            storageKey="dashboard-first-visit"
            title="First-visit portfolio insight"
          />
        </Column>
      </Grid>

      <Grid fullWidth className="bn-section">
        <Column sm={4} md={8} lg={10}>
          <Tile className="bn-card">
            <Suspense fallback={<CompositeFallback label="Validation queue" />}>
              <ValidationQueueStrip />
            </Suspense>
          </Tile>
        </Column>
        <Column sm={4} md={8} lg={6}>
          <Tile className="bn-card">
            <Suspense fallback={<CompositeFallback label="Chain deltas" />}>
              <ChainEventDeltaCard />
            </Suspense>
            <div className="bn-inline-actions">
              <Suspense fallback={<CompositeFallback label="Entity drawer" />}>
                <AddressRepoDrilldownDrawer />
              </Suspense>
              <Button kind="ghost" size="sm">
                Open repo incident
              </Button>
            </div>
          </Tile>
        </Column>
      </Grid>

      <Grid fullWidth className="bn-section">
        <Column sm={4} md={8} lg={16}>
          <Tile className="bn-card">
            <SettlementLifecycleRail
              currentIndex={2}
              stages={[
                {
                  label: 'Stake',
                  detail: 'Repo owner budget attached',
                  status: 'complete',
                },
                {
                  label: 'Claim',
                  detail: 'Agent claimed context',
                  status: 'complete',
                },
                {
                  label: 'Infer',
                  detail: 'Gateway /v1/messages active',
                  status: 'current',
                },
                {
                  label: 'Validate',
                  detail: 'TEE-backed CI verdict queued',
                  status: 'incomplete',
                },
                {
                  label: 'Settle',
                  detail: 'Solver and treasury split',
                  status: 'incomplete',
                },
              ]}
            />
          </Tile>
        </Column>
      </Grid>

      <Grid fullWidth className="bn-section">
        <Column sm={4} md={8} lg={8}>
          <Tile className="bn-card">
            <p className="bn-section-label">Repo portfolio</p>
            <h2>Known repos and active session density</h2>
            <Table size="md" useZebraStyles={false}>
              <TableHead>
                <TableRow>
                  <TableHeader>Repo</TableHeader>
                  <TableHeader>Sessions</TableHeader>
                  <TableHeader>Tokens</TableHeader>
                  <TableHeader>Status</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.repos.map((repo) => (
                  <TableRow key={repo.repo}>
                    <TableCell>{repo.repo}</TableCell>
                    <TableCell>{repo.sessions}</TableCell>
                    <TableCell>{repo.tokens}</TableCell>
                    <TableCell>{repo.status}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Tile>
        </Column>
        <Column sm={4} md={8} lg={8}>
          <Tile className="bn-card">
            <p className="bn-section-label">Claim sessions</p>
            <h2>Recent coding contexts</h2>
            <Table size="md" useZebraStyles={false}>
              <TableHead>
                <TableRow>
                  <TableHeader>Context</TableHeader>
                  <TableHeader>Repo</TableHeader>
                  <TableHeader>Model</TableHeader>
                  <TableHeader>Status</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.sessions.map((session) => (
                  <TableRow key={session.context_hash}>
                    <TableCell>{session.context_hash}</TableCell>
                    <TableCell>{session.repo}</TableCell>
                    <TableCell>{session.model}</TableCell>
                    <TableCell>{session.status}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Tile>
        </Column>
      </Grid>

      <Grid fullWidth className="bn-section">
        <Column sm={4} md={8} lg={16}>
          <LiveActivityFeed />
        </Column>
      </Grid>

      <Footer />
    </PageLayout>
  );
};

export default Dashboard;
