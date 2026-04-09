/**
 * Copyright IBM Corp. 2025, 2026
 *
 * This source code is licensed under the Apache-2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { InlineLoading, Tag } from '@carbon/react';
import { useDeferredValue } from 'react';
import { usePollingJson } from '../../hooks/usePollingJson.js';

const INITIAL_FEED = {
  live: false,
  updatedAt: '',
  activities: [],
};

export const LiveActivityFeed = () => {
  const { data, loading } = usePollingJson(
    '/api/bountynet/feed',
    INITIAL_FEED,
    6000,
  );
  const activities = useDeferredValue(data.activities || []);

  return (
    <section className="bn-live-feed">
      <div className="bn-live-feed__header">
        <div>
          <p className="bn-section-label">Realtime activity</p>
          <h2>Gateway and contract activity</h2>
        </div>
        <div className="bn-live-feed__status">
          <Tag type={data.live ? 'green' : 'gray'}>
            {data.live ? 'Live gateway data' : 'Fallback snapshot'}
          </Tag>
          {loading ? <InlineLoading description="Refreshing feed" /> : null}
        </div>
      </div>
      <div className="bn-live-feed__viewport" aria-live="polite">
        <div className="bn-live-feed__track">
          {[...activities, ...activities].map((item, index) => (
            <article className="bn-live-feed__item" key={`${item.id}-${index}`}>
              <div className="bn-live-feed__item-head">
                <Tag type="cool-gray">{item.kind}</Tag>
                <span>{item.timeLabel}</span>
              </div>
              <h3>{item.title}</h3>
              <p>{item.detail}</p>
              {item.repo ? <span>{item.repo}</span> : null}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};
