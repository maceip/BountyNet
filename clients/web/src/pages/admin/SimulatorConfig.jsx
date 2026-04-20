/**
 * Copyright IBM Corp. 2025, 2026
 *
 * Simulator config — inspect the journey manifest with persona filter and
 * explain local dev commands.
 */

import { useEffect, useMemo, useState } from 'react';
import { PageLayout } from '../../layouts/page-layout.jsx';
import {
  Button,
  Chip,
  CodeLine,
  EmptyState,
  Field,
  Panel,
  PopoverCommandSelect,
  StatusDot,
  Terminal,
} from '../../components/cs16/index.js';

const PERSONAS = [
  { value: 'all', label: 'all personas', icon: 'globe' },
  { value: 'bob', label: 'bob', icon: 'shield' },
  { value: 'alice', label: 'alice', icon: 'cpu' },
  { value: 'admin', label: 'admin', icon: 'shield' },
];

const COMMANDS = [
  {
    cmd: 'npm run dev:full',
    explain:
      'Boot the full-stack dev server: API, MCP proxy, simulator tick loop, and the Vite web client together.',
  },
  {
    cmd: 'npm run dev:test:webmcp',
    explain:
      'Runs the WebMCP coverage suite against the running dev server — validates every registered tool is reachable.',
  },
  {
    cmd: 'npm run dev:test:full',
    explain:
      'Full simulator + WebMCP journey eval. Walks Bob, Alice, and admin personas end-to-end and prints reports.',
  },
];

const SimulatorConfig = () => {
  const [journeys, setJourneys] = useState({});
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');
  const [persona, setPersona] = useState('all');

  useEffect(() => {
    fetch('/api/bountynet/webmcp/journeys', {
      headers: { accept: 'application/json' },
    })
      .then(async (resp) => {
        const payload = await resp.json().catch(() => ({}));
        if (!resp.ok)
          throw new Error(
            payload.error || `journey load failed (${resp.status})`,
          );
        setJourneys(payload);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  const filteredManifest = useMemo(() => {
    if (persona === 'all') return journeys;
    const raw = journeys?.journeys;
    if (!raw || typeof raw !== 'object') return journeys;
    const filtered = {};
    for (const [key, value] of Object.entries(raw)) {
      if (key.toLowerCase().includes(persona)) {
        filtered[key] = value;
      }
    }
    return { ...journeys, journeys: filtered };
  }, [journeys, persona]);

  const explain = (cmd, explainer) => {
    setOutput(
      JSON.stringify(
        {
          command: cmd,
          persona,
          explain: explainer,
          suggestedAt: new Date().toISOString(),
        },
        null,
        2,
      ),
    );
  };

  return (
    <PageLayout
      fallback={<div className="bn-empty">Loading simulator config…</div>}
    >
      <div style={{ display: 'grid', gap: 20 }}>
        <Panel
          eyebrow="simulator"
          title="Simulator configuration and eval alignment"
          meta={
            <StatusDot
              tone={error ? 'red' : 'green'}
              pulse={!error}
              label={error ? 'manifest offline' : 'manifest loaded'}
            />
          }
          actions={<Chip tone="accent">persona: {persona}</Chip>}
        >
          <p className="bn-body">
            Unified surface for configuring simulator journeys and validating
            WebMCP coverage across personas.
          </p>
        </Panel>

        <div
          style={{
            display: 'grid',
            gap: 16,
            gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
          }}
        >
          <Panel
            eyebrow="journey manifest"
            title="Registered journeys"
            actions={
              <div style={{ minWidth: 180 }}>
                <Field label={null} htmlFor="simulator-persona">
                  <PopoverCommandSelect
                    id="simulator-persona"
                    value={persona}
                    onChange={setPersona}
                    options={PERSONAS}
                  />
                </Field>
              </div>
            }
          >
            {error ? (
              <EmptyState
                icon="x"
                title="Journey manifest failed to load"
                description={error}
              />
            ) : (
              <Terminal
                title="journey manifest"
                content={filteredManifest}
                maxHeight={360}
              />
            )}
          </Panel>

          <Panel eyebrow="run commands" title="Local dev harness">
            <div style={{ display: 'grid', gap: 10 }}>
              {COMMANDS.map(({ cmd, explain: hint }) => (
                <button
                  key={cmd}
                  type="button"
                  onClick={() => explain(cmd, hint)}
                  style={{
                    background: 'transparent',
                    border: 0,
                    padding: 0,
                    display: 'grid',
                    gap: 4,
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <CodeLine lang="sh">{cmd}</CodeLine>
                  <span className="bn-meta">click to explain</span>
                </button>
              ))}
              <Button
                variant="ghost"
                icon="arrow"
                onClick={() =>
                  setOutput(
                    JSON.stringify(
                      {
                        hint: 'explore journeys above and click a command to see its scope',
                        persona,
                      },
                      null,
                      2,
                    ),
                  )
                }
              >
                Reset explainer
              </Button>
              <Terminal title="simulator output" content={output || 'idle'} />
            </div>
          </Panel>
        </div>
      </div>
    </PageLayout>
  );
};

export default SimulatorConfig;
