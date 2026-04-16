import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export interface SessionMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface SessionData {
  id: string;
  name: string;
  timestamp: string;
  status: 'completed' | 'in_progress' | 'failed';
  messages: SessionMessage[];
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEY = 'bountynet-sessions';

interface SessionContextType {
  sessions: SessionData[];
  currentSession: SessionData | null;
  createSession: (name: string) => SessionData;
  getSession: (id: string) => SessionData | undefined;
  updateSession: (id: string, updates: Partial<SessionData>) => void;
  deleteSession: (id: string) => void;
  setCurrentSession: (id: string | null) => void;
  addMessage: (sessionId: string, message: SessionMessage) => void;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

// Generate unique ID
function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

// Get relative time string
function getRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export const SessionProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [currentSession, setCurrentSessionState] = useState<SessionData | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load sessions from localStorage on mount
  useEffect(() => {
    try {
      const savedSessions = localStorage.getItem(STORAGE_KEY);
      if (savedSessions) {
        const parsed = JSON.parse(savedSessions);
        // Convert message timestamps back to Date objects
        const sessionsWithDates = parsed.map((session: any) => ({
          ...session,
          messages: session.messages.map((msg: any) => ({
            ...msg,
            timestamp: new Date(msg.timestamp),
          })),
        }));
        setSessions(sessionsWithDates);
      }
    } catch (error) {
      console.error('Failed to load sessions from localStorage:', error);
    }
    setIsLoaded(true);
  }, []);

  // Save sessions to localStorage whenever they change
  useEffect(() => {
    if (!isLoaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    } catch (error) {
      console.error('Failed to save sessions to localStorage:', error);
    }
  }, [sessions, isLoaded]);

  const createSession = useCallback(
    (name: string): SessionData => {
      const now = new Date();
      const newSession: SessionData = {
        id: generateId(),
        name,
        timestamp: getRelativeTime(now),
        status: 'in_progress',
        messages: [],
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };
      setSessions((prev) => [newSession, ...prev]);
      setCurrentSessionState(newSession);
      return newSession;
    },
    []
  );

  const getSession = useCallback(
    (id: string): SessionData | undefined => {
      return sessions.find((s) => s.id === id);
    },
    [sessions]
  );

  const updateSession = useCallback(
    (id: string, updates: Partial<SessionData>) => {
      setSessions((prev) =>
        prev.map((session) =>
          session.id === id
            ? {
                ...session,
                ...updates,
                updatedAt: new Date().toISOString(),
              }
            : session
        )
      );

      // Update current session if it's the one being updated
      if (currentSession?.id === id) {
        setCurrentSessionState((prev) =>
          prev
            ? {
                ...prev,
                ...updates,
                updatedAt: new Date().toISOString(),
              }
            : null
        );
      }
    },
    [currentSession?.id]
  );

  const deleteSession = useCallback((id: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== id));
    if (currentSession?.id === id) {
      setCurrentSessionState(null);
    }
  }, [currentSession?.id]);

  const setCurrentSession = useCallback((id: string | null) => {
    if (id === null) {
      setCurrentSessionState(null);
    } else {
      const session = sessions.find((s) => s.id === id);
      if (session) {
        setCurrentSessionState(session);
      }
    }
  }, [sessions]);

  const addMessage = useCallback(
    (sessionId: string, message: SessionMessage) => {
      setSessions((prev) =>
        prev.map((session) =>
          session.id === sessionId
            ? {
                ...session,
                messages: [...session.messages, message],
                updatedAt: new Date().toISOString(),
              }
            : session
        )
      );

      // Update current session if it's the one receiving the message
      if (currentSession?.id === sessionId) {
        setCurrentSessionState((prev) =>
          prev
            ? {
                ...prev,
                messages: [...prev.messages, message],
                updatedAt: new Date().toISOString(),
              }
            : null
        );
      }
    },
    [currentSession?.id]
  );

  const value = {
    sessions,
    currentSession,
    createSession,
    getSession,
    updateSession,
    deleteSession,
    setCurrentSession,
    addMessage,
  };

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
};

export const useSession = () => {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
};
