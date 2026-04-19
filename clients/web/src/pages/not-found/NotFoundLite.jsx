import { Link, useLocation } from 'react-router';
import { PageLayout } from '../../layouts/page-layout.jsx';

const NotFoundLite = () => {
  const location = useLocation();
  return (
    <PageLayout fallback={<p>Loading page...</p>}>
      <section className="mx-auto w-full max-w-xl px-3 py-8 fold:px-6 desktop:px-8">
        <p>404</p>
        <h1>route not found</h1>
        <p>{location.pathname} is not part of this local surface.</p>
        <Link className="mt-2 inline-flex border border-border bg-secondary px-3 py-2 text-sm no-underline" to="/">return to market</Link>
      </section>
    </PageLayout>
  );
};

export default NotFoundLite;
