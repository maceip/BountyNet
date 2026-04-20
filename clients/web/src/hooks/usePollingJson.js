/**
 * Copyright IBM Corp. 2025, 2026
 *
 * This source code is licensed under the Apache-2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { startTransition, useCallback, useEffect, useRef, useState } from 'react';

export const usePollingJson = (url, initialData, intervalMs = 8000) => {
  const [state, setState] = useState({
    data: initialData,
    loading: true,
    error: '',
  });
  const cancelRef = useRef(false);
  const versionRef = useRef(0);

  const poll = useCallback(async () => {
    const version = (versionRef.current += 1);
    try {
      const response = await fetch(url, {
        headers: { accept: 'application/json' },
      });
      if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
      }
      const payload = await response.json();
      if (cancelRef.current || version !== versionRef.current) return;
      startTransition(() => {
        setState({ data: payload, loading: false, error: '' });
      });
    } catch (error) {
      if (cancelRef.current || version !== versionRef.current) return;
      startTransition(() => {
        setState((previous) => ({
          data: previous.data,
          loading: false,
          error:
            error instanceof Error ? error.message : 'Failed to load resource',
        }));
      });
    }
  }, [url]);

  useEffect(() => {
    cancelRef.current = false;
    poll();
    const timer = window.setInterval(() => {
      poll();
    }, intervalMs);
    return () => {
      cancelRef.current = true;
      window.clearInterval(timer);
    };
  }, [poll, intervalMs]);

  const refresh = useCallback(() => {
    setState((previous) => ({ ...previous, loading: true }));
    return poll();
  }, [poll]);

  return { ...state, refresh };
};
