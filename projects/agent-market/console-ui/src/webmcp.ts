import type { PhaseDefinition, PhaseKey, StubCard } from './phase-wiring';

type MarketplaceState = {
  activePhase: PhaseKey;
  isAdmin: boolean;
};

type WebMcpApi = {
  getState: () => MarketplaceState;
  setPhase: (phase: PhaseKey) => void;
  setAdmin: (isAdmin: boolean) => void;
  listCards: (phase: PhaseKey) => StubCard[];
  runOperatorCard: (cardId: string) => Promise<unknown>;
  formatWiringHint: (card: StubCard) => string;
  phases: PhaseDefinition[];
  langfuseAppUrl: string;
  langfuseDocsUrl: string;
};

type ModelContextToolDef = {
  description: string;
  inputSchema: Record<string, unknown>;
};

type ModelContext = {
  registerTool: (
    name: string,
    definition: ModelContextToolDef,
    handler: (input: unknown) => unknown | Promise<unknown>
  ) => Promise<void> | void;
};

type QueryMarketplaceInput = {
  phase?: PhaseKey;
  adminMode?: boolean;
  operatorCardId?: string;
  includeWiring?: boolean;
};

declare global {
  interface Navigator {
    modelContext?: ModelContext;
  }
}

function hasModelContext(): boolean {
  return Boolean(typeof navigator !== 'undefined' && navigator.modelContext?.registerTool);
}

function toQueryInput(raw: unknown): QueryMarketplaceInput {
  if (!raw || typeof raw !== 'object') return {};
  const input = raw as Record<string, unknown>;
  return {
    phase: typeof input.phase === 'string' ? (input.phase as PhaseKey) : undefined,
    adminMode: typeof input.adminMode === 'boolean' ? input.adminMode : undefined,
    operatorCardId: typeof input.operatorCardId === 'string' ? input.operatorCardId : undefined,
    includeWiring: typeof input.includeWiring === 'boolean' ? input.includeWiring : false,
  };
}

export function registerMarketplaceWebMcpTools(api: WebMcpApi): 'registered' | 'unavailable' {
  if (!hasModelContext()) return 'unavailable';
  const modelContext = navigator.modelContext as ModelContext;

  const queryMarketplaceSchema: Record<string, unknown> = {
    type: 'object',
    properties: {
      phase: {
        type: 'string',
        enum: api.phases.map((phase) => phase.key),
      },
      adminMode: { type: 'boolean' },
      operatorCardId: { type: 'string' },
      includeWiring: { type: 'boolean' },
    },
    additionalProperties: false,
  };

  const phaseCardsSchema: Record<string, unknown> = {
    type: 'object',
    properties: {
      phase: {
        type: 'string',
        enum: api.phases.map((phase) => phase.key),
      },
      includeWiring: { type: 'boolean' },
    },
    required: ['phase'],
    additionalProperties: false,
  };

  const runOperatorCardSchema: Record<string, unknown> = {
    type: 'object',
    properties: {
      cardId: { type: 'string' },
    },
    required: ['cardId'],
    additionalProperties: false,
  };

  modelContext.registerTool(
    'queryMarketplace',
    {
      description:
        'Atomically set marketplace phase/admin mode and optionally run an operator card action. Returns updated state and phase cards.',
      inputSchema: queryMarketplaceSchema,
    },
    async (input: unknown) => {
      const query = toQueryInput(input);

      if (query.phase) api.setPhase(query.phase);
      if (typeof query.adminMode === 'boolean') api.setAdmin(query.adminMode);

      let operatorResult: unknown = null;
      if (query.operatorCardId) {
        operatorResult = await api.runOperatorCard(query.operatorCardId);
      }

      const state = api.getState();
      const cards = api.listCards(state.activePhase).map((card) => ({
        id: card.id,
        title: card.title,
        description: card.description,
        wiring: query.includeWiring ? api.formatWiringHint(card) : undefined,
      }));

      return {
        ok: true,
        state,
        cards,
        operatorResult,
      };
    }
  );

  modelContext.registerTool(
    'listPhaseCards',
    {
      description: 'List cards for a specific marketplace phase.',
      inputSchema: phaseCardsSchema,
    },
    (input: unknown) => {
      const parsed = toQueryInput(input);
      const phase = parsed.phase ?? 'landing';
      return {
        phase,
        cards: api.listCards(phase).map((card) => ({
          id: card.id,
          title: card.title,
          description: card.description,
          wiring: parsed.includeWiring ? api.formatWiringHint(card) : undefined,
        })),
      };
    }
  );

  modelContext.registerTool(
    'runOperatorCard',
    {
      description: 'Run one operator card action by card id.',
      inputSchema: runOperatorCardSchema,
    },
    async (input: unknown) => {
      const cardId =
        input && typeof input === 'object' && typeof (input as Record<string, unknown>).cardId === 'string'
          ? ((input as Record<string, unknown>).cardId as string)
          : '';
      if (!cardId) return { ok: false, error: 'cardId required' };
      const result = await api.runOperatorCard(cardId);
      return { ok: true, cardId, result };
    }
  );

  modelContext.registerTool(
    'getOperatorResources',
    {
      description: 'Get operator URLs for Langfuse application and documentation.',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
    },
    () => ({
      langfuseAppUrl: api.langfuseAppUrl,
      langfuseDocsUrl: api.langfuseDocsUrl,
    })
  );

  return 'registered';
}
