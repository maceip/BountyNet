import { Children, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { navItems } from '../../routes/config.js';

// Bridge: routes still wired to the legacy smui CommandPalette/StatusRail get
// the redesigned cs16 versions. New code should import directly from
// '../cs16/index.js'.
export {
  CommandPalette,
  StatusRail,
  openCommandPalette,
  closeCommandPalette,
} from '../cs16/index.js';

const cn = (...parts) => parts.filter(Boolean).join(' ');

export const CodeLine = ({ children, className = '' }) => (
  <code
    className={cn(
      'block w-full overflow-x-auto border border-border bg-secondary/40 px-3 py-2 text-xs text-foreground',
      className,
    )}
  >
    {children}
  </code>
);

export const Terminal = ({ title = 'output', content = '', className = '' }) => (
  <div className={cn('mt-2 border border-border bg-card', className)}>
    <div className="border-b border-border px-3 py-2 text-label">
      {title}
    </div>
    <pre className="max-h-72 overflow-auto px-3 py-2 text-xs whitespace-pre-wrap break-words">
      {typeof content === 'string' ? content : JSON.stringify(content ?? {}, null, 2)}
    </pre>
  </div>
);

export const AnimatedNumber = ({ value = 0, className = '' }) => {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const start = shown;
    const end = Number(value || 0);
    const startAt = performance.now();
    const duration = 450;
    let frame = 0;
    const tick = (now) => {
      const t = Math.min(1, (now - startAt) / duration);
      setShown(start + (end - start) * t);
      if (t < 1) {
        frame = window.requestAnimationFrame(tick);
      }
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  return <span className={className}>{Math.round(shown * 100) / 100}</span>;
};

export const Sparkline = ({ values = [], className = '' }) => {
  const data = (values.length ? values : [1, 2, 1, 3, 2, 4]).map((n) => Number(n || 0));
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const points = data
    .map((v, i) => {
      const x = (i / Math.max(data.length - 1, 1)) * 100;
      const y = 100 - ((v - min) / Math.max(max - min, 1)) * 100;
      return `${x},${y}`;
    })
    .join(' ');
  return (
    <svg viewBox="0 0 100 100" className={cn('h-10 w-full', className)}>
      <polyline
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth="4"
        points={points}
      />
    </svg>
  );
};

export const Gauge = ({ value = 0, max = 100, label = '', className = '' }) => {
  const ratio = Math.max(0, Math.min(1, Number(value || 0) / Math.max(1, Number(max || 1))));
  const dash = 251.2 * ratio;
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <svg viewBox="0 0 100 100" className="h-16 w-16">
        <circle cx="50" cy="50" r="40" fill="none" stroke="hsl(var(--muted))" strokeWidth="10" />
        <circle
          cx="50"
          cy="50"
          r="40"
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="10"
          strokeDasharray={`${dash} 251.2`}
          transform="rotate(-90 50 50)"
        />
      </svg>
      <div>
        <p className="text-label">{label}</p>
        <AnimatedNumber value={value} className="text-xl font-semibold text-foreground" />
      </div>
    </div>
  );
};

export const CommitGraph = ({ seed = '' }) => {
  const columns = useMemo(() => {
    const text = String(seed || 'seed');
    return Array.from({ length: 24 }).map((_, i) => {
      const code = text.charCodeAt(i % text.length) || 1;
      return (code * (i + 5)) % 5;
    });
  }, [seed]);
  return (
    <div className="grid grid-cols-12 gap-1">
      {columns.map((value, idx) => (
        <div
          key={`${seed}-${idx}`}
          className="h-3 border border-border"
          style={{ opacity: 0.2 + value * 0.18, background: 'hsl(var(--primary))' }}
        />
      ))}
    </div>
  );
};

export const RepoCard = ({ repo }) => (
  <article className="mt-2 border border-border bg-card px-3 py-2">
    <p className="text-sm font-semibold">{repo.repo_full_name}</p>
    <p className="text-xs text-muted-foreground">
      {repo.status || 'unknown'} {repo.installation_id ? `· installation #${repo.installation_id}` : ''}
    </p>
    <CommitGraph seed={repo.repo_full_name} />
  </article>
);

export const InfiniteSlider = ({ items = [] }) => {
  const merged = [...items, ...items];
  const animationName = 'smui-infinite-slider';
  return (
    <div className="overflow-hidden border border-border bg-card">
      <style>{`@keyframes ${animationName} {0% {transform: translateX(0)} 100% {transform: translateX(-50%)}}`}</style>
      <div
        className="flex w-max gap-4 px-3 py-2 hover:[animation-play-state:paused]"
        style={{ animation: `${animationName} 24s linear infinite` }}
      >
        {merged.map((item, idx) => (
          <div key={`${item.id || item.title}-${idx}`} className="min-w-[20rem] border border-border bg-secondary/30 p-2">
            <p className="text-sm font-semibold">{item.title}</p>
            <p className="text-xs text-muted-foreground">{item.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export const PopoverCommandSelect = ({
  id,
  label,
  value,
  options = [],
  onChange,
  placeholder = 'select',
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const filtered = options.filter((option) =>
    option.label.toLowerCase().includes(query.toLowerCase()),
  );
  const active = options.find((option) => option.value === value);
  return (
    <div className="relative">
      {label ? <label htmlFor={id} className="text-label">{label}</label> : null}
      <button
        id={id}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mt-1 w-full border border-input bg-secondary px-3 py-2 text-left text-sm"
      >
        {active?.label || placeholder}
      </button>
      {open ? (
        <div className="absolute z-30 mt-1 w-full border border-border bg-card p-2">
          <input
            className="w-full border border-input bg-secondary px-3 py-2 text-sm"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="type to filter..."
          />
          <div className="mt-2 max-h-40 overflow-auto">
            {filtered.map((option) => (
              <button
                key={option.value}
                type="button"
                className="w-full border border-border bg-secondary/30 px-2 py-2 text-left text-sm hover:bg-primary/10"
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                  setQuery('');
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
};

export const Pane = ({ children }) => <div className="min-w-0 overflow-auto">{children}</div>;
export const PaneHandle = () => <div className="w-2 shrink-0 border-x border-border bg-secondary/40" />;

export const PaneGroup = ({ children, persistKey = 'pane-group' }) => {
  const panes = useMemo(
    () => Children.toArray(children).filter((child) => child && child.type === Pane),
    [children],
  );
  const [sizes, setSizes] = useState(() => {
    try {
      const saved = window.localStorage.getItem(`smui.panes.${persistKey}`);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return [33, 34, 33];
  });
  const dragRef = useRef(null);

  useEffect(() => {
    window.localStorage.setItem(`smui.panes.${persistKey}`, JSON.stringify(sizes));
  }, [persistKey, sizes]);

  const startDrag = (index, event) => {
    dragRef.current = { index, startX: event.clientX, sizes };
    const onMove = (moveEvent) => {
      if (!dragRef.current) return;
      const delta = (moveEvent.clientX - dragRef.current.startX) / 8;
      setSizes((current) => {
        const next = [...current];
        next[index] = Math.max(15, Math.min(70, current[index] + delta));
        next[index + 1] = Math.max(15, Math.min(70, current[index + 1] - delta));
        return next;
      });
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  return (
    <div className="flex min-h-[28rem] gap-2">
      {panes.map((pane, index) => (
        <div key={index} style={{ width: `${sizes[index] || 33}%` }} className="min-w-0">
          {pane}
          {index < panes.length - 1 ? (
            <button
              type="button"
              aria-label="Resize pane"
              className="mt-2 h-4 w-full border border-border bg-secondary/30"
              onPointerDown={(event) => startDrag(index, event)}
            />
          ) : null}
        </div>
      ))}
    </div>
  );
};

export const Chat = ({ value, onChange, onSend, title = 'chat' }) => (
  <div className="border border-border bg-card p-3">
    <p className="mb-2 text-label">{title}</p>
    <textarea
      rows={8}
      className="w-full border border-input bg-secondary px-3 py-2 text-sm"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
    <button type="button" className="mt-2 border border-primary bg-primary/20 px-3 py-2 text-sm hover:bg-primary/30" onClick={onSend}>
      send
    </button>
  </div>
);

