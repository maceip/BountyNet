import { useEffect, useMemo, useRef, useState } from 'react';
import { PageLayout } from '../../layouts/page-layout.jsx';
import {
  Chat,
  CommitGraph,
  Pane,
  PaneGroup,
  RepoCard,
  Terminal,
} from '../../components/smui/index.jsx';
import {
  addAgentRepoPair,
  appendAgentTrackEvent,
  getAgentTrackState,
} from '../../utils/agentTrackStore.js';
import { consumeVoiceTranscript, getVoiceInbox, pushVoiceTranscript } from '../../utils/voiceInbox.js';

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

  useEffect(() => {
    const updateTrack = (event) => {
      setTrackState(event.detail || getAgentTrackState());
    };
    const updateVoice = (event) => {
      setVoiceState(event.detail || getVoiceInbox());
    };
    window.addEventListener('bn:agent-track-updated', updateTrack);
    window.addEventListener('bn:voice-inbox-updated', updateVoice);
    const transcriptListener = (event) => {
      const text = event.detail?.text;
      if (text) {
        setDraftText((current) => `${current}${current ? '\n' : ''}${text}`);
      }
    };
    window.addEventListener('smui:status-rail-transcript', transcriptListener);
    return () => {
      window.removeEventListener('bn:agent-track-updated', updateTrack);
      window.removeEventListener('bn:voice-inbox-updated', updateVoice);
      window.removeEventListener('smui:status-rail-transcript', transcriptListener);
    };
  }, []);

  useEffect(() => {
    if (!isSimulating) {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
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
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, [isSimulating]);

  useEffect(() => {
    if (pendingVoiceCount === 0) {
      return undefined;
    }
    const consumeTimer = window.setInterval(() => {
      const next = consumeVoiceTranscript();
      if (!next?.text) {
        return;
      }
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
    return () => {
      window.clearInterval(consumeTimer);
    };
  }, [pendingVoiceCount, activeAgent, activeRepo]);

  const addNow = () => {
    const next = addAgentRepoPair('manual');
    setTrackState(next);
  };

  const queueDraft = () => {
    if (!draftText.trim()) {
      return;
    }
    pushVoiceTranscript(draftText, 'agent-track-draft');
    setDraftText('');
    setVoiceState(getVoiceInbox());
  };

  return (
    <PageLayout fallback={<p>Loading agent track...</p>}>
      <section className="mx-auto w-full max-w-6xl px-3 py-6 fold:px-6 desktop:px-8">
        <p className="text-label">agent track</p>
        <h1>voice inbox handoff + rolling supply simulation.</h1>
        <p>
          New agent/repo pairs are generated every random 0.5-3.0 seconds while simulator is
          active. Voice queue entries are consumed and staged for assignment here.
        </p>
      </section>

      <section className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-4 px-3 fold:grid-cols-2 fold:px-6 desktop:px-8">
        <article className="border border-border bg-card p-4">
          <h2 className="text-label">simulator controls</h2>
          <p>Pair cadence: random delay between 500ms and 3000ms.</p>
          <button type="button" onClick={() => setIsSimulating((v) => !v)}>
            {isSimulating ? 'Pause simulator' : 'Resume simulator'}
          </button>
          <button type="button" onClick={addNow}>
            Add pair now
          </button>
          <p>Pending voice items: {pendingVoiceCount}</p>
          <CommitGraph seed={`${pendingVoiceCount}-${agents.length}-${repos.length}`} />
        </article>

        <article className="border border-border bg-card p-4">
          <h2 className="text-label">agent-track text interface</h2>
          <Chat
            title="agent track chat"
            value={draftText}
            onChange={setDraftText}
            onSend={queueDraft}
          />
        </article>
      </section>

      <section className="mx-auto mt-4 w-full max-w-6xl px-3 fold:px-6 desktop:px-8">
        <PaneGroup persistKey="agent-track-three-panes">
          <Pane>
            <article className="border border-border bg-card p-4">
              <h2 className="text-label">agent stream</h2>
              {agents.length === 0 && <p>No agents yet.</p>}
              {agents.slice(0, 16).map((agent) => (
                <article key={agent.id} className="mt-3 border-t border-border pt-3">
                  <p>
                    <strong>{agent.slug}</strong>
                  </p>
                  <p>{agent.status}</p>
                  <p>{agent.at}</p>
                </article>
              ))}
            </article>
          </Pane>
          <Pane>
            <article className="border border-border bg-card p-4">
              <h2 className="text-label">repository stream</h2>
              {repos.length === 0 && <p>No repositories yet.</p>}
              {repos.slice(0, 16).map((repo) => (
                <RepoCard key={repo.id} repo={repo} />
              ))}
            </article>
          </Pane>
          <Pane>
            <article className="border border-border bg-card p-4">
              <h2 className="text-label">assignment log</h2>
              {events.length === 0 && <p>No events yet.</p>}
              <Terminal title="assignments" content={events.slice(0, 16)} />
            </article>
          </Pane>
        </PaneGroup>
      </section>
    </PageLayout>
  );
};

export default AgentTrack;
