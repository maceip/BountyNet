/**
 * Copyright IBM Corp. 2025, 2026
 *
 * Agent track — live simulator pairs, voice inbox handoff, and a text composer
 * that feeds the voice queue.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { PageLayout } from '../../layouts/page-layout.jsx';
import {
  AnimatedNumber,
  Button,
  Chip,
  EmptyState,
  Panel,
  RepoCard,
  Sparkline,
  StatusDot,
  Terminal,
  Textarea,
} from '../../components/cs16/index.js';
import {
  addAgentRepoPair,
  appendAgentTrackEvent,
  getAgentTrackState,
} from '../../utils/agentTrackStore.js';
import {
  consumeVoiceTranscript,
  getVoiceInbox,
  pushVoiceTranscript,
} from '../../utils/voiceInbox.js';

const randomDelayMs = () => Math.floor(500 + Math.random() * 2500);

const AgentTrack = () => {
  const [trackState, setTrackState] = useState(() => getAgentTrackState());
  const [voiceState, setVoiceState] = useState(() => getVoiceInbox());
  const [isSimulating, setIsSimulating] = useState(true);
  const [draftText, setDraftText] = useState('');
  const timerRef = useRef(null);

  const pendingVoiceCount = voiceState.pending.length;
  const agents = trackState.agents.slice().reverse();
  const repos = trackState.repos.slice().reverse();
  const events = trackState.events.slice().reverse();

  const activeAgent = useMemo(() => agents[0] || null, [agents]);
  const activeRepo = useMemo(() => repos[0] || null, [repos]);

  const pulseSpark = useMemo(() => {
    const base = [
      pendingVoiceCount,
      agents.length,
      repos.length,
      events.length,
    ];
    return Array.from({ length: 14 }, (_, i) => {
      const pick = base[i % base.length];
      const wobble = Math.sin((i + 1) * 0.7) * 2;
      return Math.max(0, pick + wobble + i * 0.15);
    });
  }, [pendingVoiceCount, agents.length, repos.length, events.length]);

  useEffect(() => {
    const updateTrack = (event) => {
      setTrackState(event.detail || getAgentTrackState());
    };
    const updateVoice = (event) => {
      setVoiceState(event.detail || getVoiceInbox());
    };
    const transcriptListener = (event) => {
      const text = event.detail?.text;
      if (text) {
        setDraftText((current) => `${current}${current ? '\n' : ''}${text}`);
      }
    };
    window.addEventListener('bn:agent-track-updated', updateTrack);
    window.addEventListener('bn:voice-inbox-updated', updateVoice);
    window.addEventListener('smui:status-rail-transcript', transcriptListener);
    return () => {
      window.removeEventListener('bn:agent-track-updated', updateTrack);
      window.removeEventListener('bn:voice-inbox-updated', updateVoice);
      window.removeEventListener(
        'smui:status-rail-transcript',
        transcriptListener,
      );
    };
  }, []);

  useEffect(() => {
    if (!isSimulating) {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      return undefined;
    }
    const schedule = () => {
      const delay = randomDelayMs();
      timerRef.current = window.setTimeout(() => {
        const next = addAgentRepoPair('random-delay');
        setTrackState(next);
        schedule();
      }, delay);
    };
    schedule();
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [isSimulating]);

  useEffect(() => {
    if (pendingVoiceCount === 0) return undefined;
    const consumeTimer = window.setInterval(() => {
      const next = consumeVoiceTranscript();
      if (!next?.text) return;
      const assignedAgent = activeAgent?.slug || 'unassigned-agent';
      const assignedRepo = activeRepo?.repo_full_name || 'unassigned-repo';
      setDraftText((current) => `${current}${current ? '\n' : ''}${next.text}`);
      const updated = appendAgentTrackEvent(
        'voice_handoff',
        `Queued text assigned to ${assignedAgent} on ${assignedRepo}`,
        'voice-inbox',
      );
      setTrackState(updated);
      setVoiceState(getVoiceInbox());
    }, 1200);
    return () => window.clearInterval(consumeTimer);
  }, [pendingVoiceCount, activeAgent, activeRepo]);

  const addNow = () => {
    const next = addAgentRepoPair('manual');
    setTrackState(next);
  };

  const queueDraft = () => {
    if (!draftText.trim()) return;
    pushVoiceTranscript(draftText, 'agent-track-chat');
    setDraftText('');
    setVoiceState(getVoiceInbox());
  };

  return (
    <PageLayout fallback={<div className="bn-empty">Loading agent track…</div>}>
      <div style={{ display: 'grid', gap: 20 }}>
        <Panel
          eyebrow="pulse"
          title="Live supply stream + voice inbox handoff."
          meta={
            <StatusDot
              tone={isSimulating ? 'green' : 'yellow'}
              pulse={isSimulating}
              label={isSimulating ? 'simulator running' : 'simulator paused'}
            />
          }
          actions={
            <>
              <Button
                size="sm"
                icon={isSimulating ? 'minus' : 'bolt'}
                onClick={() => setIsSimulating((v) => !v)}
              >
                {isSimulating ? 'Pause' : 'Resume'}
              </Button>
              <Button size="sm" variant="primary" icon="plus" onClick={addNow}>
                Add pair now
              </Button>
            </>
          }
        >
          <div
            className="bn-row"
            style={{ gap: 14, flexWrap: 'wrap', alignItems: 'center' }}
          >
            <Chip tone="accent">
              pending voice <AnimatedNumber value={pendingVoiceCount} />
            </Chip>
            <Chip tone="green">
              agents <AnimatedNumber value={agents.length} />
            </Chip>
            <Chip tone="purple">
              repos <AnimatedNumber value={repos.length} />
            </Chip>
            <Chip tone="yellow">
              events <AnimatedNumber value={events.length} />
            </Chip>
            <div style={{ marginLeft: 'auto' }}>
              <Sparkline values={pulseSpark} width={220} height={40} />
            </div>
          </div>
        </Panel>

        <div
          style={{
            display: 'grid',
            gap: 16,
            gridTemplateColumns:
              'repeat(auto-fit, minmax(min(300px, 100%), 1fr))',
          }}
        >
          <Panel
            eyebrow="agents"
            title="Agent stream"
            meta={`${agents.length} total`}
          >
            {agents.length === 0 ? (
              <EmptyState
                icon="cpu"
                title="No agents yet."
                description="Resume the simulator or add a pair."
              />
            ) : (
              <div style={{ display: 'grid', gap: 6 }}>
                {agents.slice(0, 16).map((agent) => (
                  <div
                    key={agent.id}
                    className="bn-panel"
                    style={{ display: 'grid', gap: 2, padding: '8px 10px' }}
                  >
                    <div
                      className="bn-row"
                      style={{ justifyContent: 'space-between', gap: 8 }}
                    >
                      <strong
                        style={{
                          color: 'var(--bn-text)',
                          fontFamily: 'var(--bn-font-display)',
                          fontSize: 13,
                        }}
                      >
                        {agent.slug}
                      </strong>
                      <Chip
                        tone={agent.status === 'active' ? 'green' : 'ghost'}
                      >
                        {agent.status}
                      </Chip>
                    </div>
                    <span className="bn-meta">{agent.at}</span>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel
            eyebrow="repos"
            title="Repository stream"
            meta={`${repos.length} total`}
          >
            {repos.length === 0 ? (
              <EmptyState icon="repo" title="No repositories yet." />
            ) : (
              <div style={{ display: 'grid', gap: 8 }}>
                {repos.slice(0, 12).map((repo) => {
                  const [owner, name] = (repo.repo_full_name || '/').split('/');
                  return (
                    <RepoCard
                      key={repo.id}
                      owner={owner}
                      repo={name}
                      description={`Tracked ${repo.at}`}
                      language="TypeScript"
                      stars={0}
                      forks={0}
                      visibility="Tracked"
                      topics={[repo.status || 'tracked']}
                    />
                  );
                })}
              </div>
            )}
          </Panel>

          <Panel
            eyebrow="events"
            title="Assignment log"
            meta={`${events.length} total`}
          >
            {events.length === 0 ? (
              <EmptyState icon="terminal" title="No events yet." />
            ) : (
              <Terminal
                title="assignments"
                content={events.slice(0, 16)}
                maxHeight={340}
              />
            )}
          </Panel>
        </div>

        <Panel
          eyebrow="agent-track chat"
          title="Text interface"
          meta={<Chip tone="ghost">dispatches via pushVoiceTranscript</Chip>}
        >
          <div style={{ display: 'grid', gap: 10 }}>
            <Textarea
              value={draftText}
              onChange={(event) => setDraftText(event.target.value)}
              placeholder="Type an instruction for the active agent/repo pair — or dictate via the status rail mic…"
              rows={4}
            />
            <div className="bn-row" style={{ gap: 8 }}>
              <Button
                variant="primary"
                icon="mic"
                onClick={queueDraft}
                disabled={!draftText.trim()}
              >
                Send to voice queue
              </Button>
              <Button
                variant="ghost"
                icon="x"
                onClick={() => setDraftText('')}
                disabled={!draftText}
              >
                Clear
              </Button>
              <span className="bn-meta" style={{ marginLeft: 'auto' }}>
                active agent: {activeAgent?.slug || '—'} · repo:{' '}
                {activeRepo?.repo_full_name || '—'}
              </span>
            </div>
          </div>
        </Panel>
      </div>
    </PageLayout>
  );
};

export default AgentTrack;
