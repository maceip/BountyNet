/**
 * Watercolor Cannes design tokens.
 * Typography: Raleway (ITC Avant Garde Gothic stand-in) with extreme tracking.
 */

export const palette = {
  teal:       '#3CC8AA',
  tealDark:   '#2A9D8F',
  mauve:      '#C87E9E',
  mauveDark:  '#B56B88',
  lavender:   '#9B8EC4',
  lavDark:    '#7E6BAD',
  sea:        '#5B8DB8',
  seaDark:    '#4A7BA8',
  terra:      '#D4A08C',
  terraDark:  '#C28E78',
  cream:      '#F5F0E8',
  creamDark:  '#EDE5D8',
  ink:        '#1A1A2A',
  inkLight:   '#2D2D3D',
  inkMuted:   '#666677',
  white:      '#FFFFFF',
} as const

export const font = {
  family: '"Raleway Variable", "Raleway", "Century Gothic", "ITC Avant Garde Gothic", sans-serif',
  mono: '"SF Mono", "Fira Code", "JetBrains Mono", monospace',
}

/** Very long Avant Garde tracking values */
export const tracking = {
  tight:    '0.01em',
  normal:   '0.04em',
  wide:     '0.12em',
  wider:    '0.22em',
  widest:   '0.35em',
  ultra:    '0.5em',
} as const

export const glass = (opacity = 0.55, blur = 20): React.CSSProperties => ({
  background: `rgba(255, 255, 255, ${opacity})`,
  backdropFilter: `blur(${blur}px) saturate(1.6)`,
  WebkitBackdropFilter: `blur(${blur}px) saturate(1.6)`,
  border: '1px solid rgba(255, 255, 255, 0.4)',
  boxShadow: '0 8px 32px rgba(26, 26, 42, 0.08), 0 1px 2px rgba(26, 26, 42, 0.04)',
})

/** Lighter glass for nested elements */
export const glassInner = (opacity = 0.35): React.CSSProperties => ({
  background: `rgba(255, 255, 255, ${opacity})`,
  backdropFilter: 'blur(8px)',
  WebkitBackdropFilter: 'blur(8px)',
  border: '1px solid rgba(255, 255, 255, 0.3)',
})
