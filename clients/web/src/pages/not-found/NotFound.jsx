/**
 * Copyright IBM Corp. 2025, 2026
 *
 * This source code is licensed under the Apache-2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { Button, Column, Grid, Tile } from '@carbon/react';
import { Link as NavLink, useLocation } from 'react-router';
import { Footer } from '../../components/footer/Footer.jsx';
import { PageLayout } from '../../layouts/page-layout.jsx';

const NotFound = () => {
  const location = useLocation();

  return (
    <PageLayout className="bn-page" fallback={<p>Loading page...</p>}>
      <Grid fullWidth className="bn-section">
        <Column sm={4} md={8} lg={10}>
          <Tile className="bn-card">
            <p className="bn-section-label">404</p>
            <h1>Route not found</h1>
            <p>
              {location.pathname} is not part of the current BountyNet site map.
            </p>
            <Button as={NavLink} to="/">
              Return to overview
            </Button>
          </Tile>
        </Column>
      </Grid>
      <Footer />
    </PageLayout>
  );
};

export default NotFound;
