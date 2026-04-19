const STORAGE_KEY = 'bn.voice.inbox.v1';

const readState = () => {
  if (typeof window === 'undefined') {
    return { pending: [], lastTranscript: '', updatedAt: '' };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { pending: [], lastTranscript: '', updatedAt: '' };
    }
    const parsed = JSON.parse(raw);
    return {
      pending: Array.isArray(parsed.pending) ? parsed.pending : [],
      lastTranscript: typeof parsed.lastTranscript === 'string' ? parsed.lastTranscript : '',
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : '',
    };
  } catch {
    return { pending: [], lastTranscript: '', updatedAt: '' };
  }
};

const writeState = (next) => {
  if (typeof window === 'undefined') {
    return next;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent('bn:voice-inbox-updated', { detail: next }));
  return next;
};

export const getVoiceInbox = () => readState();

export const pushVoiceTranscript = (text, source = 'voice') => {
  const trimmed = String(text || '').trim();
  if (!trimmed) {
    return readState();
  }
  const state = readState();
  const next = {
    pending: [...state.pending, { text: trimmed, source, at: new Date().toISOString() }],
    lastTranscript: trimmed,
    updatedAt: new Date().toISOString(),
  };
  return writeState(next);
};

export const consumeVoiceTranscript = () => {
  const state = readState();
  const [head, ...rest] = state.pending;
  const next = {
    pending: rest,
    lastTranscript: state.lastTranscript,
    updatedAt: new Date().toISOString(),
  };
  writeState(next);
  return head || null;
};

export const clearVoiceInbox = () => {
  const next = { pending: [], lastTranscript: '', updatedAt: new Date().toISOString() };
  return writeState(next);
};
