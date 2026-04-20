import { Link, useLocation } from 'react-router';
import { PageLayout } from '../../layouts/page-layout.jsx';
import { Button, Chip, Icon, Panel } from '../../components/cs16/index.js';
import { navItems } from '../../routes/config.js';

const NotFoundLite = () => {
  const location = useLocation();
  const suggestions = navItems.slice(0, 6);

  return (
    <PageLayout fallback={<p className="bn-empty">Loading page…</p>}>
      <div
        style={{
          display: 'grid',
          placeItems: 'center',
          minHeight: 'calc(100vh - 200px)',
          padding: 24,
        }}
      >
        <Panel
          eyebrow="404 · not found"
          title="This route is not part of the surface."
          meta={<Chip tone="red">HTTP 404</Chip>}
          style={{ width: 'min(520px, 100%)' }}
          bodyClassName="bn-stack"
        >
          <p className="bn-body">
            <code
              style={{
                padding: '1px 6px',
                backgroundColor: 'var(--bn-inset)',
                border: '1px solid var(--bn-border)',
                color: 'var(--bn-accent)',
              }}
            >
              {location.pathname}
            </code>{' '}
            has no mapping in the client router. Pick one of the known routes
            below or jump with <kbd className="bn-kbd">⌘K</kbd>.
          </p>
          <div style={{ display: 'grid', gap: 4 }}>
            {suggestions.map((item) => (
              <Button
                key={item.path}
                as={Link}
                to={item.path}
                variant="ghost"
                trailingIcon="arrow"
                style={{ justifyContent: 'space-between', width: '100%' }}
              >
                <span className="bn-row" style={{ gap: 8 }}>
                  <Icon name="arrow" />
                  {item.label}
                </span>
                <span className="bn-meta" style={{ color: 'var(--bn-text-3)' }}>
                  {item.path}
                </span>
              </Button>
            ))}
          </div>
          <Button as={Link} to="/" variant="primary" icon="globe">
            Return to market
          </Button>
        </Panel>
      </div>
    </PageLayout>
  );
};

export default NotFoundLite;
