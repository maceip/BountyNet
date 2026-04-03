/**
 * Auth hook — exposes Dynamic user state + gateway helpers.
 *
 * Provides:
 *   - user (Dynamic user object)
 *   - wallet address
 *   - jwt (for gateway API calls)
 *   - agent ID (from EIP-8004 registry, if registered)
 *   - gateway fetch wrapper (auto-injects auth)
 */
import { useDynamicContext, useIsLoggedIn } from '@dynamic-labs/sdk-react-core'
import { useState, useEffect, useCallback } from 'react'

const GATEWAY = import.meta.env.VITE_GATEWAY_URL || 'https://gateway.stare.network'

interface AuthState {
  isLoggedIn: boolean
  user: any | null
  wallet: string | null
  jwt: string | null
  agentId: number | null
  ensName: string | null
  loading: boolean
}

export function useAuth(): AuthState & {
  gatewayFetch: (path: string, init?: RequestInit) => Promise<Response>
  logout: () => void
} {
  const { user, primaryWallet, authToken, handleLogOut } = useDynamicContext()
  const isLoggedIn = useIsLoggedIn()
  const [agentId, setAgentId] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)

  const wallet = primaryWallet?.address || null
  const jwt = authToken || null

  // Fetch agent ID from gateway when wallet is available
  useEffect(() => {
    if (!wallet || !jwt) {
      setAgentId(null)
      return
    }

    setLoading(true)
    fetch(`${GATEWAY}/identity/onboard`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwt}`,
      },
      body: JSON.stringify({
        external_id: `dynamic:${user?.userId}`,
      }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.agent_id) {
          setAgentId(data.agent_id)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [wallet, jwt, user?.userId])

  // Gateway fetch with auth
  const gatewayFetch = useCallback(
    (path: string, init?: RequestInit) => {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(init?.headers as Record<string, string> || {}),
      }
      if (jwt) {
        headers['Authorization'] = `Bearer ${jwt}`
      }
      return fetch(`${GATEWAY}${path}`, { ...init, headers })
    },
    [jwt],
  )

  return {
    isLoggedIn,
    user,
    wallet,
    jwt,
    agentId,
    ensName: agentId ? `agent-${agentId}.maceip.eth` : null,
    loading,
    gatewayFetch,
    logout: handleLogOut,
  }
}
