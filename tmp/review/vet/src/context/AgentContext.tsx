import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export interface Agent {
  id: string;
  name: string;
  description: string;
  category: 'coding' | 'design' | 'content' | 'analysis' | 'other';
  model: string;
  version: string;
  status: 'draft' | 'submitted' | 'approved' | 'active' | 'suspended';
  createdAt: string;
  updatedAt: string;
  avatar?: string;
}

export interface AgentEval {
  id: string;
  agentId: string;
  rating: number; // 1-5
  usageCount: number;
  successRate: number; // 0-100
  averageResponseTime: number; // ms
  userFeedback: string[];
  evaluatedAt: string;
}

export interface Payout {
  id: string;
  agentId: string;
  amount: number;
  currency: string;
  period: string; // "2024-01" format
  usageCount: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: string;
  processedAt?: string;
}

const STORAGE_KEY = 'jules-agents';

interface AgentContextType {
  agents: Agent[];
  evals: AgentEval[];
  payouts: Payout[];
  createAgent: (agent: Omit<Agent, 'id' | 'createdAt' | 'updatedAt'>) => Agent;
  updateAgent: (id: string, updates: Partial<Agent>) => void;
  deleteAgent: (id: string) => void;
  getAgent: (id: string) => Agent | undefined;
  getAgentStats: (agentId: string) => AgentEval | undefined;
  updateAgentStats: (agentId: string, stats: Partial<AgentEval>) => void;
  addPayout: (payout: Omit<Payout, 'id' | 'createdAt'>) => Payout;
  getAgentPayouts: (agentId: string) => Payout[];
}

const AgentContext = createContext<AgentContextType | undefined>(undefined);

function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

export const AgentProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [evals, setEvals] = useState<AgentEval[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const { agents: savedAgents, evals: savedEvals, payouts: savedPayouts } = JSON.parse(saved);
        setAgents(savedAgents || []);
        setEvals(savedEvals || []);
        setPayouts(savedPayouts || []);
      }
    } catch (error) {
      console.error('Failed to load agents from localStorage:', error);
    }
    setIsLoaded(true);
  }, []);

  // Save to localStorage whenever data changes
  useEffect(() => {
    if (!isLoaded) return;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ agents, evals, payouts })
      );
    } catch (error) {
      console.error('Failed to save agents to localStorage:', error);
    }
  }, [agents, evals, payouts, isLoaded]);

  const createAgent = useCallback(
    (agentData: Omit<Agent, 'id' | 'createdAt' | 'updatedAt'>): Agent => {
      const now = new Date().toISOString();
      const newAgent: Agent = {
        ...agentData,
        id: generateId(),
        createdAt: now,
        updatedAt: now,
      };
      setAgents((prev) => [newAgent, ...prev]);

      // Create initial eval record
      const initialEval: AgentEval = {
        id: generateId(),
        agentId: newAgent.id,
        rating: 0,
        usageCount: 0,
        successRate: 0,
        averageResponseTime: 0,
        userFeedback: [],
        evaluatedAt: now,
      };
      setEvals((prev) => [initialEval, ...prev]);

      return newAgent;
    },
    []
  );

  const updateAgent = useCallback((id: string, updates: Partial<Agent>) => {
    setAgents((prev) =>
      prev.map((agent) =>
        agent.id === id
          ? { ...agent, ...updates, updatedAt: new Date().toISOString() }
          : agent
      )
    );
  }, []);

  const deleteAgent = useCallback((id: string) => {
    setAgents((prev) => prev.filter((a) => a.id !== id));
    setEvals((prev) => prev.filter((e) => e.agentId !== id));
    setPayouts((prev) => prev.filter((p) => p.agentId !== id));
  }, []);

  const getAgent = useCallback(
    (id: string): Agent | undefined => {
      return agents.find((a) => a.id === id);
    },
    [agents]
  );

  const getAgentStats = useCallback(
    (agentId: string): AgentEval | undefined => {
      return evals.find((e) => e.agentId === agentId);
    },
    [evals]
  );

  const updateAgentStats = useCallback((agentId: string, stats: Partial<AgentEval>) => {
    setEvals((prev) =>
      prev.map((evaluation) =>
        evaluation.agentId === agentId
          ? { ...evaluation, ...stats, evaluatedAt: new Date().toISOString() }
          : evaluation
      )
    );
  }, []);

  const addPayout = useCallback(
    (payoutData: Omit<Payout, 'id' | 'createdAt'>): Payout => {
      const newPayout: Payout = {
        ...payoutData,
        id: generateId(),
        createdAt: new Date().toISOString(),
      };
      setPayouts((prev) => [newPayout, ...prev]);
      return newPayout;
    },
    []
  );

  const getAgentPayouts = useCallback(
    (agentId: string): Payout[] => {
      return payouts.filter((p) => p.agentId === agentId);
    },
    [payouts]
  );

  const value = {
    agents,
    evals,
    payouts,
    createAgent,
    updateAgent,
    deleteAgent,
    getAgent,
    getAgentStats,
    updateAgentStats,
    addPayout,
    getAgentPayouts,
  };

  return (
    <AgentContext.Provider value={value}>{children}</AgentContext.Provider>
  );
};

export const useAgent = () => {
  const context = useContext(AgentContext);
  if (!context) {
    throw new Error('useAgent must be used within an AgentProvider');
  }
  return context;
};
