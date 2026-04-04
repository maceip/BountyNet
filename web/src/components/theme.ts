/**
 * BountyNet design tokens — dual mode (dark + lite).
 * Hex motif geometry shared, colors swap.
 * Typography: Raleway with aggressive tracking.
 */

export type Mode = 'dark' | 'lite'

const dark = {
  bg:           '#0e1118',
  panel:        '#1a1f2e',
  panelLight:   '#232838',
  panelMid:     '#2a3040',
  accent:       '#00e5ff',
  accentDim:    '#00b8cc',
  accentGlow:   'rgba(0, 229, 255, 0.15)',
  accentBorder: 'rgba(0, 229, 255, 0.35)',
  fill:         '#1a1f2e',
  red:          '#e53935',
  orange:       '#ff9800',
  amber:        '#ffc107',
  green:        '#4caf50',
  white:        '#f0f4f8',
  textPrimary:  '#e8ecf0',
  textSecondary:'#8a95a8',
  textMuted:    '#5a6578',
  border:       'rgba(0, 229, 255, 0.18)',
  textOnFill:   '#e8ecf0',
  textOnAccent: '#1a1f2e',
} as const

const lite = {
  bg:           '#f5f0e8',
  panel:        'rgba(255, 255, 255, 0.65)',
  panelLight:   'rgba(245, 240, 232, 0.7)',
  panelMid:     'rgba(235, 228, 216, 0.6)',
  accent:       '#e67e22',
  accentDim:    '#d4740e',
  accentGlow:   'rgba(230, 126, 34, 0.12)',
  accentBorder: 'rgba(230, 126, 34, 0.35)',
  fill:         '#1a1f3a',
  red:          '#e53935',
  orange:       '#e67e22',
  amber:        '#f39c12',
  green:        '#4caf50',
  white:        '#ffffff',
  textPrimary:  '#1a1f3a',
  textSecondary:'#4a4f62',
  textMuted:    '#8a8f9e',
  border:       'rgba(230, 126, 34, 0.22)',
  textOnFill:   '#f5f0e8',
  textOnAccent: '#ffffff',
} as const

// Active mode — switch this to toggle
let _mode: Mode = 'lite'
let _p = lite

export function setMode(m: Mode) {
  _mode = m
  _p = m === 'dark' ? dark : lite
}
export function getMode(): Mode { return _mode }

export const palette = new Proxy({} as typeof lite, {
  get: (_t, key: string) => (_p as any)[key],
})

export const font = {
  family: '"Raleway Variable", "Raleway", "Century Gothic", "ITC Avant Garde Gothic", sans-serif',
  mono: '"SF Mono", "Fira Code", "JetBrains Mono", monospace',
}

export const tracking = {
  tight:    '0.01em',
  normal:   '0.04em',
  wide:     '0.12em',
  wider:    '0.22em',
  widest:   '0.35em',
  ultra:    '0.5em',
} as const

/** Main panel surface */
export const panel = (glow = false): React.CSSProperties => ({
  background: _p.panel,
  backdropFilter: _mode === 'lite' ? 'blur(16px) saturate(1.4)' : undefined,
  WebkitBackdropFilter: _mode === 'lite' ? 'blur(16px) saturate(1.4)' : undefined,
  border: `1px solid ${glow ? _p.accentBorder : _p.border}`,
  boxShadow: glow
    ? `0 0 20px ${_p.accentGlow}, 0 8px 32px rgba(0, 0, 0, ${_mode === 'lite' ? '0.08' : '0.3'})`
    : `0 8px 32px rgba(0, 0, 0, ${_mode === 'lite' ? '0.06' : '0.25'})`,
})

/** Inner element panel */
export const panelInner = (): React.CSSProperties => ({
  background: _p.panelLight,
  backdropFilter: _mode === 'lite' ? 'blur(8px)' : undefined,
  WebkitBackdropFilter: _mode === 'lite' ? 'blur(8px)' : undefined,
  border: `1px solid ${_p.border}`,
})

// Backwards compat
export const glass = panel
export const glassInner = () => panelInner()
