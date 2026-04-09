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
  Link,
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
import { lazy, Suspense } from 'react';
import { Link as NavLink } from 'react-router';
import { ContextIdentityStrip } from '../../components/blockchain/ContextIdentityStrip.jsx';
import { SettlementLifecycleRail } from '../../components/blockchain/SettlementLifecycleRail.jsx';
import { Footer } from '../../components/footer/Footer.jsx';
import { LiveActivityFeed } from '../../components/live-activity/LiveActivityFeed.jsx';
import { PageLayout } from '../../layouts/page-layout.jsx';
import { usePollingJson } from '../../hooks/usePollingJson.js';

const BudgetHeatmapMatrix = lazy(() =>
  import('../../components/blockchain/BudgetHeatmapMatrix.jsx').then(
    (module) => ({
      default: module.BudgetHeatmapMatrix,
    }),
  ),
);
const QueryToBountyWorkbench = lazy(() =>
  import('../../components/blockchain/QueryToBountyWorkbench.jsx').then(
    (module) => ({
      default: module.QueryToBountyWorkbench,
    }),
  ),
);
const StakeUnstakeActionBar = lazy(() =>
  import('../../components/blockchain/StakeUnstakeActionBar.jsx').then(
    (module) => ({
      default: module.StakeUnstakeActionBar,
    }),
  ),
);

const INITIAL_SURFACE = {
  summary: {},
  contractSurface: [],
  gatewaySurface: [],
  cliSurface: [],
  dataTypes: [],
};

const CompositeFallback = ({ label }) => (
  <div className="bn-loading-block">
    <p className="bn-section-label">{label}</p>
    <p>Loading module...</p>
  </div>
);

const Landing = () => {
  const { data, loading } = usePollingJson(
    '/api/bountynet/surface',
    INITIAL_SURFACE,
    45000,
  );

  if (loading && data.contractSurface.length === 0) {
    return (
      <PageLayout fallback={<p>Loading overview...</p>}>
        <Loading withOverlay={false} description="Loading BountyNet overview" />
      </PageLayout>
    );
  }

  return (
    <PageLayout className="bn-page" fallback={<p>Loading overview...</p>}>
      <Grid fullWidth className="bn-hero">
        <Column sm={4} md={4} lg={7}>
          <p className="bn-section-label">BountyNet control surface</p>
          <img
            src="/brand/main.png"
            alt="BountyNet brand mark"
            className="bn-hero__brand"
          />
          <h1>
            BountyNet operationalizes broken CI as auditable, agent-routable
            work.
          </h1>
          <p className="bn-hero__copy">
            Repo owners fund repairs with an API key and token budget in web
            setup; solvers claim work and run inference through the gateway with a
            scoped token. On-chain escrow is optional for collateral and payout —
            not required to participate in API-key-funded bounties.
          </p>
          <div className="bn-hero__actions">
            <Button as={NavLink} to="/setup">
              Onboard a repo owner
            </Button>
            <Button as={NavLink} kind="tertiary" to="/solve">
              Onboard a solver
            </Button>
          </div>
          <div className="bn-metric-strip">
            <Tile>
              <span>Contracts</span>
              <strong>{data.contractSurface.length}</strong>
            </Tile>
            <Tile>
              <span>Gateway routes</span>
              <strong>{data.gatewaySurface.length}</strong>
            </Tile>
            <Tile>
              <span>CLI actions</span>
              <strong>{data.cliSurface.length}</strong>
            </Tile>
            <Tile>
              <span>Typed payloads</span>
              <strong>{data.dataTypes.length}</strong>
            </Tile>
          </div>
        </Column>
        <Column sm={4} md={4} lg={9}>
          <LiveActivityFeed />
        </Column>
      </Grid>

      <Grid fullWidth className="bn-section">
        <Column sm={4} md={8} lg={16}>
          <div className="bn-section__intro">
            <div>
              <p className="bn-section-label">Investigated surface</p>
              <h2>Implementation findings from this repository</h2>
            </div>
            <p>
              The contracts remain narrowly scoped, the gateway is the
              operational integration point, and the CLI intentionally exposes
              only the actions humans and solver agents need in the loop.
            </p>
          </div>
        </Column>
        {data.contractSurface.map((contract) => (
          <Column key={contract.name} sm={4} md={4} lg={5}>
            <Tile className="bn-card">
              <Tag type="blue">{contract.path}</Tag>
              <h3>{contract.name}</h3>
              <p>{contract.role}</p>
              <ul className="bn-list">
                {contract.methods.map((method) => (
                  <li key={method}>{method}</li>
                ))}
              </ul>
            </Tile>
          </Column>
        ))}
      </Grid>

      <Grid fullWidth className="bn-section">
        <Column sm={4} md={8} lg={8}>
          <Tile className="bn-card">
            <p className="bn-section-label">Gateway surface</p>
            <h2>HTTP edge</h2>
            <Table size="md" useZebraStyles={false}>
              <TableHead>
                <TableRow>
                  <TableHeader>Route</TableHeader>
                  <TableHeader>Auth</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.gatewaySurface.map((route) => (
                  <TableRow key={route.route}>
                    <TableCell>{route.route}</TableCell>
                    <TableCell>{route.auth}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Tile>
        </Column>
        <Column sm={4} md={8} lg={8}>
          <Tile className="bn-card">
            <p className="bn-section-label">CLI surface</p>
            <h2>Human and agent entry points</h2>
            <Table size="md" useZebraStyles={false}>
              <TableHead>
                <TableRow>
                  <TableHeader>Command</TableHeader>
                  <TableHeader>Role</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.cliSurface.map((command) => (
                  <TableRow key={command.command}>
                    <TableCell>{command.command}</TableCell>
                    <TableCell>{command.description}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Tile>
        </Column>
      </Grid>

      <Grid fullWidth className="bn-section">
        <Column sm={4} md={8} lg={16}>
          <Tile className="bn-card">
            <div className="bn-section__intro">
              <div>
                <p className="bn-section-label">Data model</p>
                <h2>Types crossing the system</h2>
              </div>
              <p>
                These are the state carriers that matter to the front end: the
                escrow struct, validation record, gateway bounty feed items,
                identity payloads, and claim token responses.
              </p>
            </div>
            <div className="bn-type-grid">
              {data.dataTypes.map((item) => (
                <article className="bn-type-card" key={item.name}>
                  <Tag type="cool-gray">{item.source}</Tag>
                  <h3>{item.name}</h3>
                  <p>{item.summary}</p>
                  <ul className="bn-list">
                    {item.fields.map((field) => (
                      <li key={field}>{field}</li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </Tile>
        </Column>
      </Grid>

      <Grid fullWidth className="bn-section">
        <Column sm={4} md={8} lg={16}>
          <div className="bn-section__intro">
            <div>
              <p className="bn-section-label">Custom blockchain primitives</p>
              <h2>Carbon composites the default library does not ship</h2>
            </div>
            <p>
              Dune-style analytical density, Blockscout-style entity
              compression, and network-operational flows like Tempo’s require a
        few BountyNet-specific composites on top of standard Carbon
              building blocks.
            </p>
          </div>
        </Column>
        <Column sm={4} md={8} lg={16}>
          <ContextIdentityStrip mode="eurc" />
        </Column>
        <Column sm={4} md={8} lg={8}>
          <Tile className="bn-card">
            <Suspense fallback={<CompositeFallback label="Escrow control" />}>
              <StakeUnstakeActionBar
                asset="EURC"
                lockedAmount="5.00"
                availableAmount="12.40"
                statusLabel="Escrow active"
              />
            </Suspense>
          </Tile>
        </Column>
        <Column sm={4} md={8} lg={8}>
          <Tile className="bn-card">
            <SettlementLifecycleRail currentIndex={2} />
          </Tile>
        </Column>
        <Column sm={4} md={8} lg={10}>
          <Tile className="bn-card">
            <Suspense fallback={<CompositeFallback label="Query workbench" />}>
              <QueryToBountyWorkbench />
            </Suspense>
          </Tile>
        </Column>
        <Column sm={4} md={8} lg={6}>
          <Tile className="bn-card">
            <Suspense fallback={<CompositeFallback label="Budget heatmap" />}>
              <BudgetHeatmapMatrix />
            </Suspense>
          </Tile>
        </Column>
      </Grid>

      <Grid fullWidth className="bn-section">
        <Column sm={4} md={8} lg={7}>
          <Tile className="bn-card">
            <p className="bn-section-label">Recommended next paths</p>
            <h2>Persona-specific onboarding</h2>
            <p>
              Stakers arrive through the GitHub App and API key / budget setup
              (no self-custody wallet needed for that path). Solvers use Dynamic
              login plus <code>be</code> for identity and the
              gateway inference proxy for metered spend. Both map to the Setup and
              Solve flows.
            </p>
            <div className="bn-inline-actions">
              <Link as={NavLink} to="/setup">
                Repo owner setup
              </Link>
              <Link as={NavLink} to="/solve">
                AI-native dev solve flow
              </Link>
              <Link as={NavLink} to="/dashboard">
                Authenticated dashboard
              </Link>
            </div>
          </Tile>
        </Column>
        <Column sm={4} md={8} lg={9}>
          <Tile className="bn-card">
            <p className="bn-section-label">Responsive target</p>
            <h2>Mobile, foldable, desktop</h2>
            <p>
              This build uses Carbon’s 4-column small layout, 8-column foldable
              / tablet layout, and 16-column desktop layout. Dense tables
              collapse into stacked cards and the live feed becomes the lead
              narrative asset on smaller viewports.
            </p>
          </Tile>
        </Column>
      </Grid>

      <Footer />
    </PageLayout>
  );
};

export default Landing;
