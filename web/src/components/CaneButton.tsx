/**
 * The Cane Button — floating action button that toggles between
 * the AI-native agent experience and a crusty web 1.0 form site.
 *
 * Makes fun of every "chat with agent" widget by being the inverse:
 * clicking it REMOVES the agent UX and shows a boring traditional site.
 */
import { useState } from 'react'
import { palette, font, tracking } from './theme'

interface CaneButtonProps {
  isLegacy: boolean
  onToggle: () => void
}

export function CaneButton({ isLegacy, onToggle }: CaneButtonProps) {
  const [hover, setHover] = useState(false)

  return (
    <>
      {/* Tooltip */}
      {hover && (
        <div style={{
          position: 'fixed',
          bottom: 90,
          right: 24,
          zIndex: 10001,
          background: isLegacy ? palette.accent : palette.fill,
          color: isLegacy ? palette.fill : palette.textOnFill,
          fontFamily: font.family,
          fontSize: '0.65rem',
          fontWeight: 600,
          letterSpacing: tracking.wider,
          textTransform: 'uppercase',
          padding: '0.4rem 0.8rem',
          borderRadius: 4,
          whiteSpace: 'nowrap',
          animation: 'fadeUp 0.15s ease-out',
        }}>
          {isLegacy ? 'Back to the future' : 'I prefer forms'}
        </div>
      )}

      {/* FAB */}
      <button
        onClick={onToggle}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 10000,
          width: 56,
          height: 56,
          borderRadius: '50%',
          border: `2px solid ${isLegacy ? palette.accent : palette.border}`,
          background: isLegacy ? palette.accent : palette.fill,
          color: isLegacy ? palette.fill : palette.textOnFill,
          fontSize: '1.5rem',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: `0 4px 24px rgba(0,0,0,0.25)`,
          transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
          transform: hover ? 'scale(1.1) rotate(-10deg)' : 'scale(1)',
        }}
        title={isLegacy ? 'Back to agent experience' : 'Traditional website'}
      >
        {isLegacy ? '✨' : '🦯'}
      </button>
    </>
  )
}
