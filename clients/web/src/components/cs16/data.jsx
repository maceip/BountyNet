/*
 * cs16 data / motion surface: Gauge, Sparkline, AnimatedNumber,
 * InfiniteSlider, PopoverCommandSelect, StatsGrid, DataTable.
 */

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Icon } from './icons.jsx';
import { Button, Chip, EmptyState, Panel } from './primitives.jsx';

const cn = (...parts) => parts.filter(Boolean).join(' ');

/* -------------------------------------------------------------------------
 * AnimatedNumber — smooth ease-out counter.
 * --------------------------------------------------------------------- */
export const AnimatedNumber = ({
  value = 0,
  format,
  className,
  duration = 420,
}) => {
  const [shown, setShown] = useState(() => Number(value) || 0);
  const previousRef = useRef(Number(value) || 0);

  useEffect(() => {
    const start = previousRef.current;
    const end = Number(value) || 0;
    const startAt = performance.now();
    let frame = 0;
    const tick = (now) => {
      const t = Math.min(1, (now - startAt) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = start + (end - start) * eased;
      setShown(next);
      if (t < 1) frame = window.requestAnimationFrame(tick);
      else previousRef.current = end;
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [value, duration]);

  const rendered = format
    ? format(shown)
    : Number.isInteger(shown)
      ? shown.toString()
      : shown.toFixed(Math.abs(shown) < 10 ? 1 : 0);

  return (
    <span
      className={cn(className)}
      style={{
        fontFamily: 'var(--bn-font-mono)',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {rendered}
    </span>
  );
};

/* -------------------------------------------------------------------------
 * Sparkline — SVG polyline + area fill, tiny axis.
 * --------------------------------------------------------------------- */
export const Sparkline = ({
  values = [],
  width = 160,
  height = 42,
  stroke = 'var(--bn-accent)',
  fill = 'hsl(193 58% 70% / 0.12)',
  className,
  showEndpoints = true,
}) => {
  const data = useMemo(() => {
    const nums = (values.length ? values : [0, 0, 0]).map(
      (v) => Number(v) || 0,
    );
    return nums.length === 1 ? [nums[0], nums[0]] : nums;
  }, [values]);
  const max = Math.max(...data);
  const min = Math.min(...data);
  const span = Math.max(1, max - min);
  const points = data.map((value, index) => {
    const x = (index / Math.max(data.length - 1, 1)) * width;
    const y = height - ((value - min) / span) * (height - 6) - 3;
    return [x, y];
  });
  const linePath = points
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x} ${y}`)
    .join(' ');
  const areaPath = `${linePath} L ${width} ${height} L 0 ${height} Z`;
  const last = points[points.length - 1];
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={cn(className)}
      style={{ display: 'block' }}
    >
      <path d={areaPath} fill={fill} />
      <path d={linePath} fill="none" stroke={stroke} strokeWidth="1.5" />
      {showEndpoints && last ? (
        <circle cx={last[0]} cy={last[1]} r="2.5" fill={stroke} />
      ) : null}
    </svg>
  );
};

/* -------------------------------------------------------------------------
 * Gauge — radial % meter with animated label.
 * --------------------------------------------------------------------- */
export const Gauge = ({
  value = 0,
  max = 100,
  label,
  unit,
  tone = 'accent',
  size = 96,
  className,
}) => {
  const ratio = Math.max(
    0,
    Math.min(1, Number(value || 0) / Math.max(1, Number(max || 1))),
  );
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const dash = circumference * ratio;
  const stroke = tone === 'accent' ? 'var(--bn-accent)' : `var(--bn-${tone})`;
  return (
    <div className={cn('bn-gauge', className)}>
      <svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        style={{ display: 'block' }}
      >
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="var(--bn-surface-3)"
          strokeWidth="8"
        />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke={stroke}
          strokeWidth="8"
          strokeLinecap="butt"
          strokeDasharray={`${dash} ${circumference - dash}`}
          transform="rotate(-90 50 50)"
          style={{ transition: 'stroke-dasharray 320ms ease-out' }}
        />
        <text
          x="50"
          y="54"
          textAnchor="middle"
          fill="var(--bn-text)"
          fontFamily="var(--bn-font-mono)"
          fontSize="22"
          fontWeight="500"
        >
          {Math.round(ratio * 100)}%
        </text>
      </svg>
      <div className="bn-gauge__meta">
        {label ? <span className="bn-eyebrow">{label}</span> : null}
        <span
          style={{
            fontFamily: 'var(--bn-font-mono)',
            fontSize: 20,
            color: 'var(--bn-text)',
          }}
        >
          <AnimatedNumber value={value} />{' '}
          <span style={{ color: 'var(--bn-text-2)' }}>/ {max}</span>
        </span>
        {unit ? (
          <span className="bn-meta" style={{ color: 'var(--bn-text-2)' }}>
            {unit}
          </span>
        ) : null}
      </div>
      <style>{`
        .bn-gauge {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr);
          gap: 14px;
          align-items: center;
        }
        .bn-gauge__meta {
          display: grid;
          gap: 2px;
        }
      `}</style>
    </div>
  );
};

/* -------------------------------------------------------------------------
 * InfiniteSlider — marquee-style horizontal feed. Items: { id, title, detail, href?, tone? }
 * --------------------------------------------------------------------- */
export const InfiniteSlider = ({
  items = [],
  speed = 28,
  pauseOnHover = true,
  renderItem,
  className,
  ariaLabel = 'Live activity',
}) => {
  const animId = useId().replace(/:/g, '');
  const merged = items.length ? [...items, ...items] : [];
  if (!merged.length) {
    return <EmptyState icon="graph" title="No activity yet." />;
  }
  return (
    <div
      className={cn(
        'bn-marquee',
        pauseOnHover && 'bn-marquee--pausable',
        className,
      )}
      role="region"
      aria-label={ariaLabel}
    >
      <style>{`
        @keyframes bn-marquee-${animId} {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .bn-marquee {
          overflow: hidden;
          position: relative;
          mask-image: linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent);
        }
        .bn-marquee__track-${animId} {
          display: inline-flex;
          gap: 12px;
          padding: 10px 12px;
          min-width: max-content;
          animation: bn-marquee-${animId} ${speed}s linear infinite;
        }
        .bn-marquee--pausable .bn-marquee__track-${animId}:hover {
          animation-play-state: paused;
        }
        .bn-marquee__item {
          min-width: 280px;
          display: grid;
          gap: 4px;
          padding: 8px 12px;
          background-color: var(--bn-surface-1);
          border: 1px solid;
          border-color: var(--bn-border-light) var(--bn-border-dark) var(--bn-border-dark) var(--bn-border-light);
          font-family: var(--bn-font-mono);
          color: var(--bn-text-1);
          text-decoration: none;
        }
        .bn-marquee__item:hover { background-color: var(--bn-surface-2); color: var(--bn-text); }
        .bn-marquee__title { color: var(--bn-text); font-size: 12px; font-weight: 500; line-height: 1.2; }
        .bn-marquee__detail { color: var(--bn-text-2); font-size: 11px; line-height: 1.3; }
      `}</style>
      <div className={`bn-marquee__track-${animId}`}>
        {merged.map((item, index) =>
          renderItem ? (
            renderItem(item, index)
          ) : (
            <ActivityItem
              key={`${item.id || item.title}-${index}`}
              item={item}
            />
          ),
        )}
      </div>
    </div>
  );
};

const ActivityItem = ({ item }) => {
  const Tag = item.href ? 'a' : 'div';
  return (
    <Tag
      className="bn-marquee__item"
      {...(item.href ? { href: item.href } : {})}
    >
      <span className="bn-row" style={{ gap: 6 }}>
        {item.tone ? (
          <span className={`bn-status-dot bn-status-dot--${item.tone}`} />
        ) : null}
        <span className="bn-marquee__title">{item.title}</span>
      </span>
      {item.detail ? (
        <span className="bn-marquee__detail">{item.detail}</span>
      ) : null}
      {item.updatedAt ? (
        <span className="bn-meta" style={{ color: 'var(--bn-text-3)' }}>
          {item.updatedAt}
        </span>
      ) : null}
    </Tag>
  );
};

/* -------------------------------------------------------------------------
 * PopoverCommandSelect — filterable dropdown with keyboard nav.
 * --------------------------------------------------------------------- */
export const PopoverCommandSelect = ({
  id,
  label,
  value,
  options = [],
  onChange,
  placeholder = 'select…',
  icon = 'chevron-down',
  disabled,
  className,
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlighted, setHighlighted] = useState(0);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return options;
    return options.filter((option) =>
      option.label.toLowerCase().includes(needle),
    );
  }, [options, query]);

  const active = options.find((option) => option.value === value);

  useEffect(() => {
    if (!open) return;
    const handler = (event) => {
      if (!containerRef.current?.contains(event.target)) setOpen(false);
    };
    window.addEventListener('mousedown', handler);
    setTimeout(() => inputRef.current?.focus(), 30);
    return () => window.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    setHighlighted(0);
  }, [query]);

  const commit = (option) => {
    if (!option) return;
    onChange?.(option.value, option);
    setOpen(false);
    setQuery('');
  };

  const handleKey = (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlighted((h) => Math.min(h + 1, filtered.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      commit(filtered[highlighted]);
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div
      className={cn(className)}
      ref={containerRef}
      style={{ position: 'relative', display: 'grid', gap: 5 }}
    >
      {label ? (
        <label htmlFor={id} className="bn-field__label">
          {label}
        </label>
      ) : null}
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={cn('bn-btn')}
        style={{
          justifyContent: 'space-between',
          width: '100%',
          minHeight: 34,
          color: active ? 'var(--bn-text)' : 'var(--bn-text-2)',
        }}
      >
        <span
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {active?.label || placeholder}
        </span>
        <Icon name={icon} />
      </button>
      {open ? (
        <div
          role="listbox"
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            zIndex: 30,
            backgroundColor: 'var(--bn-surface-1)',
            border: '1px solid var(--bn-border-light)',
            borderTopColor: 'var(--bn-border-light)',
            borderLeftColor: 'var(--bn-border-light)',
            borderRightColor: 'var(--bn-border-dark)',
            borderBottomColor: 'var(--bn-border-dark)',
            padding: 8,
            display: 'grid',
            gap: 6,
          }}
        >
          <div style={{ position: 'relative' }}>
            <Icon
              name="search"
              style={{
                position: 'absolute',
                top: 10,
                left: 10,
                color: 'var(--bn-text-2)',
              }}
            />
            <input
              ref={inputRef}
              className="bn-input"
              style={{ paddingLeft: 30 }}
              placeholder="type to filter…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={handleKey}
            />
          </div>
          <div
            style={{
              display: 'grid',
              gap: 2,
              maxHeight: 200,
              overflowY: 'auto',
            }}
          >
            {filtered.length ? (
              filtered.map((option, index) => (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={index === highlighted}
                  className={cn(
                    'bn-btn',
                    index === highlighted && 'bn-btn--primary',
                  )}
                  style={{
                    justifyContent: 'flex-start',
                    minHeight: 30,
                    fontSize: 12,
                  }}
                  onClick={() => commit(option)}
                  onMouseEnter={() => setHighlighted(index)}
                >
                  {option.icon ? <Icon name={option.icon} /> : null}
                  <span style={{ flex: 1, textAlign: 'left' }}>
                    {option.label}
                  </span>
                  {option.hint ? (
                    <span
                      className="bn-meta"
                      style={{ color: 'inherit', opacity: 0.7 }}
                    >
                      {option.hint}
                    </span>
                  ) : null}
                </button>
              ))
            ) : (
              <div className="bn-empty" style={{ padding: 16 }}>
                <span>No matches.</span>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};

/* -------------------------------------------------------------------------
 * StatsGrid — uniform grid of AnimatedNumber tiles.
 * tiles: [{ key, label, value, format?, delta?, tone? }]
 * --------------------------------------------------------------------- */
export const StatsGrid = ({ tiles = [], columns, className }) => (
  <div
    className={cn(className)}
    data-columns={columns}
    style={{
      display: 'grid',
      gridTemplateColumns: `repeat(auto-fit, minmax(min(200px, 100%), 1fr))`,
      gap: 12,
    }}
  >
    {tiles.map((tile) => (
      <div
        key={tile.key || tile.label}
        className="bn-panel"
        style={{
          display: 'grid',
          gap: 6,
          padding: 12,
        }}
      >
        <span className="bn-eyebrow">{tile.label}</span>
        <div className="bn-row" style={{ gap: 8, alignItems: 'baseline' }}>
          <AnimatedNumber
            value={tile.value}
            format={tile.format}
            className="bn-stat-number"
          />
          {tile.unit ? (
            <span className="bn-meta" style={{ color: 'var(--bn-text-2)' }}>
              {tile.unit}
            </span>
          ) : null}
          {tile.delta != null ? (
            <Chip tone={tile.delta >= 0 ? 'green' : 'red'}>
              {tile.delta >= 0 ? '▲' : '▼'} {Math.abs(tile.delta)}
            </Chip>
          ) : null}
        </div>
        {tile.hint ? (
          <span className="bn-meta" style={{ color: 'var(--bn-text-2)' }}>
            {tile.hint}
          </span>
        ) : null}
      </div>
    ))}
    <style>{`
      .bn-stat-number {
        font-family: var(--bn-font-mono);
        font-size: 26px;
        font-weight: 500;
        color: var(--bn-text);
        letter-spacing: -0.01em;
      }
    `}</style>
  </div>
);

/* -------------------------------------------------------------------------
 * DataTable — borderless inner rows, sticky header. columns: [{ key, label, render?, width?, align? }]
 * --------------------------------------------------------------------- */
export const DataTable = ({
  columns = [],
  rows = [],
  onRowClick,
  rowKey = (row, index) => row.id ?? index,
  empty,
  className,
}) => (
  <div className={cn('bn-table-wrap', className)}>
    {rows.length === 0 ? (
      <EmptyState
        title={empty?.title || 'No records.'}
        description={empty?.description}
        icon={empty?.icon || 'graph'}
      />
    ) : (
      <table className="bn-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                style={{
                  width: column.width,
                  textAlign: column.align || 'left',
                }}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={rowKey(row, index)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              style={onRowClick ? { cursor: 'pointer' } : undefined}
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  style={{ textAlign: column.align || 'left' }}
                >
                  {column.render ? column.render(row) : row[column.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    )}
    <style>{`
      .bn-table-wrap {
        border: 1px solid;
        border-color: var(--bn-border-light) var(--bn-border-dark) var(--bn-border-dark) var(--bn-border-light);
        background-color: var(--bn-surface-1);
        overflow: auto;
      }
      .bn-table {
        width: 100%;
        border-collapse: collapse;
        font-family: var(--bn-font-mono);
        font-size: 12px;
      }
      .bn-table thead th {
        position: sticky;
        top: 0;
        z-index: 1;
        padding: 8px 12px;
        background-color: var(--bn-surface-2);
        color: var(--bn-text-2);
        font-size: 11px;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        border-bottom: 1px solid var(--bn-border-dark);
        box-shadow: 0 1px 0 var(--bn-border-light);
      }
      .bn-table tbody td {
        padding: 8px 12px;
        color: var(--bn-text);
        border-bottom: 1px solid var(--bn-border-dark);
      }
      .bn-table tbody tr:hover td { background-color: var(--bn-surface-2); }
      .bn-table tbody tr:last-child td { border-bottom: 0; }
    `}</style>
  </div>
);

/* -------------------------------------------------------------------------
 * Tabs — controlled panels with CS16 accent underline.
 * tabs: [{ id, label, icon?, disabled? }]
 * --------------------------------------------------------------------- */
export const Tabs = ({ tabs = [], value, onChange, children, className }) => {
  const [internal, setInternal] = useState(tabs[0]?.id);
  const current = value !== undefined ? value : internal;
  const setCurrent = useCallback(
    (next) => {
      if (onChange) onChange(next);
      else setInternal(next);
    },
    [onChange],
  );
  return (
    <div className={cn(className)} style={{ display: 'grid', gap: 12 }}>
      <div
        role="tablist"
        className="bn-row"
        style={{
          gap: 0,
          borderBottom: '1px solid var(--bn-border-dark)',
          boxShadow: '0 1px 0 var(--bn-border-light)',
        }}
      >
        {tabs.map((tab) => {
          const active = tab.id === current;
          return (
            <button
              key={tab.id}
              role="tab"
              type="button"
              aria-selected={active}
              disabled={tab.disabled}
              onClick={() => setCurrent(tab.id)}
              className="bn-btn bn-btn--ghost"
              style={{
                minHeight: 34,
                padding: '8px 14px',
                borderBottom: `2px solid ${active ? 'var(--bn-accent)' : 'transparent'}`,
                color: active ? 'var(--bn-accent)' : 'var(--bn-text-1)',
                borderRadius: 0,
              }}
            >
              {tab.icon ? <Icon name={tab.icon} /> : null}
              {tab.label}
            </button>
          );
        })}
      </div>
      <div role="tabpanel">
        {typeof children === 'function' ? children(current) : children}
      </div>
    </div>
  );
};
