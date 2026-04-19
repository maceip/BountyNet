import { useEffect, useMemo, useRef, useState } from 'react';
import { PageLayout } from '../../layouts/page-layout.jsx';
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

  useEffect(() => {
    const updateTrack = (event) => {
      setTrackState(event.detail || getAgentTrackState());
    };
    const updateVoice = (event) => {
      setVoiceState(event.detail || getVoiceInbox());
    };
    window.addEventListener('bn:agent-track-updated', updateTrack);
    window.addEventListener('bn:voice-inbox-updated', updateVoice);
    return () => {
      window.removeEventListener('bn:agent-track-updated', updateTrack);
      window.removeEventListener('bn:voice-inbox-updated', updateVoice);
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
      <section className="bn-landing-hero">
        <p className="bn-eyebrow">Agent Track</p>
        <h1>Voice inbox handoff + rolling supply simulation.</h1>
        <p>
          New agent/repo pairs are generated every random 0.5-3.0 seconds while simulator is
          active. Voice queue entries are consumed and staged for assignment here.
        </p>
      </section>

      <section className="bn-market-grid">
        <article className="bn-market-card">
          <h2>Simulator controls</h2>
          <p>Pair cadence: random delay between 500ms and 3000ms.</p>
          <button type="button" onClick={() => setIsSimulating((v) => !v)}>
            {isSimulating ? 'Pause simulator' : 'Resume simulator'}
          </button>
          <button type="button" onClick={addNow}>
            Add pair now
          </button>
          <p>Pending voice items: {pendingVoiceCount}</p>
        </article>

        <article className="bn-market-card">
          <h2>Agent-track text interface</h2>
          <label htmlFor="agent-track-draft">Draft text</label>
          <textarea
            id="agent-track-draft"
            rows={8}
            value={draftText}
            onChange={(event) => setDraftText(event.target.value)}
            placeholder="Voice items auto-append here when no input was selected."
          />
          <button type="button" onClick={queueDraft}>
            Return draft to voice inbox
          </button>
        </article>
      </section>

      <section className="bn-market-grid">
        <article className="bn-market-card">
          <h2>Agent stream</h2>
          {agents.length === 0 && <p>No agents yet.</p>}
          {agents.slice(0, 16).map((agent) => (
            <article key={agent.id} className="bn-market-job">
              <p>
                <strong>{agent.slug}</strong>
              </p>
              <p>{agent.status}</p>
              <p>{agent.at}</p>
            </article>
          ))}
        </article>
        <article className="bn-market-card">
          <h2>Repository stream</h2>
          {repos.length === 0 && <p>No repositories yet.</p>}
          {repos.slice(0, 16).map((repo) => (
            <article key={repo.id} className="bn-market-job">
              <p>
                <strong>{repo.repo_full_name}</strong>
              </p>
              <p>{repo.status}</p>
              <p>{repo.at}</p>
            </article>
          ))}
        </article>
        <article className="bn-market-card">
          <h2>Assignment log</h2>
          {events.length === 0 && <p>No events yet.</p>}
          {events.slice(0, 16).map((event) => (
            <article key={event.id} className="bn-market-job">
              <p>
                <strong>{event.kind}</strong>
              </p>
              <p>{event.detail}</p>
              <p>
                {event.source} - {event.at}
              </p>
            </article>
          ))}
        </article>
      </section>
    </PageLayout>
  );
};

export default AgentTrack;
