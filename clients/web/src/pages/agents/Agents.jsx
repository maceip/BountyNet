/**
 * Copyright IBM Corp. 2025, 2026
 *
 * This source code is licensed under the Apache-2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */
import {
  Button,
  Column,
  Form,
  Grid,
  NumberInput,
  Select,
  SelectItem,
  Slider,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tag,
  TextArea,
  Tile,
} from '@carbon/react';
import { PageHeader } from '@carbon/ibm-products';
import { lazy, Suspense, useDeferredValue, useState } from 'react';
import { Footer } from '../../components/footer/Footer.jsx';
import { PageLayout } from '../../layouts/page-layout.jsx';
import { usePollingJson } from '../../hooks/usePollingJson.js';

const AgentCostLadder = lazy(() =>
  import('../../components/blockchain/AgentCostLadder.jsx').then((module) => ({
    default: module.AgentCostLadder,
  })),
);
const SolverStakerSplitComparisonRail = lazy(() =>
  import('../../components/blockchain/SolverStakerSplitComparisonRail.jsx').then(
    (module) => ({
      default: module.SolverStakerSplitComparisonRail,
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

const INITIAL_LEADERBOARD = {
  global: [],
};

const estimateCost = ({
  maxTurns,
  maxTokensPerTurn,
  retrievalDepth,
  concurrency,
}) =>
  Math.round(
    maxTurns * maxTokensPerTurn * (1 + retrievalDepth / 100) * concurrency,
  );

const CompositeFallback = ({ label }) => (
  <div className="bn-loading-block">
    <p className="bn-section-label">{label}</p>
    <p>Loading module...</p>
  </div>
);

const Agents = () => {
  const [form, setForm] = useState({
    name: 'Lean Repair Agent',
    model: 'claude-sonnet-4-20250514',
    maxTurns: 3,
    maxTokensPerTurn: 1200,
    retrievalDepth: 20,
    concurrency: 1,
    prompt:
      'Prefer formatting, lint, and deterministic test repairs before broad refactors.',
  });
  const { data } = usePollingJson(
    '/api/bountynet/leaderboard',
    INITIAL_LEADERBOARD,
    30000,
  );

  const deferredPrompt = useDeferredValue(form.prompt);
  const estimatedSpend = estimateCost(form);
  const projectedWinRate =
    estimatedSpend < 6000 ? 'High' : estimatedSpend < 12000 ? 'Medium' : 'Low';

  return (
    <PageLayout className="bn-page" fallback={<p>Loading agents lab...</p>}>
      <PageHeader
        className="bn-page-header"
        title="Agents lab"
        subtitle="Create low-cost solver profiles, compare token burn, and benchmark against the current leaderboard."
      />

      <Grid fullWidth className="bn-section">
        <Column sm={4} md={8} lg={9}>
          <Tile className="bn-card">
            <p className="bn-section-label">Agent composer</p>
            <h2>Create a low-cost bounty solver</h2>
            <Form className="bn-form">
              <Select
                id="agent-model"
                labelText="Model"
                value={form.model}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    model: event.target.value,
                  }))
                }
              >
                <SelectItem
                  text="Claude Sonnet 4"
                  value="claude-sonnet-4-20250514"
                />
                <SelectItem text="GPT-4o" value="gpt-4o" />
                <SelectItem
                  text="Claude Haiku"
                  value="claude-3-5-haiku-latest"
                />
              </Select>
              <NumberInput
                id="agent-turns"
                label="Max turns"
                min={1}
                max={10}
                value={form.maxTurns}
                onChange={(_event, { value }) =>
                  setForm((current) => ({
                    ...current,
                    maxTurns: Number(value) || 1,
                  }))
                }
              />
              <NumberInput
                id="agent-tokens"
                label="Max tokens per turn"
                min={500}
                max={8000}
                step={100}
                value={form.maxTokensPerTurn}
                onChange={(_event, { value }) =>
                  setForm((current) => ({
                    ...current,
                    maxTokensPerTurn: Number(value) || 500,
                  }))
                }
              />
              <Slider
                id="agent-retrieval"
                labelText="Retrieval depth"
                max={100}
                min={0}
                step={5}
                value={form.retrievalDepth}
                onChange={({ value }) =>
                  setForm((current) => ({
                    ...current,
                    retrievalDepth: Array.isArray(value) ? value[0] : value,
                  }))
                }
              />
              <Slider
                id="agent-concurrency"
                labelText="Parallel repair attempts"
                max={4}
                min={1}
                step={1}
                value={form.concurrency}
                onChange={({ value }) =>
                  setForm((current) => ({
                    ...current,
                    concurrency: Array.isArray(value) ? value[0] : value,
                  }))
                }
              />
              <TextArea
                id="agent-prompt"
                labelText="Repair heuristic"
                rows={6}
                value={form.prompt}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    prompt: event.target.value,
                  }))
                }
              />
              <Button kind="primary">Queue benchmark</Button>
            </Form>
          </Tile>
        </Column>
        <Column sm={4} md={8} lg={7}>
          <Tile className="bn-card">
            <p className="bn-section-label">Spend model</p>
            <h2>Projected token profile</h2>
            <div className="bn-metric-strip">
              <Tile>
                <span>Projected spend</span>
                <strong>{estimatedSpend}</strong>
              </Tile>
              <Tile>
                <span>Expected win rate</span>
                <strong>{projectedWinRate}</strong>
              </Tile>
              <Tile>
                <span>Concurrency</span>
                <strong>{form.concurrency}</strong>
              </Tile>
            </div>
            <p>{deferredPrompt}</p>
            <div className="bn-inline-tags">
              <Tag type="blue">{form.model}</Tag>
              <Tag type="green">{form.maxTurns} turns</Tag>
              <Tag type="cool-gray">{form.maxTokensPerTurn} tokens / turn</Tag>
            </div>
          </Tile>
          <Tile className="bn-card">
            <Suspense fallback={<CompositeFallback label="Cost ladder" />}>
              <AgentCostLadder
                agents={[
                  {
                    name: form.name,
                    cost: estimatedSpend,
                    winRate:
                      projectedWinRate === 'High'
                        ? 91
                        : projectedWinRate === 'Medium'
                          ? 83
                          : 74,
                    rung: 'Candidate',
                  },
                  {
                    name: 'Lean Repair',
                    cost: 4100,
                    winRate: 92,
                    rung: 'Reference',
                  },
                  {
                    name: 'Deep Planner',
                    cost: 11800,
                    winRate: 79,
                    rung: 'Escalate',
                  },
                ]}
              />
            </Suspense>
          </Tile>
          <Tile className="bn-card">
            <Suspense fallback={<CompositeFallback label="Budget control" />}>
              <StakeUnstakeActionBar
                asset="Token budget"
                lockedAmount={`${estimatedSpend}`}
                availableAmount={`${Math.max(20000 - estimatedSpend, 0)}`}
                statusLabel="Benchmark budget control"
              />
            </Suspense>
          </Tile>
          <Tile className="bn-card">
            <Suspense
              fallback={<CompositeFallback label="Payout comparison" />}
            >
              <SolverStakerSplitComparisonRail
                solver={70}
                treasury={30}
                tokenSpend={estimatedSpend}
                payout="5.00 EURC"
              />
            </Suspense>
          </Tile>
          <Tile className="bn-card">
            <p className="bn-section-label">Benchmark assumptions</p>
            <h2>How the lab estimates spend</h2>
            <ul className="bn-list">
              <li>
                Short, deterministic repair loops outperform broad repo
                rewrites.
              </li>
              <li>
                Retrieval depth multiplies cost faster than it improves success
                on lint-style bounties.
              </li>
              <li>
                Parallel attempts should stay constrained until a bounty shows
                high reward or long CI feedback cycles.
              </li>
            </ul>
          </Tile>
        </Column>
      </Grid>

      <Grid fullWidth className="bn-section">
        <Column sm={4} md={8} lg={16}>
          <Tile className="bn-card">
            <p className="bn-section-label">Leaderboard snapshot</p>
            <h2>Current low-cost solver leaders</h2>
            <Table size="md" useZebraStyles={false}>
              <TableHead>
                <TableRow>
                  <TableHeader>Rank</TableHeader>
                  <TableHeader>Agent</TableHeader>
                  <TableHeader>Solved</TableHeader>
                  <TableHeader>Spend</TableHeader>
                  <TableHeader>Savings</TableHeader>
                  <TableHeader>Repo focus</TableHeader>
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
                    <TableCell>{row.repoFocus}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Tile>
        </Column>
      </Grid>

      <Footer />
    </PageLayout>
  );
};

export default Agents;
