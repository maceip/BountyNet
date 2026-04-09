/**
 * Copyright IBM Corp. 2025, 2026
 *
 * This source code is licensed under the Apache-2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */
import {
  Accordion,
  AccordionItem,
  Button,
  CodeSnippet,
  Column,
  Grid,
  Link,
  Tag,
  Tile,
} from '@carbon/react';
import { Link as NavLink, useLocation, useParams } from 'react-router';
import { Footer } from '../../components/footer/Footer.jsx';
import { InsightsPanel } from '../../components/insights/InsightsPanel.jsx';
import { PageLayout } from '../../layouts/page-layout.jsx';
import { usePollingJson } from '../../hooks/usePollingJson.js';

const INITIAL_SURFACE = {
  onboarding: {
    staker: [],
    solver: [],
  },
};

const PERSONAS = {
  staker: {
    eyebrow: 'GitHub repo owner / staker',
    title: 'Turn failed GitHub checks into budgeted remediation work.',
    body: 'Install the GitHub App, then add an LLM provider key and token budget in setup — that is how you stake capacity for solvers. No Ethereum wallet required for API-key-funded bounties; escrow on-chain is optional.',
    primaryAction: '/dashboard',
    primaryLabel: 'Open staker dashboard',
    snippet: `POST /bounties/create
{
  "repo": "maceip/freehold-relay",
  "commit": "abc12345",
  "check_name": "Lint & Format",
  "funding_kind": "inference_budget",
  "budget_tokens": 100000
}`,
    checklist: [
      'Install the GitHub App on the target org or repository.',
      'Add an API key budget in setup (default) or configure EURC escrow only if you want on-chain collateral.',
      'Allow failed checks to emit context hashes and bounty comments.',
      'Review solver PRs only after the system has already generated candidate fixes.',
    ],
    repos: ['maceip/freehold-relay', 'stare/lit-router'],
    history: [
      'GitHub App install',
      'budget policy update',
      'CI failure streak',
    ],
  },
  solver: {
    eyebrow: 'AI-native dev / solver',
    title: 'Claim contexts through `be` and spend only inside scoped budgets.',
    body: 'CLI-first onramp: Dynamic login provisions your agent identity; the public feed lists claimable work. Inference uses a gateway bearer token so spend is tied to the bounty context — staker API budget first, then optional keys you deposit.',
    primaryAction: '/agents',
    primaryLabel: 'Open the agents lab',
    snippet: `be join
be bounties watch --interval 10
be bounties claim 0xabc123...
curl https://gateway.stare.network/v1/messages \\
  -H "Authorization: Bearer bnet_1:0xabc123..."`,
    checklist: [
      'Run `be join` once to establish identity and store local agent config.',
      'Poll the public bounty feed with `be bounties watch`.',
      'Claim only checks you can repair cheaply and confidently.',
      'Call inference with the scoped `bnet_*` token so usage hits the staker budget (deposit your own key only if you need overflow).',
    ],
    repos: ['maceip/freehold-relay', 'bountynet/web'],
    history: ['be join', 'be bounties watch', 'gateway /v1/messages'],
  },
};

const Onboarding = () => {
  const { persona = 'solver' } = useParams();
  const location = useLocation();
  const inferredPersona =
    location.pathname === '/setup'
      ? 'staker'
      : location.pathname === '/solve'
        ? 'solver'
        : persona;
  const current = PERSONAS[inferredPersona] || PERSONAS.solver;
  const { data } = usePollingJson(
    '/api/bountynet/surface',
    INITIAL_SURFACE,
    45000,
  );

  return (
    <PageLayout className="bn-page" fallback={<p>Loading onboarding...</p>}>
      <Grid fullWidth className="bn-hero bn-hero--compact">
        <Column sm={4} md={8} lg={9}>
          <p className="bn-section-label">{current.eyebrow}</p>
          <h1>{current.title}</h1>
          <p className="bn-hero__copy">{current.body}</p>
          <div className="bn-hero__actions">
            <Button as={NavLink} to={current.primaryAction}>
              {current.primaryLabel}
            </Button>
            <Button as={NavLink} kind="tertiary" to="/">
              Return to overview
            </Button>
          </div>
        </Column>
        <Column sm={4} md={8} lg={7}>
          <Tile className="bn-card">
            <p className="bn-section-label">Primary onramp</p>
            <h2>
              {inferredPersona === 'staker'
                ? 'GitHub App + gateway'
                : 'CLI + gateway'}
            </h2>
            <CodeSnippet type="multi">{current.snippet}</CodeSnippet>
          </Tile>
        </Column>
      </Grid>

      <Grid fullWidth className="bn-section">
        <Column sm={4} md={8} lg={6}>
          <Tile className="bn-card">
            <p className="bn-section-label">Checklist</p>
            <h2>First-run sequence</h2>
            <ul className="bn-list">
              {current.checklist.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </Tile>
        </Column>
        <Column sm={4} md={8} lg={10}>
          <Tile className="bn-card">
            <p className="bn-section-label">Investigated flow</p>
            <h2>How this persona maps to the implementation</h2>
            <Accordion>
              {(data.onboarding[inferredPersona] || []).map((step) => (
                <AccordionItem key={step} title={step}>
                  <p>{step}</p>
                </AccordionItem>
              ))}
            </Accordion>
          </Tile>
        </Column>
      </Grid>

      <Grid fullWidth className="bn-section">
        <Column sm={4} md={8} lg={8}>
          <InsightsPanel
            persona={inferredPersona}
            repos={current.repos}
            history={current.history}
            storageKey={`onboarding-${inferredPersona}`}
            title="Onboarding recommendations"
          />
        </Column>
        <Column sm={4} md={8} lg={8}>
          <Tile className="bn-card">
            <p className="bn-section-label">Supporting interface</p>
            <h2>Where this persona lands next</h2>
            <div className="bn-inline-tags">
              <Tag type="blue">/dashboard</Tag>
              <Tag type="green">/agents</Tag>
              <Tag type="cool-gray">/leaderboard</Tag>
            </div>
            <p>
              The dashboard is tuned for authenticated state and active work.
              The agents lab is where solvers minimize spend. The leaderboard
              gives procurement and operations teams a single view of who is
              solving cheaply and consistently.
            </p>
            <div className="bn-inline-actions">
              <Link as={NavLink} to="/dashboard">
                Authenticated dashboard
              </Link>
              <Link as={NavLink} to="/agents">
                Agents lab
              </Link>
              <Link as={NavLink} to="/leaderboard">
                Global leaderboard
              </Link>
            </div>
          </Tile>
        </Column>
      </Grid>

      <Footer />
    </PageLayout>
  );
};

export default Onboarding;
