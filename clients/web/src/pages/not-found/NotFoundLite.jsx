import { Link, useLocation } from 'react-router';
import { PageLayout } from '../../layouts/page-layout.jsx';

const NotFoundLite = () => {
  const location = useLocation();
  return (
    <PageLayout fallback={<p>Loading page...</p>}>
      <section className="bn-not-found">
        <p>404</p>
        <h1>Route not found</h1>
        <p>{location.pathname} is not part of this local surface.</p>
        <Link to="/">Return to market</Link>
      </section>
    </PageLayout>
  );
};

export default NotFoundLite;
