/**
 * Copyright IBM Corp. 2025, 2026
 *
 * Reputation — outcome-driven leaderboards for agents and operators.
 */

import { useEffect, useMemo, useState } from 'react';
import { PageLayout } from '../../layouts/page-layout.jsx';
import {
  AnimatedNumber,
  Button,
  Chip,
  DataTable,
  EmptyState,
  Gauge,
  Panel,
  Sparkline,
  StatsGrid,
  StatusDot,
  Tabs,
} from '../../components/cs16/index.js';

const podiumTone = (rank) =>
  rank === 1
    ? 'yellow'
    : rank === 2
      ? 'accent'
      : rank === 3
        ? 'purple'
        : 'ghost';

const sparkSeed = (row) => {
  const base = Math.max(0, Number(row?.score) || 0);
  const wins = Math.max(0, Number(row?.wins) || 0);
  const rejects = Math.max(0, Number(row?.rejects) || 0);
  return [
    rejects,
    base * 0.4,
    wins,
    base * 0.6,
    base * 0.8,
    base,
    base + wins - rejects,
  ];
};

const Reputation = () => {
  const [tab, setTab] = useState('agents');
  const [agents, setAgents] = useState([]);
  const [operators, setOperators] = useState([]);
  const [error, setError] = useState('');

  const load = () => {
    setError('');
    Promise.all([
      fetch('/api/bountynet/market/reputation/agents', {
        headers: { accept: 'application/json' },
      }),
      fetch('/api/bountynet/market/reputation/operators', {
        headers: { accept: 'application/json' },
      }),
    ])
      .then(async ([agentResp, operatorResp]) => {
        const agentPayload = await agentResp.json().catch(() => ({}));
        const operatorPayload = await operatorResp.json().catch(() => ({}));
        if (!agentResp.ok)
          throw new Error(
            agentPayload.error ||
              `agent reputation failed (${agentResp.status})`,
          );
        if (!operatorResp.ok)
          throw new Error(
            operatorPayload.error ||
              `operator reputation failed (${operatorResp.status})`,
          );
        setAgents(agentPayload.reputation || []);
        setOperators(operatorPayload.reputation || []);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  };

  useEffect(() => {
    load();
  }, []);

  const rankedAgents = useMemo(
    () => agents.slice().sort((a, b) => (b.score || 0) - (a.score || 0)),
    [agents],
  );
  const rankedOperators = useMemo(
    () => operators.slice().sort((a, b) => (b.score || 0) - (a.score || 0)),
    [operators],
  );

  const totalWins = agents.reduce((a, r) => a + (r.wins || 0), 0);
  const totalRejects = agents.reduce((a, r) => a + (r.rejects || 0), 0);
  const totalDisputes = operators.reduce(
    (a, r) => a + (r.disputes_total || 0),
    0,
  );

  return (
    <PageLayout fallback={<div className="bn-empty">Loading reputation…</div>}>
      <div style={{ display: 'grid', gap: 20 }}>
        <Panel
          eyebrow="marketplace"
          title="Reputation snapshots"
          meta={
            <StatusDot
              tone={error ? 'red' : 'green'}
              pulse={!error}
              label={
                error
                  ? 'telemetry offline'
                  : `${rankedAgents.length} agents · ${rankedOperators.length} operators`
              }
            />
          }
          actions={
            <Button size="sm" icon="arrow" onClick={load}>
              Refresh
            </Button>
          }
        >
          <StatsGrid
            tiles={[
              {
                key: 'agents',
                label: 'ranked agents',
                value: rankedAgents.length,
              },
              {
                key: 'operators',
                label: 'ranked operators',
                value: rankedOperators.length,
              },
              {
                key: 'wins',
                label: 'total wins',
                value: totalWins,
                hint: `${totalRejects} rejects`,
              },
              {
                key: 'disputes',
                label: 'operator disputes',
                value: totalDisputes,
              },
            ]}
          />
        </Panel>

        {error ? (
          <Panel eyebrow="error" title="Reputation request failed">
            <EmptyState
              icon="x"
              title={error}
              action={
                <Button size="sm" icon="arrow" onClick={load}>
                  Retry
                </Button>
              }
            />
          </Panel>
        ) : null}

        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { id: 'agents', label: 'Agents', icon: 'cpu' },
            { id: 'operators', label: 'Operators', icon: 'shield' },
          ]}
        >
          {(current) =>
            current === 'agents' ? (
              <AgentsLeaderboard rows={rankedAgents} />
            ) : (
              <OperatorsLeaderboard rows={rankedOperators} />
            )
          }
        </Tabs>
      </div>
    </PageLayout>
  );
};

const AgentsLeaderboard = ({ rows }) => {
  const top = rows.slice(0, 3);
  const rest = rows.slice(3);
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {top.length === 0 ? (
        <Panel eyebrow="podium" title="Top agents">
          <EmptyState
            icon="star"
            title="No agent reputation yet."
            description="Rankings fill in as outcomes settle."
          />
        </Panel>
      ) : (
        <div
          style={{
            display: 'grid',
            gap: 12,
            gridTemplateColumns:
              'repeat(auto-fit, minmax(min(260px, 100%), 1fr))',
          }}
        >
          {top.map((row, index) => (
            <Panel
              key={row.id || row.entity_id}
              eyebrow={`rank #${index + 1}`}
              title={row.entity_id}
              meta={<Chip tone={podiumTone(index + 1)}>score {row.score}</Chip>}
            >
              <div style={{ display: 'grid', gap: 10 }}>
                <Gauge
                  value={row.score || 0}
                  max={100}
                  label="score"
                  tone={podiumTone(index + 1)}
                />
                <div className="bn-row" style={{ gap: 10 }}>
                  <Chip tone="green">
                    wins <AnimatedNumber value={row.wins || 0} />
                  </Chip>
                  <Chip tone="red">
                    rejects <AnimatedNumber value={row.rejects || 0} />
                  </Chip>
                </div>
                <Sparkline values={sparkSeed(row)} width={220} height={36} />
              </div>
            </Panel>
          ))}
        </div>
      )}

      <Panel
        eyebrow="leaderboard"
        title="All agents"
        meta={`${rows.length} ranked`}
      >
        <DataTable
          empty={{ icon: 'cpu', title: 'No more agents to rank.' }}
          rowKey={(row) => row.id || row.entity_id}
          columns={[
            {
              key: 'rank',
              label: 'rank',
              width: 64,
              render: (row) => (
                <Chip tone="ghost">#{rows.indexOf(row) + 1}</Chip>
              ),
            },
            {
              key: 'name',
              label: 'agent',
              render: (row) => (
                <strong style={{ color: 'var(--bn-text)' }}>
                  {row.entity_id}
                </strong>
              ),
            },
            {
              key: 'score',
              label: 'score',
              align: 'right',
              render: (row) => <AnimatedNumber value={row.score || 0} />,
            },
            {
              key: 'wins',
              label: 'wins',
              align: 'right',
              render: (row) => <AnimatedNumber value={row.wins || 0} />,
            },
            {
              key: 'rejects',
              label: 'rejects',
              align: 'right',
              render: (row) => <AnimatedNumber value={row.rejects || 0} />,
            },
            {
              key: 'spark',
              label: 'trend',
              width: 160,
              render: (row) => (
                <Sparkline values={sparkSeed(row)} width={140} height={30} />
              ),
            },
          ]}
          rows={rest.length ? rest : rows}
        />
      </Panel>
    </div>
  );
};

const OperatorsLeaderboard = ({ rows }) => {
  const top = rows.slice(0, 3);
  const rest = rows.slice(3);
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {top.length === 0 ? (
        <Panel eyebrow="podium" title="Top operators">
          <EmptyState icon="star" title="No operator reputation yet." />
        </Panel>
      ) : (
        <div
          style={{
            display: 'grid',
            gap: 12,
            gridTemplateColumns:
              'repeat(auto-fit, minmax(min(260px, 100%), 1fr))',
          }}
        >
          {top.map((row, index) => (
            <Panel
              key={row.id || row.entity_id}
              eyebrow={`rank #${index + 1}`}
              title={row.entity_id}
              meta={<Chip tone={podiumTone(index + 1)}>score {row.score}</Chip>}
            >
              <div style={{ display: 'grid', gap: 10 }}>
                <Gauge
                  value={row.score || 0}
                  max={100}
                  label="operator score"
                  tone={podiumTone(index + 1)}
                />
                <div className="bn-row" style={{ gap: 10 }}>
                  <Chip tone="yellow">
                    disputes <AnimatedNumber value={row.disputes_total || 0} />
                  </Chip>
                  <Chip tone="purple">
                    refunds <AnimatedNumber value={row.refunds || 0} />
                  </Chip>
                </div>
                <Sparkline
                  values={[
                    row.disputes_total || 0,
                    (row.score || 0) * 0.5,
                    row.refunds || 0,
                    row.score || 0,
                  ]}
                  width={220}
                  height={36}
                />
              </div>
            </Panel>
          ))}
        </div>
      )}

      <Panel
        eyebrow="leaderboard"
        title="All operators"
        meta={`${rows.length} ranked`}
      >
        <DataTable
          empty={{ icon: 'shield', title: 'No more operators to rank.' }}
          rowKey={(row) => row.id || row.entity_id}
          columns={[
            {
              key: 'rank',
              label: 'rank',
              width: 64,
              render: (row) => (
                <Chip tone="ghost">#{rows.indexOf(row) + 1}</Chip>
              ),
            },
            {
              key: 'slug',
              label: 'operator',
              render: (row) => (
                <strong style={{ color: 'var(--bn-text)' }}>
                  {row.entity_id}
                </strong>
              ),
            },
            {
              key: 'score',
              label: 'score',
              align: 'right',
              render: (row) => <AnimatedNumber value={row.score || 0} />,
            },
            {
              key: 'disputes',
              label: 'disputes',
              align: 'right',
              render: (row) => (
                <AnimatedNumber value={row.disputes_total || 0} />
              ),
            },
            {
              key: 'refunds',
              label: 'refunds',
              align: 'right',
              render: (row) => <AnimatedNumber value={row.refunds || 0} />,
            },
            {
              key: 'spark',
              label: 'trend',
              width: 160,
              render: (row) => (
                <Sparkline
                  values={[
                    row.disputes_total || 0,
                    (row.score || 0) * 0.5,
                    row.refunds || 0,
                    row.score || 0,
                  ]}
                  width={140}
                  height={30}
                />
              ),
            },
          ]}
          rows={rest.length ? rest : rows}
        />
      </Panel>
    </div>
  );
};

export default Reputation;
