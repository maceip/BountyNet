import { useEffect, useMemo, useRef, useState } from 'react';
import './App.css';
import {
  PHASE_DEFINITIONS,
  formatWiringHint,
  getPhaseTerminalLines,
  type PhaseKey,
} from './phase-wiring';
import { getAdapterStatus, invokeAdapter } from './phase-adapters';
import { registerMarketplaceWebMcpTools } from './webmcp';

type RegionalWeights = {
  na_west: number;
  na_east: number;
  eu: number;
  asia: number;
  australia: number;
};

type TrafficFormState = {
  regionalWeights: RegionalWeights;
  changedBy: string;
  notes: string;
};

type RolloutFormState = {
  target:
    | 'base'
    | 'specialist'
    | 'supervisor'
    | 'worker_security'
    | 'worker_vendor_swap'
    | 'worker_recovery'
    | 'edge_gateway'
    | 'tuning_loop';
  revision: string;
  strategy: string;
  requestedBy: string;
};

type ComponentControlFormState = {
  componentId: string;
  action: 'start' | 'stop' | 'restart' | 'scale_up' | 'scale_down' | 'enable' | 'disable';
  requestedBy: string;
  notes: string;
};

type OperatorSnapshot = {
  traffic: null | {
    us_percent: number;
    eu_percent: number;
    regional_weights: RegionalWeights;
    changed_by?: string;
    notes?: string;
    updated_at?: number;
  };
  lastRollout: null | {
    id?: string;
    target?: string;
    revision?: string;
    strategy?: string;
    status?: string;
    requested_by?: string;
  };
  recentRollouts: Array<{
    id?: string;
    target?: string;
    revision?: string;
    strategy?: string;
    status?: string;
  }>;
  drift: null | {
    status?: string;
    module_state?: Record<
      string,
      {
        path?: string;
        present?: boolean;
        terraform_lock_present?: boolean;
        tfvars_present?: boolean;
      }
    >;
    recommended_commands?: string[];
  };
  components: Array<{
    component_id?: string;
    label?: string;
    kind?: string;
    desired_state?: string;
    last_action?: string;
    updated_by?: string;
    notes?: string;
    updated_at?: number;
  }>;
  recentComponentActions: Array<{
    id?: string;
    component_id?: string;
    action?: string;
    requested_by?: string;
    status?: string;
    created_at?: number;
  }>;
};

type RolloutRecord = OperatorSnapshot['recentRollouts'][number];

function App() {
  const [activePhase, setActivePhase] = useState<PhaseKey>('landing');
  const [isAdmin, setIsAdmin] = useState(false);
  const [operatorLogs, setOperatorLogs] = useState<string[]>([]);
  const [webMcpState, setWebMcpState] = useState<'registered' | 'unavailable'>('unavailable');
  const [isOperatorBusy, setIsOperatorBusy] = useState(false);
  const [trafficForm, setTrafficForm] = useState<TrafficFormState>({
    regionalWeights: {
      na_west: 20,
      na_east: 20,
      eu: 30,
      asia: 20,
      australia: 10,
    },
    changedBy: 'operator_panel',
    notes: '',
  });
  const [rolloutForm, setRolloutForm] = useState<RolloutFormState>({
    target: 'specialist',
    revision: '',
    strategy: 'canary',
    requestedBy: 'operator_panel',
  });
  const [componentForm, setComponentForm] = useState<ComponentControlFormState>({
    componentId: 'edge_digitalocean_gateways',
    action: 'restart',
    requestedBy: 'operator_panel',
    notes: '',
  });
  const [operatorSnapshot, setOperatorSnapshot] = useState<OperatorSnapshot>({
    traffic: null,
    lastRollout: null,
    recentRollouts: [],
    drift: null,
    components: [],
    recentComponentActions: [],
  });
  const activePhaseRef = useRef<PhaseKey>(activePhase);
  const isAdminRef = useRef<boolean>(isAdmin);
  const trafficFormRef = useRef<TrafficFormState>(trafficForm);
  const rolloutFormRef = useRef<RolloutFormState>(rolloutForm);
  const componentFormRef = useRef<ComponentControlFormState>(componentForm);
  const activePhaseDef =
    PHASE_DEFINITIONS.find((phase) => phase.key === activePhase) ?? PHASE_DEFINITIONS[0];
  const phaseTerminalLines = [...getPhaseTerminalLines(activePhaseDef), ...operatorLogs.slice(-5)];
  const adminBlocked = Boolean(activePhaseDef.adminOnly && !isAdmin);

  const operatorCardsById = useMemo(() => {
    const operatorPhase = PHASE_DEFINITIONS.find((phase) => phase.key === 'operator');
    return new Map((operatorPhase?.cards ?? []).map((card) => [card.id, card]));
  }, []);
  const regionLabels: Array<{ key: keyof RegionalWeights; label: string }> = [
    { key: 'na_west', label: 'NA West' },
    { key: 'na_east', label: 'NA East' },
    { key: 'eu', label: 'Europe' },
    { key: 'asia', label: 'Asia' },
    { key: 'australia', label: 'Australia' },
  ];
  const fallbackComponentOptions = [
    { value: 'edge_digitalocean_gateways', label: 'DigitalOcean Edge Gateways' },
    { value: 'global_aws_accelerator', label: 'AWS Global Accelerator' },
    { value: 'global_do_dns', label: 'DigitalOcean Global DNS' },
    { value: 'bedrock_supervisor_mistral', label: 'Bedrock Supervisor (Mistral Small 4)' },
    { value: 'bedrock_worker_glm', label: 'Bedrock Worker Pool (GLM 5.1)' },
    { value: 'bedrock_worker_minimax', label: 'Bedrock Worker Pool (MiniMax M2.7)' },
    { value: 'trainium_tuning_loop', label: 'Trainium Tuning Loop (Axolotl qLoRA)' },
  ];
  const componentOptions = operatorSnapshot.components.length
    ? operatorSnapshot.components.map((component) => ({
        value: component.component_id ?? '',
        label: component.label ?? component.component_id ?? 'unknown-component',
      }))
    : fallbackComponentOptions;
  const trafficTotal = useMemo(
    () => Object.values(trafficForm.regionalWeights).reduce((sum, value) => sum + Number(value || 0), 0),
    [trafficForm.regionalWeights]
  );

  function normalizeRegionalWeights(raw: unknown, fallback: RegionalWeights): RegionalWeights {
    if (!raw || typeof raw !== 'object') return fallback;
    const next = raw as Record<string, unknown>;
    return {
      na_west: Number(next.na_west ?? fallback.na_west),
      na_east: Number(next.na_east ?? fallback.na_east),
      eu: Number(next.eu ?? fallback.eu),
      asia: Number(next.asia ?? fallback.asia),
      australia: Number(next.australia ?? fallback.australia),
    };
  }

  function getOperatorPayload(adapterKey: string): unknown {
    if (adapterKey === 'operator.trafficControl') {
      const current = trafficFormRef.current;
      const usPercent =
        Number(current.regionalWeights.na_west || 0) + Number(current.regionalWeights.na_east || 0);
      return {
        regional_weights: current.regionalWeights,
        us_percent: usPercent,
        eu_percent: current.regionalWeights.eu,
        changed_by: current.changedBy,
        notes: current.notes,
      };
    }
    if (adapterKey === 'operator.modelRollout') {
      const current = rolloutFormRef.current;
      return {
        target: current.target,
        revision: current.revision,
        strategy: current.strategy,
        requested_by: current.requestedBy,
      };
    }
    if (adapterKey === 'operator.componentAction') {
      const current = componentFormRef.current;
      return {
        component_id: current.componentId,
        action: current.action,
        requested_by: current.requestedBy,
        notes: current.notes,
      };
    }
    return undefined;
  }

  function syncOperatorStateFromResult(adapterKey: string, result: unknown) {
    if (!result || typeof result !== 'object') return;
    const body = (result as { body?: unknown }).body;
    if (!body || typeof body !== 'object') return;
    const data = body as Record<string, unknown>;

    if (adapterKey === 'operator.servingTopology' && data.traffic && typeof data.traffic === 'object') {
      const traffic = data.traffic as Record<string, unknown>;
      const fallbackWeights = trafficFormRef.current.regionalWeights;
      const nextWeights = normalizeRegionalWeights(traffic.regional_weights, fallbackWeights);
      const nextUs = Number(traffic.us_percent ?? nextWeights.na_west + nextWeights.na_east);
      const nextEu = Number(traffic.eu_percent ?? nextWeights.eu);
      setTrafficForm((prev) => ({
        ...prev,
        regionalWeights: nextWeights,
        changedBy: String(traffic.changed_by ?? prev.changedBy),
        notes: String(traffic.notes ?? prev.notes),
      }));
      setOperatorSnapshot((prev) => ({
        ...prev,
        traffic: {
          us_percent: Number.isFinite(nextUs) ? nextUs : prev.traffic?.us_percent ?? 50,
          eu_percent: Number.isFinite(nextEu) ? nextEu : prev.traffic?.eu_percent ?? 50,
          regional_weights: nextWeights,
          changed_by: String(traffic.changed_by ?? ''),
          notes: String(traffic.notes ?? ''),
          updated_at: Number(traffic.updated_at ?? 0),
        },
        lastRollout:
          data.last_rollout && typeof data.last_rollout === 'object'
            ? (data.last_rollout as OperatorSnapshot['lastRollout'])
            : prev.lastRollout,
        drift:
          data.infra_drift && typeof data.infra_drift === 'object'
            ? (data.infra_drift as OperatorSnapshot['drift'])
            : prev.drift,
        components:
          data.components &&
          typeof data.components === 'object' &&
          Array.isArray((data.components as Record<string, unknown>).components)
            ? ((data.components as Record<string, unknown>).components as OperatorSnapshot['components'])
            : prev.components,
        recentComponentActions:
          data.components &&
          typeof data.components === 'object' &&
          Array.isArray((data.components as Record<string, unknown>).recent_actions)
            ? ((data.components as Record<string, unknown>).recent_actions as OperatorSnapshot['recentComponentActions'])
            : prev.recentComponentActions,
      }));
      return;
    }

    if (adapterKey === 'operator.trafficControl' && data.traffic && typeof data.traffic === 'object') {
      const traffic = data.traffic as Record<string, unknown>;
      const fallbackWeights = trafficFormRef.current.regionalWeights;
      const nextWeights = normalizeRegionalWeights(traffic.regional_weights, fallbackWeights);
      const nextUs = Number(traffic.us_percent ?? nextWeights.na_west + nextWeights.na_east);
      const nextEu = Number(traffic.eu_percent ?? nextWeights.eu);
      setTrafficForm((prev) => ({
        ...prev,
        regionalWeights: nextWeights,
      }));
      setOperatorSnapshot((prev) => ({
        ...prev,
        traffic: {
          us_percent: Number.isFinite(nextUs) ? nextUs : prev.traffic?.us_percent ?? 50,
          eu_percent: Number.isFinite(nextEu) ? nextEu : prev.traffic?.eu_percent ?? 50,
          regional_weights: nextWeights,
          changed_by: String(traffic.changed_by ?? prev.traffic?.changed_by ?? ''),
          notes: String(traffic.notes ?? prev.traffic?.notes ?? ''),
          updated_at: Number(traffic.updated_at ?? prev.traffic?.updated_at ?? 0),
        },
      }));
      return;
    }

    if (adapterKey === 'operator.modelRollout' && data.rollout && typeof data.rollout === 'object') {
      const rollout = data.rollout as RolloutRecord;
      setOperatorSnapshot((prev) => ({
        ...prev,
        lastRollout: rollout,
        recentRollouts: [rollout, ...prev.recentRollouts].slice(0, 5),
      }));
      return;
    }

    if (adapterKey === 'operator.langfuseTraces') {
      setOperatorSnapshot((prev) => ({
        ...prev,
        lastRollout:
          data.last_rollout && typeof data.last_rollout === 'object'
            ? (data.last_rollout as OperatorSnapshot['lastRollout'])
            : prev.lastRollout,
        recentRollouts:
          Array.isArray(data.recent_rollouts)
            ? (data.recent_rollouts as OperatorSnapshot['recentRollouts'])
            : prev.recentRollouts,
      }));
      return;
    }

    if (adapterKey === 'operator.infraDrift') {
      setOperatorSnapshot((prev) => ({
        ...prev,
        drift: data as OperatorSnapshot['drift'],
      }));
      return;
    }

    if (adapterKey === 'operator.componentInventory') {
      setOperatorSnapshot((prev) => ({
        ...prev,
        components: Array.isArray(data.components)
          ? (data.components as OperatorSnapshot['components'])
          : prev.components,
        recentComponentActions: Array.isArray(data.recent_actions)
          ? (data.recent_actions as OperatorSnapshot['recentComponentActions'])
          : prev.recentComponentActions,
      }));
      return;
    }

    if (adapterKey === 'operator.componentAction') {
      if (data.component_state && typeof data.component_state === 'object') {
        const state = data.component_state as Record<string, unknown>;
        setOperatorSnapshot((prev) => ({
          ...prev,
          components: prev.components.map((item) =>
            item.component_id === String(state.component_id ?? '')
              ? {
                  ...item,
                  desired_state: String(state.desired_state ?? item.desired_state ?? ''),
                  last_action: String(state.last_action ?? item.last_action ?? ''),
                  updated_by: String(state.updated_by ?? item.updated_by ?? ''),
                  notes: String(state.notes ?? item.notes ?? ''),
                  updated_at: Number(state.updated_at ?? item.updated_at ?? 0),
                }
              : item
          ),
        }));
      }
    }
  }

  async function handleOperatorAction(
    adapterKey: string,
    endpoint: string,
    method: 'GET' | 'POST',
    payload?: unknown
  ) {
    const result = await invokeAdapter(
      adapterKey,
      { baseUrl: import.meta.env.VITE_GATEWAY_URL ?? '', payload: payload ?? getOperatorPayload(adapterKey) },
      { kind: method === 'GET' ? 'feed' : 'action', method, endpoint, adapterKey }
    );
    syncOperatorStateFromResult(adapterKey, result);
    setOperatorLogs((prev) => [
      ...prev,
      `[OPERATOR] ${adapterKey} -> ${JSON.stringify(result).slice(0, 160)}`,
    ]);
    return result;
  }

  async function runOperatorCardById(cardId: string): Promise<unknown> {
    const card = operatorCardsById.get(cardId);
    if (!card) {
      const missing = { ok: false, error: `Unknown operator card: ${cardId}` };
      setOperatorLogs((prev) => [...prev, `[OPERATOR] ${JSON.stringify(missing)}`]);
      return missing;
    }
    return handleOperatorAction(card.wiring.adapterKey, card.wiring.endpoint, card.wiring.method);
  }

  async function refreshOperatorSnapshot() {
    setIsOperatorBusy(true);
    try {
      await handleOperatorAction('operator.servingTopology', '/ops/serving/topology', 'GET');
      await handleOperatorAction('operator.langfuseTraces', '/ops/observability/langfuse', 'GET');
      await handleOperatorAction('operator.infraDrift', '/ops/infra/drift', 'GET');
      await handleOperatorAction('operator.componentInventory', '/ops/components', 'GET');
    } finally {
      setIsOperatorBusy(false);
    }
  }

  useEffect(() => {
    activePhaseRef.current = activePhase;
    isAdminRef.current = isAdmin;
  }, [activePhase, isAdmin]);

  useEffect(() => {
    trafficFormRef.current = trafficForm;
    rolloutFormRef.current = rolloutForm;
    componentFormRef.current = componentForm;
  }, [trafficForm, rolloutForm, componentForm]);

  useEffect(() => {
    const status = registerMarketplaceWebMcpTools({
      getState: () => ({ activePhase: activePhaseRef.current, isAdmin: isAdminRef.current }),
      setPhase: (phase) => setActivePhase(phase),
      setAdmin: (next) => setIsAdmin(next),
      listCards: (phase) => PHASE_DEFINITIONS.find((item) => item.key === phase)?.cards ?? [],
      runOperatorCard: runOperatorCardById,
      formatWiringHint,
      phases: PHASE_DEFINITIONS,
      langfuseAppUrl: 'http://localhost:3001',
      langfuseDocsUrl: 'https://langfuse.com/docs',
    });
    setWebMcpState(status);
  }, [operatorCardsById]);

  useEffect(() => {
    if (activePhase === 'operator' && isAdmin) {
      void refreshOperatorSnapshot();
    }
  }, [activePhase, isAdmin]);

  return (
    <main className="market-shell">
      <header className="market-header card flux">
        <div className="header-left">
          <p className="eyebrow">BountyNet // Operations Skin v0.3</p>
          <h1>Marketplace Phase Scaffolding</h1>
          <p className="subtitle">
            Stub-first structure with low cruft so each phase can be wired cleanly later.
          </p>
          <div className="phase-rail">
            {PHASE_DEFINITIONS.map((step, index) => (
              <button
                key={step.key}
                type="button"
                className={`phase-chip ${activePhase === step.key ? 'active' : ''}`}
                onClick={() => setActivePhase(step.key)}
              >
                <span>{index + 1}. {step.title}</span>
                <small>{step.note}</small>
              </button>
            ))}
          </div>
        </div>
        <div className="stat-row crazy stub-stats">
          <article className="stat-tile">
            <span>{PHASE_DEFINITIONS.length}</span>
            <small>Phases</small>
          </article>
          <article className="stat-tile">
            <span>{activePhaseDef.cards.length}</span>
            <small>Stub Cards</small>
          </article>
          <article className="stat-tile">
            <span>{isAdmin ? 'on' : 'off'}</span>
            <small>Admin Mode</small>
          </article>
          <article className="stat-tile">
            <span>{webMcpState === 'registered' ? 'on' : 'off'}</span>
            <small>WebMCP</small>
          </article>
          <button
            type="button"
            className="admin-toggle"
            onClick={() => setIsAdmin((prev) => !prev)}
          >
            {isAdmin ? 'Switch to Viewer' : 'Enable Admin'}
          </button>
        </div>
      </header>

      <section className="grid">
        <article className="card panel wide terminal-pane">
          <h2>Signal Terminal</h2>
          <div className="terminal-stream">
            {phaseTerminalLines.map((line) => (
              <p key={line} className="terminal-line">
                <span>&gt;</span> {line}
              </p>
            ))}
          </div>
        </article>

        {adminBlocked ? (
          <article className="card panel wide">
            <h2>Operator Panel (Admin Only)</h2>
            <p className="phase-copy">
              You need admin mode enabled to access serving controls and observability links.
            </p>
            <button type="button" className="ghost" onClick={() => setIsAdmin(true)}>
              Enable Admin Mode
            </button>
          </article>
        ) : (
          <>
            <article className="card panel wide">
              <h2>{activePhaseDef.title}</h2>
              <p className="phase-copy">{activePhaseDef.summary}</p>
              <div className="table">
                {activePhaseDef.cards.map((card) => (
                  <div key={card.id} className="row stub-row">
                    <div>
                      <strong>{card.title}</strong>
                      <p>{card.description}</p>
                    </div>
                    <div className="pill-row">
                      <span className="pill">{getAdapterStatus(card.wiring.adapterKey)}</span>
                      {activePhaseDef.key === 'operator' ? (
                        <button
                          type="button"
                          className="ghost small"
                          onClick={() =>
                            handleOperatorAction(
                              card.wiring.adapterKey,
                              card.wiring.endpoint,
                              card.wiring.method
                            )
                          }
                        >
                          Run
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </article>

            <article className="card panel wide">
              <h2>Wiring Notes</h2>
              <div className="table">
                {activePhaseDef.cards.map((card) => (
                  <div key={`${card.id}-hint`} className="row stub-row">
                    <div>
                      <strong>{card.title}</strong>
                      <p>{formatWiringHint(card)}</p>
                    </div>
                    <span className="pill">{getAdapterStatus(card.wiring.adapterKey)}</span>
                  </div>
                ))}
              </div>
            </article>

            {activePhaseDef.key === 'operator' ? (
              <>
                <article className="card panel wide">
                  <h2>Operator Controls</h2>
                  <div className="operator-controls">
                    <form
                      className="operator-form"
                      onSubmit={(event) => {
                        event.preventDefault();
                        void handleOperatorAction(
                          'operator.trafficControl',
                          '/ops/serving/traffic-shift',
                          'POST'
                        );
                      }}
                    >
                      <strong>Traffic Steering</strong>
                      <p>Persist 5-region edge traffic steering for circuit-break failover lanes.</p>
                      <div className="inline">
                        {regionLabels.map(({ key, label }) => (
                          <label key={key}>
                            {label} %
                            <input
                              type="number"
                              min={0}
                              max={100}
                              value={trafficForm.regionalWeights[key]}
                              onChange={(event) => {
                                const value = Number(event.target.value);
                                setTrafficForm((prev) => ({
                                  ...prev,
                                  regionalWeights: {
                                    ...prev.regionalWeights,
                                    [key]: Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0,
                                  },
                                }));
                              }}
                            />
                          </label>
                        ))}
                      </div>
                      <p className="phase-copy">Traffic total must equal 100%. Current total: {trafficTotal}%.</p>
                      <div className="inline">
                        <label>
                          Changed By
                          <input
                            type="text"
                            value={trafficForm.changedBy}
                            onChange={(event) =>
                              setTrafficForm((prev) => ({ ...prev, changedBy: event.target.value }))
                            }
                          />
                        </label>
                        <label>
                          Notes
                          <input
                            type="text"
                            value={trafficForm.notes}
                            onChange={(event) =>
                              setTrafficForm((prev) => ({ ...prev, notes: event.target.value }))
                            }
                          />
                        </label>
                      </div>
                      <div className="pill-row">
                        <button type="submit" disabled={isOperatorBusy || trafficTotal !== 100}>
                          Apply Traffic
                        </button>
                        <button
                          type="button"
                          className="ghost small"
                          disabled={isOperatorBusy}
                          onClick={() => void refreshOperatorSnapshot()}
                        >
                          Refresh
                        </button>
                      </div>
                    </form>

                    <form
                      className="operator-form"
                      onSubmit={(event) => {
                        event.preventDefault();
                        void handleOperatorAction(
                          'operator.modelRollout',
                          '/ops/serving/model-rollout',
                          'POST'
                        );
                      }}
                    >
                      <strong>Model Rollout</strong>
                      <p>Queue rollout records and persist revision history.</p>
                      <div className="inline">
                        <label>
                          Target
                          <select
                            value={rolloutForm.target}
                            onChange={(event) =>
                              setRolloutForm((prev) => ({
                                ...prev,
                                target: event.target.value as RolloutFormState['target'],
                              }))
                            }
                          >
                            <option value="base">Base</option>
                            <option value="specialist">Specialist</option>
                            <option value="supervisor">Supervisor (Mistral)</option>
                            <option value="worker_security">Worker Security (GLM)</option>
                            <option value="worker_vendor_swap">Worker Vendor Swap (GLM)</option>
                            <option value="worker_recovery">Worker Recovery (MiniMax)</option>
                            <option value="edge_gateway">Edge Gateway (Droplets)</option>
                            <option value="tuning_loop">Tuning Loop (Trainium)</option>
                          </select>
                        </label>
                        <label>
                          Strategy
                          <select
                            value={rolloutForm.strategy}
                            onChange={(event) =>
                              setRolloutForm((prev) => ({ ...prev, strategy: event.target.value }))
                            }
                          >
                            <option value="canary">Canary</option>
                            <option value="blue_green">Blue Green</option>
                            <option value="all_at_once">All At Once</option>
                          </select>
                        </label>
                      </div>
                      <label>
                        Revision
                        <input
                          type="text"
                          value={rolloutForm.revision}
                          placeholder="adapter/rust-sentinel-v4"
                          onChange={(event) =>
                            setRolloutForm((prev) => ({ ...prev, revision: event.target.value }))
                          }
                          required
                        />
                      </label>
                      <label>
                        Requested By
                        <input
                          type="text"
                          value={rolloutForm.requestedBy}
                          onChange={(event) =>
                            setRolloutForm((prev) => ({ ...prev, requestedBy: event.target.value }))
                          }
                        />
                      </label>
                      <button type="submit" disabled={isOperatorBusy || !rolloutForm.revision.trim()}>
                        Queue Rollout
                      </button>
                    </form>

                    <form
                      className="operator-form"
                      onSubmit={(event) => {
                        event.preventDefault();
                        void handleOperatorAction(
                          'operator.componentAction',
                          '/ops/components/action',
                          'POST'
                        ).then(() => refreshOperatorSnapshot());
                      }}
                    >
                      <strong>Component Control</strong>
                      <p>Queue per-component start/stop/restart actions from the admin surface.</p>
                      <label>
                        Component
                        <select
                          value={componentForm.componentId}
                          onChange={(event) =>
                            setComponentForm((prev) => ({ ...prev, componentId: event.target.value }))
                          }
                        >
                          {componentOptions.map((component) => (
                            <option key={component.value} value={component.value}>
                              {component.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="inline">
                        <label>
                          Action
                          <select
                            value={componentForm.action}
                            onChange={(event) =>
                              setComponentForm((prev) => ({
                                ...prev,
                                action: event.target.value as ComponentControlFormState['action'],
                              }))
                            }
                          >
                            <option value="start">Start</option>
                            <option value="stop">Stop</option>
                            <option value="restart">Restart</option>
                            <option value="scale_up">Scale Up</option>
                            <option value="scale_down">Scale Down</option>
                            <option value="enable">Enable</option>
                            <option value="disable">Disable</option>
                          </select>
                        </label>
                        <label>
                          Requested By
                          <input
                            type="text"
                            value={componentForm.requestedBy}
                            onChange={(event) =>
                              setComponentForm((prev) => ({ ...prev, requestedBy: event.target.value }))
                            }
                          />
                        </label>
                      </div>
                      <label>
                        Notes
                        <input
                          type="text"
                          value={componentForm.notes}
                          onChange={(event) =>
                            setComponentForm((prev) => ({ ...prev, notes: event.target.value }))
                          }
                        />
                      </label>
                      <button
                        type="submit"
                        disabled={isOperatorBusy || !componentForm.componentId.trim()}
                      >
                        Queue Component Action
                      </button>
                    </form>
                  </div>
                </article>

                <article className="card panel wide">
                  <h2>Operator Links</h2>
                  <div className="table">
                    <div className="row stub-row">
                      <div>
                        <strong>Langfuse Application</strong>
                        <p>Trace plans, token costs, and execution diagnostics.</p>
                      </div>
                      <a className="link-pill" href="http://localhost:3001" target="_blank" rel="noreferrer">
                        Open
                      </a>
                    </div>
                    <div className="row stub-row">
                      <div>
                        <strong>Langfuse Docs</strong>
                        <p>Integration docs, prompts/traces, and evaluation guides.</p>
                      </div>
                      <a className="link-pill" href="https://langfuse.com/docs" target="_blank" rel="noreferrer">
                        Open
                      </a>
                    </div>
                    <div className="row stub-row">
                      <div>
                        <strong>Current Traffic State</strong>
                        <p>
                          {regionLabels
                            .map(({ key, label }) => {
                              const value =
                                operatorSnapshot.traffic?.regional_weights?.[key] ??
                                trafficForm.regionalWeights[key];
                              return `${label}: ${value}%`;
                            })
                            .join(' | ')}
                        </p>
                      </div>
                      <span className="pill">persisted</span>
                    </div>
                    <div className="row stub-row">
                      <div>
                        <strong>Latest Rollout</strong>
                        <p>
                          {operatorSnapshot.lastRollout
                            ? `${operatorSnapshot.lastRollout.target} -> ${operatorSnapshot.lastRollout.revision} (${operatorSnapshot.lastRollout.strategy})`
                            : 'No rollout recorded yet.'}
                        </p>
                      </div>
                      <span className="pill">
                        {operatorSnapshot.lastRollout?.status ?? 'none'}
                      </span>
                    </div>
                    <div className="row stub-row">
                      <div>
                        <strong>Recent Rollouts</strong>
                        <p>
                          {operatorSnapshot.recentRollouts.length
                            ? operatorSnapshot.recentRollouts
                                .map((item) => `${item.target}:${item.revision}`)
                                .join(' | ')
                            : 'none'}
                        </p>
                      </div>
                      <span className="pill">{operatorSnapshot.recentRollouts.length}</span>
                    </div>
                    <div className="row stub-row">
                      <div>
                        <strong>Infra Drift Modules</strong>
                        <p>
                          {operatorSnapshot.drift?.module_state
                            ? Object.entries(operatorSnapshot.drift.module_state)
                                .map(([name, state]) => `${name}:${state.present ? 'ok' : 'missing'}`)
                                .join(' | ')
                            : 'No drift snapshot yet.'}
                        </p>
                      </div>
                      <span className="pill">{operatorSnapshot.drift?.status ?? 'unknown'}</span>
                    </div>
                    <div className="row stub-row">
                      <div>
                        <strong>Drift Commands</strong>
                        <p>
                          {operatorSnapshot.drift?.recommended_commands?.length
                            ? operatorSnapshot.drift.recommended_commands.join(' | ')
                            : 'Run /ops/infra/drift to fetch Terraform checks.'}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="ghost small"
                        onClick={() => void handleOperatorAction('operator.infraDrift', '/ops/infra/drift', 'GET')}
                      >
                        Refresh Drift
                      </button>
                    </div>
                    <div className="row stub-row">
                      <div>
                        <strong>Component States</strong>
                        <p>
                          {operatorSnapshot.components.length
                            ? operatorSnapshot.components
                                .map(
                                  (item) =>
                                    `${item.label ?? item.component_id}:${item.desired_state ?? 'unknown'}`
                                )
                                .join(' | ')
                            : 'No component state loaded.'}
                        </p>
                      </div>
                      <span className="pill">{operatorSnapshot.components.length}</span>
                    </div>
                    <div className="row stub-row">
                      <div>
                        <strong>Recent Component Actions</strong>
                        <p>
                          {operatorSnapshot.recentComponentActions.length
                            ? operatorSnapshot.recentComponentActions
                                .map(
                                  (item) =>
                                    `${item.component_id ?? 'unknown'}:${item.action ?? 'none'}(${item.status ?? 'queued'})`
                                )
                                .join(' | ')
                            : 'none'}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="ghost small"
                        onClick={() =>
                          void handleOperatorAction('operator.componentInventory', '/ops/components', 'GET')
                        }
                      >
                        Refresh Components
                      </button>
                    </div>
                  </div>
                </article>
              </>
            ) : null}
          </>
        )}
      </section>
    </main>
  );
}

export default App;
