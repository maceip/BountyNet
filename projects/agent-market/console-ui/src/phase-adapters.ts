import type { WiringSpec } from './phase-wiring';

export type AdapterResult = unknown;

export type AdapterContext = {
  baseUrl: string;
  params?: Record<string, string>;
  payload?: unknown;
};

export type PhaseAdapter = {
  key: string;
  description: string;
  stub: boolean;
  run: (ctx: AdapterContext, wiring: WiringSpec) => Promise<AdapterResult>;
};

function resolveUrl(baseUrl: string, endpoint: string): string {
  if (!baseUrl) return endpoint;
  const left = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const right = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${left}${right}`;
}

async function runHttpAdapter(ctx: AdapterContext, wiring: WiringSpec): Promise<AdapterResult> {
  const url = resolveUrl(ctx.baseUrl, wiring.endpoint);
  try {
    const init: RequestInit = {
      method: wiring.method,
      headers: { Accept: 'application/json' },
    };
    if (wiring.method !== 'GET') {
      init.headers = { ...init.headers, 'Content-Type': 'application/json' };
      init.body = JSON.stringify(ctx.payload ?? {});
    }
    const response = await fetch(url, init);
    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }
    return {
      ok: response.ok,
      status: response.status,
      url,
      method: wiring.method,
      body,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      url,
      method: wiring.method,
      error: error instanceof Error ? error.message : 'request_failed',
    };
  }
}

async function unimplementedAdapter(ctx: AdapterContext, wiring: WiringSpec): Promise<AdapterResult> {
  return Promise.resolve({
    stub: true,
    message: 'Adapter not implemented yet',
    endpoint: wiring.endpoint,
    method: wiring.method,
    baseUrl: ctx.baseUrl,
    params: ctx.params ?? {},
  });
}

export const PHASE_ADAPTERS: Record<string, PhaseAdapter> = {
  'landing.systemPulse': {
    key: 'landing.systemPulse',
    description: 'Load top-level health and KPI pulse.',
    stub: true,
    run: unimplementedAdapter,
  },
  'landing.globalAlerts': {
    key: 'landing.globalAlerts',
    description: 'Load active global alert/event stream.',
    stub: true,
    run: unimplementedAdapter,
  },
  'agentic.seedFleet': {
    key: 'agentic.seedFleet',
    description: 'Seed managed agent fleet.',
    stub: true,
    run: unimplementedAdapter,
  },
  'agentic.trustProfiles': {
    key: 'agentic.trustProfiles',
    description: 'Load trust profile matrix.',
    stub: true,
    run: unimplementedAdapter,
  },
  'agentic.capabilityManifests': {
    key: 'agentic.capabilityManifests',
    description: 'Load per-agent capability manifests.',
    stub: true,
    run: unimplementedAdapter,
  },
  'repo.registration': {
    key: 'repo.registration',
    description: 'Create/update repository account.',
    stub: true,
    run: unimplementedAdapter,
  },
  'repo.policyPreset': {
    key: 'repo.policyPreset',
    description: 'Apply repository lane preset.',
    stub: true,
    run: unimplementedAdapter,
  },
  'repo.opportunityScan': {
    key: 'repo.opportunityScan',
    description: 'Trigger repository opportunity scan.',
    stub: true,
    run: unimplementedAdapter,
  },
  'bazaar.opportunityFeed': {
    key: 'bazaar.opportunityFeed',
    description: 'Load promotable opportunity feed.',
    stub: true,
    run: unimplementedAdapter,
  },
  'bazaar.jobBoard': {
    key: 'bazaar.jobBoard',
    description: 'Load job lifecycle board.',
    stub: true,
    run: unimplementedAdapter,
  },
  'bazaar.executionConsole': {
    key: 'bazaar.executionConsole',
    description: 'Run execution/autopilot actions.',
    stub: true,
    run: unimplementedAdapter,
  },
  'operator.servingTopology': {
    key: 'operator.servingTopology',
    description: 'Inspect global serving topology and endpoint health.',
    stub: false,
    run: runHttpAdapter,
  },
  'operator.trafficControl': {
    key: 'operator.trafficControl',
    description: 'Control regional traffic weights for serving fleet.',
    stub: false,
    run: runHttpAdapter,
  },
  'operator.modelRollout': {
    key: 'operator.modelRollout',
    description: 'Promote model or LoRA adapter revisions to serving.',
    stub: false,
    run: runHttpAdapter,
  },
  'operator.langfuseTraces': {
    key: 'operator.langfuseTraces',
    description: 'Open Langfuse traces and diagnostics links.',
    stub: false,
    run: runHttpAdapter,
  },
  'operator.infraDrift': {
    key: 'operator.infraDrift',
    description: 'Inspect infra drift status and recommended Terraform checks.',
    stub: false,
    run: runHttpAdapter,
  },
  'operator.componentInventory': {
    key: 'operator.componentInventory',
    description: 'Load stack components and desired state controls.',
    stub: false,
    run: runHttpAdapter,
  },
  'operator.componentAction': {
    key: 'operator.componentAction',
    description: 'Queue start/stop/restart action for a selected stack component.',
    stub: false,
    run: runHttpAdapter,
  },
};

export function getAdapter(adapterKey: string): PhaseAdapter | undefined {
  return PHASE_ADAPTERS[adapterKey];
}

export function getAdapterStatus(adapterKey: string): 'stub' | 'ready' | 'missing' {
  const adapter = getAdapter(adapterKey);
  if (!adapter) return 'missing';
  return adapter.stub ? 'stub' : 'ready';
}

export async function invokeAdapter(
  adapterKey: string,
  ctx: AdapterContext,
  wiring: WiringSpec
): Promise<AdapterResult> {
  const adapter = getAdapter(adapterKey);
  if (!adapter) {
    return Promise.resolve({
      stub: true,
      message: `Missing adapter: ${adapterKey}`,
      endpoint: wiring.endpoint,
      method: wiring.method,
    });
  }
  return adapter.run(ctx, wiring);
}
