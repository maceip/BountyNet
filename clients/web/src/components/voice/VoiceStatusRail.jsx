import { useEffect, useMemo, useRef, useState } from 'react';
import {
  consumeVoiceTranscript,
  getVoiceInbox,
  pushVoiceTranscript,
} from '../../utils/voiceInbox.js';

const getSpeechRecognition = () => {
  if (typeof window === 'undefined') {
    return null;
  }
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
};

const canReceiveText = (element) => {
  if (!element) {
    return false;
  }
  if (element instanceof HTMLInputElement) {
    const disallowed = ['checkbox', 'radio', 'file', 'button', 'submit', 'reset', 'image'];
    return !disallowed.includes((element.type || '').toLowerCase()) && !element.readOnly && !element.disabled;
  }
  if (element instanceof HTMLTextAreaElement) {
    return !element.readOnly && !element.disabled;
  }
  return element.isContentEditable === true;
};

const insertTextAtCaret = (element, text) => {
  if (!canReceiveText(element) || !text) {
    return false;
  }

  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    const start = element.selectionStart ?? element.value.length;
    const end = element.selectionEnd ?? start;
    const prefix = element.value.slice(0, start);
    const suffix = element.value.slice(end);
    const glue = prefix && !prefix.endsWith(' ') ? ' ' : '';
    const insertion = `${glue}${text}`;
    element.value = `${prefix}${insertion}${suffix}`;
    const nextPos = prefix.length + insertion.length;
    element.selectionStart = nextPos;
    element.selectionEnd = nextPos;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  if (element.isContentEditable) {
    const selection = window.getSelection();
    const node = document.createTextNode(`${text} `);
    if (!selection || selection.rangeCount === 0) {
      element.append(node);
    } else {
      const range = selection.getRangeAt(0);
      range.insertNode(node);
      range.setStartAfter(node);
      range.setEndAfter(node);
      selection.removeAllRanges();
      selection.addRange(range);
    }
    element.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }

  return false;
};

export const VoiceStatusRail = () => {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Voice ready');
  const [inboxState, setInboxState] = useState(() => getVoiceInbox());
  const recognitionRef = useRef(null);
  const lastFocusedRef = useRef(null);
  const partialRef = useRef('');

  const pendingCount = inboxState.pending.length;

  const activeInputAvailable = useMemo(() => {
    if (typeof document === 'undefined') {
      return false;
    }
    return canReceiveText(document.activeElement) || canReceiveText(lastFocusedRef.current);
  }, [inboxState.updatedAt, isListening]);

  useEffect(() => {
    const SpeechRecognitionCtor = getSpeechRecognition();
    setIsSupported(Boolean(SpeechRecognitionCtor));

    const handleFocus = (event) => {
      if (canReceiveText(event.target)) {
        lastFocusedRef.current = event.target;
      }
    };

    const handleInboxUpdate = (event) => {
      setInboxState(event.detail || getVoiceInbox());
    };

    document.addEventListener('focusin', handleFocus);
    window.addEventListener('bn:voice-inbox-updated', handleInboxUpdate);
    return () => {
      document.removeEventListener('focusin', handleFocus);
      window.removeEventListener('bn:voice-inbox-updated', handleInboxUpdate);
      if (recognitionRef.current) {
        recognitionRef.current.onresult = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.onerror = null;
      }
    };
  }, []);

  const pushToTargetOrQueue = (text) => {
    const target = canReceiveText(document.activeElement)
      ? document.activeElement
      : lastFocusedRef.current;
    if (target && insertTextAtCaret(target, text)) {
      setStatusMessage('Voice inserted into selected field');
      return;
    }
    pushVoiceTranscript(text, 'voice-capture');
    setInboxState(getVoiceInbox());
    setStatusMessage('Stored for agent track handoff');
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  };

  const startListening = () => {
    const SpeechRecognitionCtor = getSpeechRecognition();
    if (!SpeechRecognitionCtor) {
      setStatusMessage('Voice input not supported in this browser');
      return;
    }
    if (isListening) {
      stopListening();
      return;
    }

    partialRef.current = '';
    const recognition = new SpeechRecognitionCtor();
    recognitionRef.current = recognition;
    recognition.lang = 'en-US';
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = () => {
      setIsListening(true);
      setStatusMessage('Listening...');
    };

    recognition.onresult = (event) => {
      let finalChunk = '';
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const transcript = event.results[i][0]?.transcript || '';
        if (event.results[i].isFinal) {
          finalChunk += `${transcript} `;
        } else {
          interim += `${transcript} `;
        }
      }
      partialRef.current = interim.trim();
      if (finalChunk.trim()) {
        pushToTargetOrQueue(finalChunk.trim());
      } else if (interim.trim()) {
        setStatusMessage(`Listening: ${interim.trim().slice(0, 48)}...`);
      }
    };

    recognition.onerror = (event) => {
      setStatusMessage(`Voice error: ${event.error || 'unknown'}`);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      if (partialRef.current) {
        pushToTargetOrQueue(partialRef.current);
        partialRef.current = '';
      } else if (statusMessage === 'Listening...') {
        setStatusMessage('Voice stopped');
      }
    };

    recognition.start();
  };

  const insertQueued = () => {
    const next = consumeVoiceTranscript();
    if (!next?.text) {
      setInboxState(getVoiceInbox());
      setStatusMessage('No queued voice text');
      return;
    }
    const target = canReceiveText(document.activeElement)
      ? document.activeElement
      : lastFocusedRef.current;
    if (target && insertTextAtCaret(target, next.text)) {
      setInboxState(getVoiceInbox());
      setStatusMessage('Queued voice inserted');
      return;
    }
    pushVoiceTranscript(next.text, next.source || 'voice-capture');
    setInboxState(getVoiceInbox());
    setStatusMessage('Select an input first to insert queued text');
  };

  return (
    <>
      <aside className="bn-status-rail" aria-live="polite">
        <div className="bn-status-rail__left">
          <span className="bn-status-pill">{isListening ? 'VOICE ACTIVE' : 'VOICE READY'}</span>
          <span className="bn-status-text">{statusMessage}</span>
          {pendingCount > 0 ? <span className="bn-status-queue">{pendingCount} queued</span> : null}
        </div>
        <div className="bn-status-rail__right">
          <button
            type="button"
            className={`bn-voice-button ${isListening ? 'is-listening' : ''}`}
            onClick={startListening}
            disabled={!isSupported}
          >
            <span className="bn-voice-button__label">{isListening ? 'Stop Voice' : 'Start Voice'}</span>
            <span className="bn-voice-wave" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
            </span>
          </button>
          <button
            type="button"
            className="bn-voice-insert"
            onClick={insertQueued}
            disabled={pendingCount === 0 || !activeInputAvailable}
          >
            Insert queued
          </button>
        </div>
      </aside>

      <button
        type="button"
        className={`bn-voice-fab ${isListening ? 'is-listening' : ''}`}
        onClick={startListening}
        disabled={!isSupported}
        aria-label={isListening ? 'Stop voice capture' : 'Start voice capture'}
      >
        <span className="bn-voice-fab__mic" aria-hidden="true">
          &#127908;
        </span>
        <span className="bn-voice-wave" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
        </span>
      </button>
    </>
  );
};
