/**
 * Copyright IBM Corp. 2025, 2026
 *
 * This source code is licensed under the Apache-2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { Button, InlineLoading, SkeletonText, Tag, Tile } from '@carbon/react';
import { startTransition, useEffect, useState } from 'react';

const STORAGE_PREFIX = 'bountynet-insights:';

const requestInsightsPayload = async ({ persona, repos, history }) => {
  const response = await fetch('/api/insights', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      persona,
      repos,
      history,
    }),
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.json();
};

export const InsightsPanel = ({
  persona = 'solver',
  repos = [],
  history = [],
  storageKey = '',
  title = 'Operational insight',
}) => {
  const [state, setState] = useState({
    loading: true,
    error: '',
    payload: null,
  });

  const loadInsights = async (forced = false) => {
    const persistentKey = `${STORAGE_PREFIX}${storageKey || persona}`;
    if (!forced && storageKey && window.localStorage.getItem(persistentKey)) {
      return;
    }

    startTransition(() => {
      setState((previous) => ({
        ...previous,
        loading: true,
        error: '',
      }));
    });

    try {
      const payload = await requestInsightsPayload({
        persona,
        repos,
        history,
      });
      if (storageKey) {
        window.localStorage.setItem(persistentKey, 'seen');
      }

      startTransition(() => {
        setState({
          loading: false,
          error: '',
          payload,
        });
      });
    } catch (error) {
      startTransition(() => {
        setState({
          loading: false,
          error:
            error instanceof Error ? error.message : 'Failed to load insight',
          payload: null,
        });
      });
    }
  };

  useEffect(() => {
    const persistentKey = `${STORAGE_PREFIX}${storageKey || persona}`;
    if (storageKey && window.localStorage.getItem(persistentKey)) {
      setState((previous) => ({
        ...previous,
        loading: false,
      }));
      return;
    }

    void requestInsightsPayload({
      persona,
      repos,
      history,
    })
      .then((payload) => {
        if (storageKey) {
          window.localStorage.setItem(persistentKey, 'seen');
        }

        startTransition(() => {
          setState({
            loading: false,
            error: '',
            payload,
          });
        });
      })
      .catch((error) => {
        startTransition(() => {
          setState({
            loading: false,
            error:
              error instanceof Error ? error.message : 'Failed to load insight',
            payload: null,
          });
        });
      });
  }, [history, persona, repos, storageKey]);

  return (
    <Tile className="bn-insights">
      <div className="bn-insights__header">
        <div>
          <p className="bn-section-label">Anthropic insight</p>
          <h2>{title}</h2>
        </div>
        <Button kind="ghost" size="sm" onClick={() => loadInsights(true)}>
          Refresh insight
        </Button>
      </div>
      {state.loading ? (
        <div className="bn-insights__loading">
          <InlineLoading description="Assessing repos and agent context" />
          <SkeletonText />
          <SkeletonText />
          <SkeletonText width="75%" />
        </div>
      ) : null}
      {!state.loading && state.payload ? (
        <div className="bn-insights__body">
          <div className="bn-insights__summary">
            <Tag type={state.payload.mode === 'anthropic' ? 'green' : 'gray'}>
              {state.payload.mode === 'anthropic'
                ? 'Anthropic SDK'
                : 'Rules-based fallback'}
            </Tag>
            <p>{state.payload.summary}</p>
          </div>
          <div className="bn-insights__grid">
            {(state.payload.recommendations || []).map((item) => (
              <article className="bn-insights__recommendation" key={item.title}>
                <Tag type="blue">{item.priority}</Tag>
                <h3>{item.title}</h3>
                <p>{item.rationale}</p>
              </article>
            ))}
          </div>
          <div className="bn-insights__signals">
            {(state.payload.signals || []).map((signal) => (
              <Tag key={signal} type="cool-gray">
                {signal}
              </Tag>
            ))}
          </div>
        </div>
      ) : null}
      {!state.loading && state.error ? <p>{state.error}</p> : null}
    </Tile>
  );
};
