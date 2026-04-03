/**
 * Dynamic auth provider — wraps the app with login + wallet.
 *
 * Handles:
 *   - GitHub OAuth login (stakers install from GitHub, login with same account)
 *   - Email login (casual users)
 *   - Embedded wallet creation (no MetaMask needed)
 *   - JWT session for gateway API calls
 *
 * The Dynamic environment ID comes from .env:
 *   VITE_DYNAMIC_ENV_ID=36a24240-ece2-4568-a45e-463437650d21
 */
import { DynamicContextProvider } from '@dynamic-labs/sdk-react-core'
import { EthereumWalletConnectors } from '@dynamic-labs/ethereum'
import { type ReactNode } from 'react'

const ENV_ID = import.meta.env.VITE_DYNAMIC_ENV_ID || ''

export function DynamicProvider({ children }: { children: ReactNode }) {
  if (!ENV_ID) {
    // Dev mode — render without auth
    return <>{children}</>
  }

  return (
    <DynamicContextProvider
      settings={{
        environmentId: ENV_ID,
        walletConnectors: [EthereumWalletConnectors],
        eventsCallbacks: {
          onAuthSuccess: (args) => {
            console.log('[bountynet] auth success:', args.user?.email || args.user?.alias)
            // Auto-onboard: POST to gateway with the Dynamic user ID
            fetch('/identity/onboard', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                external_id: `dynamic:${args.user?.userId}`,
              }),
            }).catch(() => {})
          },
        },
      }}
    >
      {children}
    </DynamicContextProvider>
  )
}
