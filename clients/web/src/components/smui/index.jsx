import { Children, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { navItems } from '../../routes/config.js';

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
    <div className="border-b border-border px-3 py-2 text-[10px] uppercase tracking-[1.5px] text-muted-foreground">
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
        <p className="text-[10px] uppercase tracking-[1.5px] text-muted-foreground">{label}</p>
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
  return (
    <div className="overflow-hidden border border-border bg-card">
      <div className="bn-infinite-slider flex w-max gap-4 px-3 py-2">
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
      {label ? <label htmlFor={id}>{label}</label> : null}
      <button id={id} type="button" onClick={() => setOpen((v) => !v)} className="text-left">
        {active?.label || placeholder}
      </button>
      {open ? (
        <div className="absolute z-30 mt-1 w-full border border-border bg-card p-2">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="type to filter..."
          />
          <div className="mt-2 max-h-40 overflow-auto">
            {filtered.map((option) => (
              <button
                key={option.value}
                type="button"
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
      const saved = window.localStorage.getItem(`bn.panes.${persistKey}`);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return [33, 34, 33];
  });
  const dragRef = useRef(null);

  useEffect(() => {
    window.localStorage.setItem(`bn.panes.${persistKey}`, JSON.stringify(sizes));
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
    <p className="mb-2 text-[10px] uppercase tracking-[1.5px] text-muted-foreground">{title}</p>
    <textarea rows={8} value={value} onChange={(event) => onChange(event.target.value)} />
    <button type="button" onClick={onSend}>
      Send
    </button>
  </div>
);

const commandSubscribers = new Set();
export const openCommandPalette = () => {
  commandSubscribers.forEach((fn) => fn(true));
};

export const CommandPalette = () => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const commands = navItems.map((item) => ({ label: item.label, path: item.path }));

  useEffect(() => {
    const toggle = (state) => setOpen(state);
    commandSubscribers.add(toggle);
    const keyHandler = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', keyHandler);
    return () => {
      commandSubscribers.delete(toggle);
      window.removeEventListener('keydown', keyHandler);
    };
  }, []);

  const filtered = commands.filter((command) =>
    command.label.toLowerCase().includes(query.toLowerCase()),
  );
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/80 p-4">
      <div className="w-full max-w-xl border border-border bg-card p-3">
        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="jump to route..."
        />
        <div className="mt-2 max-h-80 overflow-auto">
          {filtered.map((command) => (
            <button
              key={command.path}
              type="button"
              onClick={() => {
                navigate(command.path);
                setOpen(false);
                setQuery('');
              }}
            >
              {command.label}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => setOpen(false)}>
          Close
        </button>
      </div>
    </div>
  );
};

export const StatusRail = ({ onTranscript }) => {
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
    const isInput = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
    if (isInput && !target.readOnly && !target.disabled) {
      const start = target.selectionStart ?? target.value.length;
      const end = target.selectionEnd ?? start;
      target.value = `${target.value.slice(0, start)}${text}${target.value.slice(end)}`;
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
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
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
    await startMeter();
    const recognition = new SR();
    recognitionRef.current = recognition;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onstart = () => {
      setIsListening(true);
      setMessage('listening...');
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

  const bars = [0.2, 0.4, 0.6, 0.8].map((m, idx) => (
    <div
      key={idx}
      className="w-1 bg-primary transition-[height]"
      style={{ height: `${8 + level * 26 * (idx % 2 === 0 ? 1 : 0.8) * m}px` }}
    />
  ));

  return (
    <>
      <aside className="fixed right-3 bottom-3 left-3 z-40 hidden border border-border bg-card px-3 py-2 fold:flex fold:items-center fold:justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-[1.5px] text-muted-foreground">
            status rail
          </span>
          <div className="flex items-end gap-1">{bars}</div>
          <span className="max-w-[32rem] truncate text-xs text-muted-foreground">{message}</span>
        </div>
        <button
          type="button"
          onClick={isListening ? stopListening : startListening}
          className={cn(isListening ? 'animate-pulse border-destructive' : '')}
        >
          {isListening ? 'stop voice' : 'start voice'}
        </button>
      </aside>
      <button
        type="button"
        className={cn(
          'fixed right-4 bottom-4 z-50 h-20 w-20 border-2 border-destructive bg-card text-xs fold:hidden',
          isListening ? 'animate-pulse' : '',
        )}
        onClick={isListening ? stopListening : startListening}
      >
        mic
      </button>
    </>
  );
};
