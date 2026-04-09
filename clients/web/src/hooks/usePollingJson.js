/**
 * Copyright IBM Corp. 2025, 2026
 *
 * This source code is licensed under the Apache-2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { startTransition, useEffect, useState } from 'react';

export const usePollingJson = (url, initialData, intervalMs = 8000) => {
  const [state, setState] = useState({
    data: initialData,
    loading: true,
    error: '',
  });

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      try {
        const response = await fetch(url, {
          headers: {
            accept: 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`Request failed: ${response.status}`);
        }

        const payload = await response.json();
        if (cancelled) {
          return;
        }

        startTransition(() => {
          setState({
            data: payload,
            loading: false,
            error: '',
          });
        });
      } catch (error) {
        if (cancelled) {
          return;
        }

        startTransition(() => {
          setState((previous) => ({
            data: previous.data,
            loading: false,
            error:
              error instanceof Error
                ? error.message
                : 'Failed to load resource',
          }));
        });
      }
    };

    poll();
    const timer = window.setInterval(() => {
      poll();
    }, intervalMs);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [intervalMs, url]);

  return state;
};
