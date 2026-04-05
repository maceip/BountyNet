import { useEffect, useMemo, useState } from 'react'

const GATEWAY = import.meta.env.VITE_GATEWAY_URL || 'https://gateway.stare.network'
const STORAGE_KEY = 'bountynet-demo-auth'

type StoredAuth = {
  loggedIn: boolean
  userId: string
}

let authState: StoredAuth = { loggedIn: false, userId: 'demo-staker' }
const listeners = new Set<(state: StoredAuth) => void>()

interface AuthState {
  isLoggedIn: boolean
  user: { userId: string; alias: string } | null
  wallet: string | null
  jwt: string | null
  agentId: number | null
  ensName: string | null
  loading: boolean
}

function loadStoredAuth(): StoredAuth {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as StoredAuth
  } catch {
    /* ignore */
  }
  return { loggedIn: false, userId: 'demo-staker' }
}

function saveStoredAuth(state: StoredAuth) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    /* ignore */
  }
}

function setAuthState(next: StoredAuth) {
  authState = next
  saveStoredAuth(next)
  for (const listener of listeners) listener(next)
}

export function useAuth(): AuthState & {
  gatewayFetch: (path: string, init?: RequestInit) => Promise<Response>
  logout: () => void
  login: () => void
} {
  const [session, setSession] = useState<StoredAuth>(() => {
    authState = loadStoredAuth()
    return authState
  })
  const [agentId, setAgentId] = useState<number | null>(null)
  const [wallet, setWallet] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    listeners.add(setSession)
    return () => {
      listeners.delete(setSession)
    }
  }, [])

  useEffect(() => {
    if (!session.loggedIn) {
      setAgentId(null)
      setWallet(null)
      return
    }

    setLoading(true)
    // Demo mode binds directly to the seeded production agent so the
    // dashboard shows a real logged-in state instead of hanging in onboarding.
    fetch(`${GATEWAY}/identity/1`)
      .then(r => r.json())
      .then(data => {
        if (typeof data.agent_id === 'number') setAgentId(data.agent_id)
        if (typeof data.wallet === 'string') setWallet(data.wallet)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [session])

  const user = useMemo(
    () => (session.loggedIn ? { userId: session.userId, alias: 'Demo Login' } : null),
    [session],
  )

  return {
    isLoggedIn: session.loggedIn,
    user,
    wallet,
    jwt: null,
    agentId,
    ensName: agentId ? `agent-${agentId}.maceip.eth` : null,
    loading,
    gatewayFetch: (path: string, init?: RequestInit) => {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...((init?.headers as Record<string, string>) || {}),
      }
      return fetch(`${GATEWAY}${path}`, { ...init, headers })
    },
    login: () => setAuthState({ loggedIn: true, userId: session.userId || 'demo-staker' }),
    logout: () => setAuthState({ loggedIn: false, userId: session.userId || 'demo-staker' }),
  }
}
