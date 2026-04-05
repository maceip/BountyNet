import { useEffect, useMemo, useState } from 'react'

const GATEWAY = import.meta.env.VITE_GATEWAY_URL || 'https://gateway.stare.network'

interface AuthState {
  isLoggedIn: boolean
  user: { userId: string; alias: string } | null
  wallet: string | null
  jwt: string | null
  agentId: number | null
  ensName: string | null
  loading: boolean
}

function readAgentIdFromUrl(): number | null {
  const params = new URLSearchParams(window.location.search)
  const raw = params.get('agent_id')
  if (!raw) return null
  const parsed = Number(raw)
  if (!Number.isInteger(parsed) || parsed <= 0) return null
  return parsed
}

function setAgentIdInUrl(agentId: number | null) {
  const url = new URL(window.location.href)
  if (agentId && agentId > 0) url.searchParams.set('agent_id', String(agentId))
  else url.searchParams.delete('agent_id')
  window.location.href = url.pathname + url.search + url.hash
}

export function useAuth(): AuthState & {
  gatewayFetch: (path: string, init?: RequestInit) => Promise<Response>
  logout: () => void
  login: () => void
} {
  const [requestedAgentId, setRequestedAgentId] = useState<number | null>(() => readAgentIdFromUrl())
  const [agentId, setAgentId] = useState<number | null>(null)
  const [wallet, setWallet] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const sync = () => {
      setRequestedAgentId(readAgentIdFromUrl())
    }
    window.addEventListener('popstate', sync)
    return () => window.removeEventListener('popstate', sync)
  }, [])

  useEffect(() => {
    if (!requestedAgentId) {
      setAgentId(null)
      setWallet(null)
      setLoading(false)
      return
    }

    setLoading(true)
    fetch(`${GATEWAY}/identity/${requestedAgentId}`)
      .then(r => {
        if (!r.ok) throw new Error('agent not found')
        return r.json()
      })
      .then(data => {
        if (typeof data.agent_id === 'number') setAgentId(data.agent_id)
        else setAgentId(null)
        if (typeof data.wallet === 'string') setWallet(data.wallet)
        else setWallet(null)
      })
      .catch(() => {
        setAgentId(null)
        setWallet(null)
      })
      .finally(() => setLoading(false))
  }, [requestedAgentId])

  const user = useMemo(
    () => (agentId ? { userId: `agent:${agentId}`, alias: `Viewing agent #${agentId}` } : null),
    [agentId],
  )

  return {
    isLoggedIn: agentId !== null,
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
    login: () => {
      window.location.href = '/setup?installation_id=121423466'
    },
    logout: () => {
      setAgentIdInUrl(null)
    },
  }
}
