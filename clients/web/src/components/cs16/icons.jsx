/*
 * cs16 icon set — pixel-friendly SVGs that share a single 14x14 visual
 * rhythm. Every icon uses `fill="currentColor"` / `stroke="currentColor"`
 * so they inherit from the parent's text color.
 */

const PATHS = {
  chevron: <path d="M3 2 L3 8 L7 5 Z" fill="currentColor" />,
  'chevron-down': <path d="M2 4 L8 4 L5 8 Z" fill="currentColor" />,
  folder: <path d="M1 2 h5 l2 2 h7 v9 h-14 z" fill="currentColor" />,
  'folder-open': (
    <path
      d="M1 2 h5 l2 2 h7 v2 h-11 l-3 7 h-1 z M15 6 l-2 7 h-12 l2 -7 z"
      fill="currentColor"
    />
  ),
  file: <path d="M1 1 h7 l3 3 v9 h-10 z M8 1 v3 h3" fill="currentColor" />,
  copy: (
    <path d="M3 1 h8 v2 h-6 v8 h-2 z M5 3 h8 v10 h-8 z" fill="currentColor" />
  ),
  check: <path d="M2 7 l3 3 l7 -7 l-1 -1 l-6 6 l-2 -2 z" fill="currentColor" />,
  x: <path d="M3 3 l8 8 M11 3 l-8 8" stroke="currentColor" strokeWidth="1.5" />,
  search: (
    <>
      <circle
        cx="6"
        cy="6"
        r="3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <path d="M9 9 l4 4" stroke="currentColor" strokeWidth="1.3" />
    </>
  ),
  star: (
    <path
      d="M7 1 l1.7 4 l4.3 0.3 l-3.3 2.8 l1 4.4 l-3.7 -2.3 l-3.7 2.3 l1 -4.4 l-3.3 -2.8 l4.3 -0.3 z"
      fill="currentColor"
    />
  ),
  fork: (
    <path
      d="M3 1 h2 v3 h-2 z M9 1 h2 v3 h-2 z M3 10 h2 v3 h-2 z M4 4 v2 c0 1.5 6 1.5 6 3 M4 6 v4 M10 4 v2"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
    />
  ),
  eye: (
    <path
      d="M1 7 c3 -5 11 -5 14 0 c-3 5 -11 5 -14 0 z M8 4 a3 3 0 1 0 0.01 0 z"
      fill="currentColor"
    />
  ),
  repo: (
    <path
      d="M2 1 h10 v11 h-9 a1 1 0 0 1 -1 -1 z M4 3 h6 v5 h-6 z M3 11 h9 v2 h-9 z"
      fill="currentColor"
    />
  ),
  branch: (
    <path
      d="M3 1 h2 v3 h-2 z M9 1 h2 v3 h-2 z M3 10 h2 v3 h-2 z M4 4 v6 M10 4 c0 3 -6 2 -6 3"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
    />
  ),
  tag: (
    <path
      d="M1 7 l6 -6 h8 v8 l-6 6 z M12 4 h1.5 v1.5 h-1.5 z"
      fill="currentColor"
    />
  ),
  commit: (
    <>
      <circle
        cx="7"
        cy="7"
        r="3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path d="M0 6 h3 v2 h-3 z M11 6 h3 v2 h-3 z" fill="currentColor" />
    </>
  ),
  terminal: (
    <path
      d="M1 2 h12 v10 h-12 z M3 5 l2 2 l-2 2 M7 9 h4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
    />
  ),
  plus: (
    <path
      d="M6 2 h2 v4 h4 v2 h-4 v4 h-2 v-4 h-4 v-2 h4 z"
      fill="currentColor"
    />
  ),
  minus: <path d="M2 6 h10 v2 h-10 z" fill="currentColor" />,
  mic: (
    <path
      d="M6 1 h2 c1 0 2 1 2 2 v4 c0 1 -1 2 -2 2 h-2 c-1 0 -2 -1 -2 -2 v-4 c0 -1 1 -2 2 -2 z M3 7 v1 c0 2 2 4 4 4 s4 -2 4 -4 v-1 M7 11 v2"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
    />
  ),
  bolt: <path d="M8 1 L3 8 h3 l-1 5 l5 -7 h-3 l1 -5 z" fill="currentColor" />,
  arrow: (
    <path
      d="M1 6 h9 l-3 -3 l1 -1 l5 5 l-5 5 l-1 -1 l3 -3 h-9 z"
      fill="currentColor"
    />
  ),
  dot: <circle cx="7" cy="7" r="3.5" fill="currentColor" />,
  bell: (
    <path
      d="M7 1 a3 3 0 0 1 3 3 v3 l1 2 h-8 l1 -2 v-3 a3 3 0 0 1 3 -3 z M6 10 h2 v1 a1 1 0 0 1 -2 0 z"
      fill="currentColor"
    />
  ),
  shield: (
    <path
      d="M7 1 l5 2 v4 c0 3 -2 5 -5 6 c-3 -1 -5 -3 -5 -6 v-4 z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
    />
  ),
  cpu: (
    <>
      <rect
        x="3"
        y="3"
        width="8"
        height="8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <rect x="5" y="5" width="4" height="4" fill="currentColor" />
      <path
        d="M5 1 v2 M9 1 v2 M5 11 v2 M9 11 v2 M1 5 h2 M1 9 h2 M11 5 h2 M11 9 h2"
        stroke="currentColor"
        strokeWidth="1.2"
      />
    </>
  ),
  graph: (
    <path
      d="M1 13 h12 M3 10 v3 M6 6 v7 M9 8 v5 M12 3 v10"
      stroke="currentColor"
      strokeWidth="1.4"
    />
  ),
  globe: (
    <>
      <circle
        cx="7"
        cy="7"
        r="5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <path
        d="M2 7 h10 M7 2 c2 2 2 8 0 10 M7 2 c-2 2 -2 8 0 10"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
      />
    </>
  ),
};

const VIEWBOX = '0 0 14 14';

export const Icon = ({ name, className = '', size, style }) => {
  const glyph = PATHS[name];
  const finalStyle = size ? { ...style, width: size, height: size } : style;
  return (
    <span
      className={['bn-icon', `bn-icon--${name}`, className]
        .filter(Boolean)
        .join(' ')}
      style={finalStyle}
      aria-hidden="true"
    >
      <svg viewBox={VIEWBOX} focusable="false">
        {glyph || null}
      </svg>
    </span>
  );
};

export const iconNames = Object.keys(PATHS);
