/*
 * cs16 shell — AppShell, AppHeader, CommandPalette, StatusRail.
 * Wraps every route with the global chrome.
 */

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { Icon } from './icons.jsx';
import { Button, Chip, Kbd, Panel, StatusDot } from './primitives.jsx';

const cn = (...parts) => parts.filter(Boolean).join(' ');

/* -------------------------------------------------------------------------
 * AppShell — page wrapper with header, status rail, and Suspense boundary.
 * --------------------------------------------------------------------- */
export const AppShell = ({
  brand,
  navItems = [],
  onTranscript,
  persona,
  fallback,
  children,
  className,
}) => (
  <Suspense fallback={fallback || <ShellFallback />}>
    <div
      className={cn(className)}
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--bn-bg)',
        color: 'var(--bn-text)',
        fontFamily: 'var(--bn-font-mono)',
        paddingBottom: '80px',
      }}
    >
      <AppHeader brand={brand} navItems={navItems} persona={persona} />
      <main
        className="bn-main"
        style={{
          width: '100%',
          maxWidth: 1440,
          margin: '0 auto',
          padding: '24px 20px 96px',
        }}
      >
        {children}
      </main>
      <CommandPalette navItems={navItems} />
      <StatusRail onTranscript={onTranscript} />
    </div>
  </Suspense>
);

const ShellFallback = () => (
  <div
    style={{
      minHeight: '100vh',
      display: 'grid',
      placeItems: 'center',
      color: 'var(--bn-text-2)',
      fontFamily: 'var(--bn-font-mono)',
      fontSize: 12,
      letterSpacing: '0.1em',
      textTransform: 'uppercase',
    }}
  >
    <span className="bn-row" style={{ gap: 8 }}>
      <StatusDot tone="accent" pulse />
      Loading route…
    </span>
  </div>
);

/* -------------------------------------------------------------------------
 * AppHeader
 * Brand + primary nav strip + command palette trigger + persona chip.
 * --------------------------------------------------------------------- */
export const AppHeader = ({ brand, navItems = [], persona }) => {
  const location = useLocation();
  const topNav = useMemo(() => navItems.slice(0, 6), [navItems]);

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 20,
        backgroundColor: 'var(--bn-surface)',
        borderBottom: '1px solid var(--bn-border-dark)',
        boxShadow: '0 1px 0 var(--bn-border-light)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 1440,
          margin: '0 auto',
          padding: '10px 20px',
          display: 'grid',
          gridTemplateColumns: 'auto 1fr auto',
          alignItems: 'center',
          gap: 16,
        }}
      >
        {/* Brand */}
        <Link
          to="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            color: 'var(--bn-text)',
            textDecoration: 'none',
          }}
        >
          {brand?.logoSrc ? (
            <img
              src={brand.logoSrc}
              alt=""
              width={28}
              height={28}
              style={{ imageRendering: 'pixelated' }}
            />
          ) : (
            <Icon name="globe" size={24} />
          )}
          <div style={{ display: 'grid', lineHeight: 1 }}>
            <span
              className="bn-eyebrow"
              style={{ color: 'var(--bn-text-3)', fontSize: 10 }}
            >
              {brand?.kicker || 'marketplace'}
            </span>
            <strong
              style={{
                fontFamily: 'var(--bn-font-display)',
                fontSize: 16,
                letterSpacing: '0.02em',
              }}
            >
              {brand?.title || 'BountyNet'}
            </strong>
          </div>
        </Link>

        {/* Primary nav (hidden on small screens via CSS) */}
        <nav
          aria-label="Primary"
          className="bn-row bn-header-nav"
          style={{ gap: 2, justifyContent: 'center' }}
        >
          {topNav.map((item) => {
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                style={{
                  padding: '6px 10px',
                  fontSize: 12,
                  letterSpacing: '0.04em',
                  color: active ? 'var(--bn-accent)' : 'var(--bn-text-1)',
                  textDecoration: 'none',
                  borderBottom: `2px solid ${active ? 'var(--bn-accent)' : 'transparent'}`,
                }}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Actions */}
        <div className="bn-row" style={{ gap: 8, justifyContent: 'flex-end' }}>
          {persona ? (
            <Chip tone="accent" icon="shield">
              {persona}
            </Chip>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            icon="search"
            onClick={() => openCommandPalette()}
            aria-label="Open command palette"
          >
            Jump to&nbsp;
            <Kbd>⌘K</Kbd>
          </Button>
        </div>
      </div>
    </header>
  );
};

/* -------------------------------------------------------------------------
 * CommandPalette
 * ⌘/Ctrl+K overlay with filterable nav + recents from sessionStorage.
 * --------------------------------------------------------------------- */
const commandSubscribers = new Set();
export const openCommandPalette = () => {
  commandSubscribers.forEach((fn) => fn(true));
};
export const closeCommandPalette = () => {
  commandSubscribers.forEach((fn) => fn(false));
};

const RECENT_KEY = 'bn.cmd.recent.v1';

const readRecents = () => {
  try {
    const raw = window.sessionStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeRecents = (list) => {
  try {
    window.sessionStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 5)));
  } catch {
    /* noop */
  }
};

export const CommandPalette = ({ navItems = [], extraCommands = [] }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlighted, setHighlighted] = useState(0);
  const [recents, setRecents] = useState(() =>
    typeof window === 'undefined' ? [] : readRecents(),
  );
  const inputRef = useRef(null);
  const navigate = useNavigate();

  const commands = useMemo(
    () => [
      ...navItems.map((item) => ({
        label: item.label,
        path: item.path,
        keywords: item.keywords || '',
        icon: item.icon || 'arrow',
      })),
      ...extraCommands,
    ],
    [navItems, extraCommands],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return commands;
    return commands.filter((command) =>
      `${command.label} ${command.keywords}`.toLowerCase().includes(needle),
    );
  }, [commands, query]);

  const recentCommands = useMemo(
    () =>
      recents
        .map((path) => commands.find((command) => command.path === path))
        .filter(Boolean),
    [recents, commands],
  );

  useEffect(() => {
    const toggle = (state) =>
      setOpen(typeof state === 'boolean' ? state : (prev) => !prev);
    commandSubscribers.add(toggle);
    return () => commandSubscribers.delete(toggle);
  }, []);

  useEffect(() => {
    const keyHandler = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((prev) => !prev);
      }
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', keyHandler);
    return () => window.removeEventListener('keydown', keyHandler);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery('');
      setHighlighted(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  useEffect(() => {
    setHighlighted(0);
  }, [query]);

  const run = useCallback(
    (command) => {
      if (!command) return;
      const next = [command.path, ...recents.filter((p) => p !== command.path)];
      setRecents(next);
      writeRecents(next);
      setOpen(false);
      navigate(command.path);
    },
    [navigate, recents],
  );

  const handleKey = (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlighted((h) => Math.min(h + 1, filtered.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      run(filtered[highlighted]);
    }
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-label="Command palette"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        backgroundColor: 'hsl(213 30% 6% / 0.72)',
        display: 'grid',
        placeItems: 'start center',
        padding: '12vh 16px 16px',
      }}
      onClick={() => setOpen(false)}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{ width: '100%', maxWidth: 560 }}
      >
        <Panel
          title="Command palette"
          eyebrow="jump to anything"
          actions={<Kbd>ESC</Kbd>}
          bodyClassName="bn-stack--tight"
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
              style={{ paddingLeft: 32 }}
              placeholder="type a route, agent, or command…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={handleKey}
              aria-label="Command filter"
            />
          </div>

          {!query && recentCommands.length ? (
            <CommandList
              title="recent"
              items={recentCommands}
              onSelect={run}
              startIndex={0}
              highlighted={highlighted}
            />
          ) : null}

          <CommandList
            title={query ? 'results' : 'all routes'}
            items={filtered}
            onSelect={run}
            startIndex={0}
            highlighted={highlighted}
            empty="No matches."
          />
        </Panel>
      </div>
    </div>
  );
};

const CommandList = ({ title, items, onSelect, highlighted = 0, empty }) => (
  <div style={{ display: 'grid', gap: 4 }}>
    <span className="bn-eyebrow">{title}</span>
    {items.length === 0 ? (
      <div className="bn-empty" style={{ padding: 16 }}>
        <span>{empty || 'Nothing yet.'}</span>
      </div>
    ) : (
      <ul
        role="listbox"
        style={{
          listStyle: 'none',
          padding: 0,
          margin: 0,
          display: 'grid',
          gap: 2,
          maxHeight: '42vh',
          overflowY: 'auto',
        }}
      >
        {items.map((command, index) => {
          const active = index === highlighted;
          return (
            <li key={`${command.path}-${index}`}>
              <button
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => onSelect(command)}
                className={cn('bn-btn', active && 'bn-btn--primary')}
                style={{
                  width: '100%',
                  justifyContent: 'flex-start',
                  minHeight: 32,
                  fontFamily: 'var(--bn-font-mono)',
                  fontSize: 12,
                }}
              >
                <Icon name={command.icon || 'arrow'} />
                <span style={{ flex: 1, textAlign: 'left' }}>
                  {command.label}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    color: active ? 'inherit' : 'var(--bn-text-3)',
                    letterSpacing: '0.04em',
                  }}
                >
                  {command.path}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    )}
  </div>
);

/* -------------------------------------------------------------------------
 * StatusRail
 * Bottom-fixed voice bar: level meter, status, start/stop. Inserts final
 * transcripts into the focused field and emits `onTranscript`.
 * --------------------------------------------------------------------- */
export const StatusRail = ({ onTranscript, language }) => {
  const [isListening, setIsListening] = useState(false);
  const [message, setMessage] = useState('voice idle');
  const [level, setLevel] = useState(0);
  const recognitionRef = useRef(null);
  const audioRef = useRef(null);
  const rafRef = useRef(0);
  const lastFocusedRef = useRef(null);

  useEffect(() => {
    const focusListener = (event) => {
      lastFocusedRef.current = event.target;
    };
    document.addEventListener('focusin', focusListener);
    return () => document.removeEventListener('focusin', focusListener);
  }, []);

  const insertIntoActiveField = (text) => {
    const target = document.activeElement || lastFocusedRef.current;
    if (!target || !text) return false;
    const isInput =
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement;
    if (isInput && !target.readOnly && !target.disabled) {
      const currentValue = target.value;
      const start = target.selectionStart ?? currentValue.length;
      const end = target.selectionEnd ?? start;
      const nextValue = `${currentValue.slice(0, start)}${text}${currentValue.slice(end)}`;
      const setter = Object.getOwnPropertyDescriptor(
        target instanceof HTMLTextAreaElement
          ? HTMLTextAreaElement.prototype
          : HTMLInputElement.prototype,
        'value',
      )?.set;
      if (setter) setter.call(target, nextValue);
      else target.setAttribute('value', nextValue);
      target.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    }
    if (target.isContentEditable) {
      target.append(document.createTextNode(`${text} `));
      target.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    }
    return false;
  };

  const startMeter = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const audioContext = new Ctx();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 128;
    source.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      analyser.getByteFrequencyData(data);
      const avg = data.reduce((a, b) => a + b, 0) / Math.max(data.length, 1);
      setLevel(avg / 255);
      rafRef.current = window.requestAnimationFrame(tick);
    };
    tick();
    audioRef.current = { stream, audioContext };
  };

  const stopMeter = () => {
    if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
    const current = audioRef.current;
    if (current) {
      current.stream.getTracks().forEach((track) => track.stop());
      current.audioContext.close().catch(() => {});
    }
    audioRef.current = null;
    setLevel(0);
  };

  const startListening = async () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setMessage('speech recognition unavailable');
      return;
    }
    try {
      await startMeter();
    } catch {
      setMessage('microphone blocked');
      return;
    }
    const recognition = new SR();
    recognitionRef.current = recognition;
    recognition.continuous = true;
    recognition.interimResults = true;
    if (language) recognition.lang = language;
    recognition.onstart = () => {
      setIsListening(true);
      setMessage('listening…');
    };
    recognition.onresult = (event) => {
      let finalText = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const transcript = result[0]?.transcript || '';
        if (result.isFinal) finalText += `${transcript} `;
      }
      if (finalText.trim()) {
        const text = finalText.trim();
        insertIntoActiveField(`${text} `);
        onTranscript?.(text);
        setMessage(text);
      }
    };
    recognition.onerror = (event) => {
      setMessage(`voice error: ${event.error || 'unknown'}`);
    };
    recognition.onend = () => {
      setIsListening(false);
      stopMeter();
    };
    recognition.start();
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    stopMeter();
    setIsListening(false);
  };

  const bars = [0.3, 0.55, 0.8, 0.55, 0.3].map((weight, index) => (
    <span
      key={index}
      style={{
        width: 3,
        height: `${6 + level * 28 * weight}px`,
        backgroundColor: isListening ? 'var(--bn-accent)' : 'var(--bn-text-3)',
        transition: 'height 60ms linear',
      }}
    />
  ));

  return (
    <>
      <aside
        className="bn-status-rail"
        role="region"
        aria-label="Voice status rail"
      >
        <div className="bn-row" style={{ gap: 12, minWidth: 0, flex: 1 }}>
          <StatusDot
            tone={isListening ? 'red' : 'green'}
            pulse={isListening}
            label="voice"
          />
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'flex-end',
              gap: 2,
              height: 22,
            }}
          >
            {bars}
          </span>
          <span
            className="bn-meta"
            style={{
              color: 'var(--bn-text-1)',
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
            }}
          >
            {message}
          </span>
        </div>
        <Button
          variant={isListening ? 'danger' : 'primary'}
          size="sm"
          icon="mic"
          onClick={isListening ? stopListening : startListening}
        >
          {isListening ? 'stop' : 'start voice'}
        </Button>
      </aside>
      <button
        type="button"
        aria-label={isListening ? 'Stop voice' : 'Start voice'}
        className={cn('bn-mic-fab', isListening && 'is-listening')}
        onClick={isListening ? stopListening : startListening}
      >
        <Icon name="mic" size={20} />
      </button>
      <style>{`
        .bn-status-rail {
          position: fixed;
          left: 16px;
          right: 16px;
          bottom: 14px;
          z-index: 40;
          display: none;
          align-items: center;
          gap: 16px;
          padding: 8px 12px;
          background-color: var(--bn-surface-1);
          border: 1px solid;
          border-color: var(--bn-border-light) var(--bn-border-dark) var(--bn-border-dark) var(--bn-border-light);
          max-width: 1440px;
          margin: 0 auto;
        }
        .bn-mic-fab {
          position: fixed;
          right: 16px;
          bottom: 16px;
          z-index: 50;
          display: inline-grid;
          place-items: center;
          width: 54px;
          height: 54px;
          background-color: var(--bn-surface-1);
          color: var(--bn-accent);
          border: 1px solid;
          border-color: var(--bn-border-light) var(--bn-border-dark) var(--bn-border-dark) var(--bn-border-light);
          cursor: pointer;
        }
        .bn-mic-fab.is-listening {
          color: var(--bn-red);
          animation: bn-pulse 1.2s ease-in-out infinite;
        }
        @media (min-width: 900px) {
          .bn-status-rail { display: flex; }
          .bn-mic-fab { display: none; }
        }
        @media (max-width: 899px) {
          .bn-header-nav { display: none !important; }
        }
      `}</style>
    </>
  );
};
