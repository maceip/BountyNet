/**
 * Copyright IBM Corp. 2025, 2026
 *
 * This source code is licensed under the Apache-2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { Column, Grid, Link, Tag } from '@carbon/react';

export const Footer = () => {
  return (
    <Grid as="footer" fullWidth className="bn-footer">
      <Column sm={4} md={4} lg={6}>
        <img
          src="/brand/text-strip-white.png"
          alt="BountyNet"
          className="bn-footer__wordmark"
        />
        <p className="bn-footer__eyebrow">BountyNet</p>
        <h2>Autonomous CI remediation with on-chain settlement.</h2>
      </Column>
      <Column sm={4} md={4} lg={5}>
        <p>
          The current implementation couples Vyper contracts, a Flask gateway,
          GitHub App automation, and the minimal `be` CLI shipped in this
          repository.
        </p>
      </Column>
      <Column sm={4} md={8} lg={5}>
        <div className="bn-footer__meta">
          <Tag type="gray">Carbon</Tag>
          <Tag type="blue">Dynamic</Tag>
          <Tag type="green">Anthropic-ready</Tag>
        </div>
        <p>
          Gateway default:{' '}
          <Link href="https://gateway.stare.network">
            gateway.stare.network
          </Link>
        </p>
      </Column>
    </Grid>
  );
};
