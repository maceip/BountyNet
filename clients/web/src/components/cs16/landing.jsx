/*
 * cs16 landing composites — named, user-facing blocks for the home page.
 * These are the "products" referenced in the BountyNet component inventory:
 *   - MarketingHero (H1)
 *   - LiveMarketplaceActivity (H2)
 *   - PersonaCard (H3–H6)
 */

import { Link } from 'react-router';
import { Icon } from './icons.jsx';
import { Button, Chip, EmptyState, Panel, StatusDot } from './primitives.jsx';
import { InfiniteSlider } from './data.jsx';

const cn = (...parts) => parts.filter(Boolean).join(' ');

/* -------------------------------------------------------------------------
 * MarketingHero
 * Props:
 *   kicker?: string   — small eyebrow
 *   title: string     — the big line
 *   body?: string     — short paragraph
 *   ctas: [{ label, to, icon?, variant? }]
 *   personas?: [{ tone, label, hint }]  — optional "for bob / for alice" pills
 * --------------------------------------------------------------------- */
export const MarketingHero = ({
  kicker = 'bountynet marketplace',
  title,
  body,
  ctas = [],
  personas = [],
  className,
}) => (
  <section
    className={cn('bn-hero', className)}
    style={{
      display: 'grid',
      gap: 16,
      padding: '32px 24px',
      background:
        'linear-gradient(180deg, var(--bn-surface-1) 0%, var(--bn-surface) 100%)',
      border: '1px solid',
      borderColor:
        'var(--bn-border-light) var(--bn-border-dark) var(--bn-border-dark) var(--bn-border-light)',
    }}
  >
    <span className="bn-eyebrow">{kicker}</span>
    <h1 className="bn-headline" style={{ maxWidth: '22ch' }}>
      {title}
    </h1>
    {body ? (
      <p className="bn-body" style={{ maxWidth: '64ch' }}>
        {body}
      </p>
    ) : null}
    {personas.length ? (
      <div className="bn-row" style={{ gap: 6 }}>
        {personas.map((persona) => (
          <Chip key={persona.label} tone={persona.tone || 'accent'}>
            {persona.label}
            {persona.hint ? (
              <span style={{ color: 'var(--bn-text-2)', marginLeft: 4 }}>
                · {persona.hint}
              </span>
            ) : null}
          </Chip>
        ))}
      </div>
    ) : null}
    <div className="bn-row" style={{ gap: 8, marginTop: 6 }}>
      {ctas.map((cta) => (
        <Button
          key={cta.label}
          as={Link}
          to={cta.to}
          variant={cta.variant || 'default'}
          icon={cta.icon}
          id={cta.id}
        >
          {cta.label}
        </Button>
      ))}
    </div>
  </section>
);

/* -------------------------------------------------------------------------
 * LiveMarketplaceActivity
 * Props:
 *   activities: [{ id, title, detail, tone?, updatedAt?, href? }]
 *   live?: boolean             — drives the header dot
 *   source?: string            — shown in header meta
 *   updatedAt?: string
 *   loading?: boolean
 *   error?: string | Error
 *   intervalMs?: number        — for display only ("updates every …")
 *   maxItems?: number          — cap displayed items
 * --------------------------------------------------------------------- */
export const LiveMarketplaceActivity = ({
  activities = [],
  live = true,
  source,
  updatedAt,
  loading,
  error,
  intervalMs,
  maxItems = 12,
  className,
  onRetry,
}) => {
  const items = activities.slice(0, maxItems);
  const cadence = intervalMs ? `${Math.round(intervalMs / 1000)}s` : null;

  const meta = (
    <span className="bn-row" style={{ gap: 10 }}>
      <StatusDot
        tone={live ? 'green' : 'red'}
        pulse={live}
        label={live ? 'live' : 'offline'}
      />
      {source ? <Chip tone="ghost">{source}</Chip> : null}
      {updatedAt ? (
        <span className="bn-meta" style={{ color: 'var(--bn-text-2)' }}>
          updated {updatedAt}
        </span>
      ) : null}
      {cadence ? (
        <span className="bn-meta" style={{ color: 'var(--bn-text-3)' }}>
          every {cadence}
        </span>
      ) : null}
    </span>
  );

  return (
    <Panel
      eyebrow="market feed"
      title="Live marketplace activity"
      meta={meta}
      className={className}
      bodyClassName="bn-stack"
    >
      {error ? (
        <EmptyState
          icon="bolt"
          title="Feed unavailable."
          description={
            typeof error === 'string'
              ? error
              : error.message || 'Retry in a moment.'
          }
          action={
            onRetry ? (
              <Button size="sm" onClick={onRetry} icon="arrow">
                Retry
              </Button>
            ) : null
          }
        />
      ) : loading && items.length === 0 ? (
        <ActivitySkeleton />
      ) : items.length === 0 ? (
        <EmptyState
          icon="graph"
          title="No activity yet."
          description="New bounties and settlements will appear here as they land."
        />
      ) : (
        <InfiniteSlider
          items={items}
          speed={Math.max(20, items.length * 3.5)}
        />
      )}
    </Panel>
  );
};

const ActivitySkeleton = () => (
  <div className="bn-row" style={{ gap: 12, padding: '8px 4px' }}>
    {[0, 1, 2, 3].map((index) => (
      <div
        key={index}
        className="bn-panel"
        style={{
          minWidth: 260,
          display: 'grid',
          gap: 6,
          padding: 10,
        }}
      >
        <span className="bn-skeleton" style={{ height: 12, width: '70%' }} />
        <span className="bn-skeleton" style={{ height: 10, width: '90%' }} />
      </div>
    ))}
  </div>
);

/* -------------------------------------------------------------------------
 * PersonaCard — the landing "for bob / for alice / inventory / infra" blocks.
 * Props:
 *   kicker?: string
 *   title: string
 *   body?: string
 *   bullets?: string[]
 *   cta: { label, to }
 *   icon?: string
 *   tone?: 'accent' | 'green' | 'yellow' | 'purple'
 * --------------------------------------------------------------------- */
export const PersonaCard = ({
  kicker,
  title,
  body,
  bullets = [],
  cta,
  icon = 'bolt',
  tone = 'accent',
  className,
}) => (
  <article
    className={cn('bn-persona-card', className)}
    style={{
      display: 'grid',
      gap: 10,
      padding: 16,
      background: 'var(--bn-surface-1)',
      border: '1px solid',
      borderColor:
        'var(--bn-border-light) var(--bn-border-dark) var(--bn-border-dark) var(--bn-border-light)',
      position: 'relative',
    }}
  >
    <span
      className="bn-row"
      style={{
        gap: 8,
        color: `var(--bn-${tone === 'accent' ? 'accent' : tone})`,
      }}
    >
      <Icon name={icon} size={16} />
      {kicker ? (
        <span className="bn-eyebrow" style={{ color: 'inherit' }}>
          {kicker}
        </span>
      ) : null}
    </span>
    <h3 className="bn-subhead">{title}</h3>
    {body ? <p className="bn-body">{body}</p> : null}
    {bullets.length ? (
      <ul
        style={{
          margin: 0,
          padding: 0,
          display: 'grid',
          gap: 4,
          listStyle: 'none',
        }}
      >
        {bullets.map((bullet, index) => (
          <li
            key={index}
            className="bn-body"
            style={{
              display: 'grid',
              gridTemplateColumns: '14px 1fr',
              gap: 8,
              alignItems: 'start',
            }}
          >
            <span
              style={{
                marginTop: 6,
                width: 6,
                height: 6,
                backgroundColor: `var(--bn-${tone === 'accent' ? 'accent' : tone})`,
              }}
            />
            <span>{bullet}</span>
          </li>
        ))}
      </ul>
    ) : null}
    {cta ? (
      <div style={{ marginTop: 4 }}>
        <Button
          as={Link}
          to={cta.to}
          variant="ghost"
          trailingIcon="arrow"
          size="sm"
        >
          {cta.label}
        </Button>
      </div>
    ) : null}
  </article>
);

export const PersonaGrid = ({ personas = [], className }) => (
  <div
    className={cn(className)}
    style={{
      display: 'grid',
      gap: 12,
      gridTemplateColumns: 'repeat(auto-fit, minmax(min(260px, 100%), 1fr))',
    }}
  >
    {personas.map((persona) => (
      <PersonaCard key={persona.title} {...persona} />
    ))}
  </div>
);

/* -------------------------------------------------------------------------
 * Section — small wrapper that gives a page consistent rhythm.
 * --------------------------------------------------------------------- */
export const Section = ({ title, eyebrow, actions, children, className }) => (
  <section className={cn(className)} style={{ display: 'grid', gap: 12 }}>
    {title || eyebrow || actions ? (
      <header
        className="bn-row"
        style={{ justifyContent: 'space-between', alignItems: 'baseline' }}
      >
        <div>
          {eyebrow ? <span className="bn-eyebrow">{eyebrow}</span> : null}
          {title ? <h2 className="bn-subhead">{title}</h2> : null}
        </div>
        {actions ? (
          <div className="bn-row" style={{ gap: 6 }}>
            {actions}
          </div>
        ) : null}
      </header>
    ) : null}
    {children}
  </section>
);
