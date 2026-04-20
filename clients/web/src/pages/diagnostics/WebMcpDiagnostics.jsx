/**
 * Copyright IBM Corp. 2025, 2026
 *
 * WebMCP diagnostics — status strip, tool registry, last-call inspector,
 * and journey manifest.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { PageLayout } from '../../layouts/page-layout.jsx';
import {
  AnimatedNumber,
  Button,
  Chip,
  EmptyState,
  Panel,
  StatusDot,
  Terminal,
} from '../../components/cs16/index.js';
import { getWebMcpDiagnostics } from '../../webmcp/registerTools.js';

const INITIAL_JOURNEYS = { kind: '', journeys: {} };

const WebMcpDiagnostics = () => {
  const [diag, setDiag] = useState(getWebMcpDiagnostics());
  const [journeys, setJourneys] = useState(INITIAL_JOURNEYS);
  const [journeyError, setJourneyError] = useState('');
  const [probe, setProbe] = useState('');

  useEffect(() => {
    const timer = window.setInterval(() => {
      setDiag(getWebMcpDiagnostics());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    fetch('/api/bountynet/webmcp/journeys', {
      headers: { accept: 'application/json' },
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok)
          throw new Error(
            payload.error || `journey fetch failed (${response.status})`,
          );
        setJourneys(payload);
      })
      .catch((error) =>
        setJourneyError(error instanceof Error ? error.message : String(error)),
      );
  }, []);

  const tools = diag.registeredTools || [];
  const toolCount = tools.length;

  const grouped = useMemo(() => {
    const map = new Map();
    for (const tool of tools) {
      const letter = String(tool).charAt(0).toUpperCase() || '#';
      if (!map.has(letter)) map.set(letter, []);
      map.get(letter).push(tool);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [tools]);

  const probeTool = (tool) => {
    setProbe(
      JSON.stringify(
        {
          tool,
          at: new Date().toISOString(),
          note: 'probe request recorded locally — actual tool invocation happens via host runtime.',
        },
        null,
        2,
      ),
    );
  };

  return (
    <PageLayout fallback={<div className="bn-empty">Loading diagnostics…</div>}>
      <div style={{ display: 'grid', gap: 20 }}>
        <Panel
          eyebrow="diagnostics"
          title="WebMCP capability and tool telemetry."
          meta={
            <StatusDot
              tone={diag.webmcpAvailable ? 'green' : 'red'}
              pulse={!!diag.webmcpAvailable}
              label={
                diag.webmcpAvailable ? 'webmcp available' : 'webmcp offline'
              }
            />
          }
        >
          <div
            className="bn-row"
            style={{
              gap: 12,
              flexWrap: 'wrap',
              alignItems: 'center',
              padding: '6px 0',
            }}
          >
            <Chip tone={diag.registered ? 'green' : 'yellow'}>
              {diag.registered ? 'registered' : 'pending registration'}
            </Chip>
            <Chip tone="accent">
              tools: <AnimatedNumber value={toolCount} />
            </Chip>
            {diag.initError ? (
              <Chip tone="red">
                init error: {String(diag.initError).slice(0, 64)}
              </Chip>
            ) : (
              <Chip tone="ghost">no init error</Chip>
            )}
            <span className="bn-meta">polling every 1s</span>
          </div>
        </Panel>

        <div
          style={{
            display: 'grid',
            gap: 16,
            gridTemplateColumns:
              'repeat(auto-fit, minmax(min(320px, 100%), 1fr))',
          }}
        >
          <Panel eyebrow="runtime" title="Runtime snapshot">
            <Terminal
              title="runtime"
              content={{
                webmcpAvailable: diag.webmcpAvailable,
                registered: diag.registered,
                initError: diag.initError,
                toolCount,
              }}
            />
          </Panel>

          <Panel
            eyebrow="registry"
            title="Registered tools"
            meta={`${toolCount} total`}
          >
            {toolCount === 0 ? (
              <EmptyState
                icon="terminal"
                title="No tools registered."
                description="Host runtime hasn't advertised any tools yet."
              />
            ) : (
              <div style={{ display: 'grid', gap: 12 }}>
                {grouped.map(([letter, items]) => (
                  <div key={letter} style={{ display: 'grid', gap: 4 }}>
                    <span className="bn-eyebrow">{letter}</span>
                    <div style={{ display: 'grid', gap: 2 }}>
                      {items.map((tool) => (
                        <div
                          key={tool}
                          className="bn-panel"
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'minmax(0, 1fr) auto',
                            alignItems: 'center',
                            gap: 8,
                            padding: '4px 8px',
                          }}
                        >
                          <code
                            style={{ color: 'var(--bn-text)', fontSize: 12 }}
                          >
                            {tool}
                          </code>
                          <Button
                            size="sm"
                            variant="ghost"
                            icon="bolt"
                            onClick={() => probeTool(tool)}
                          >
                            probe
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel eyebrow="activity" title="Last tool call">
            <Terminal
              title="last tool call"
              content={probe || diag.lastCall || {}}
              empty={{ title: 'No calls yet.' }}
            />
          </Panel>
        </div>

        <Panel
          eyebrow="journey manifest"
          title="Automation journey map"
          meta={
            journeyError ? (
              <Chip tone="red">error</Chip>
            ) : (
              <Chip tone="green">loaded</Chip>
            )
          }
        >
          {journeyError ? (
            <EmptyState
              icon="x"
              title="Journey manifest unavailable"
              description={journeyError}
            />
          ) : (
            <Terminal title="manifest" content={journeys} />
          )}
        </Panel>

        <Panel eyebrow="quick actions" title="Related automation surfaces">
          <div className="bn-row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <Button as={Link} to="/onboarding/bob" icon="shield">
              Bob onboarding
            </Button>
            <Button as={Link} to="/onboarding/alice" icon="cpu">
              Alice onboarding
            </Button>
            <Button as={Link} to="/marketplace" icon="bolt">
              Marketplace
            </Button>
            <Button as={Link} to="/inventory" icon="graph">
              Inventory
            </Button>
            <Button as={Link} to="/ops/control-plane" icon="cpu">
              Control plane
            </Button>
          </div>
        </Panel>
      </div>
    </PageLayout>
  );
};

export default WebMcpDiagnostics;
