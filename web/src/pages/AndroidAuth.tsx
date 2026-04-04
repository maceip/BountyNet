/**
 * In-app auth entry for Android: opened inside Chrome Auth Tab (androidx.browser AuthTabIntent).
 * After Dynamic login, redirects with custom scheme so the app receives the session JWT.
 *
 * Demo note: passing JWT in a URL is convenient for demos only; production should use a one-time code + backend exchange.
 */
import { useEffect } from 'react'
import { DynamicWidget, useDynamicContext, useIsLoggedIn } from '@dynamic-labs/sdk-react-core'
import { font, palette, panel } from '../components'

const REDIRECT_SCHEME = 'bountynet'
const REDIRECT_HOST = 'auth'
const QUERY = 'authorization'

export default function AndroidAuth() {
  const isLoggedIn = useIsLoggedIn()
  const { authToken } = useDynamicContext()

  useEffect(() => {
    if (!isLoggedIn || !authToken) return
    const target = `${REDIRECT_SCHEME}://${REDIRECT_HOST}/callback?${QUERY}=${encodeURIComponent(authToken)}`
    window.location.replace(target)
  }, [isLoggedIn, authToken])

  return (
    <div
      style={{
        ...panel(true),
        padding: '1.5rem',
        borderRadius: 8,
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      <h2
        style={{
          fontFamily: font.family,
          fontSize: '1.1rem',
          fontWeight: 700,
          color: palette.accent,
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          margin: '0 0 0.75rem',
        }}
      >
        BountyNet · App sign-in
      </h2>
      <p
        style={{
          fontFamily: font.family,
          fontSize: '0.85rem',
          color: palette.textMuted,
          lineHeight: 1.5,
          margin: '0 0 1rem',
        }}
      >
        Use the same login as the website (GitHub, email, etc.). When you finish, you return to the Android app automatically.
      </p>
      <DynamicWidget />
    </div>
  )
}
