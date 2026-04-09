/**
 * Copyright IBM Corp. 2025, 2026
 *
 * This source code is licensed under the Apache-2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { Tag } from '@carbon/react';

const STRIP_FIELDS = ['chain', 'ens', 'wallet', 'contextHash', 'repo', 'mode'];

const LABELS = {
  chain: 'Chain',
  ens: 'Agent',
  wallet: 'Wallet',
  contextHash: 'Context',
  repo: 'Repo',
  mode: 'Mode',
};

export const ContextIdentityStrip = ({
  chain = 'Arc Testnet',
  ens = 'agent-12.maceip.eth',
  wallet = '0x4d181A813C3A6fd3468D241be5d3c14f47130673',
  contextHash = '0x3ef1b4db54c0...',
  repo = 'maceip/freehold-relay',
  mode = 'api_key',
  verified = true,
}) => {
  const fields = { chain, ens, wallet, contextHash, repo, mode };
  const fieldLabel = (field) =>
    field === 'wallet' && mode === 'api_key'
      ? 'On-chain identity'
      : LABELS[field];

  return (
    <section
      className="bn-context-strip"
      aria-label="Context and identity strip"
    >
      <div className="bn-context-strip__header">
        <p className="bn-section-label">Identity strip</p>
        <Tag type={verified ? 'green' : 'red'}>
          {verified ? 'Verified routing' : 'Verification pending'}
        </Tag>
      </div>
      <div className="bn-context-strip__grid">
        {STRIP_FIELDS.map((field) => (
          <div className="bn-context-strip__field" key={field}>
            <span>{fieldLabel(field)}</span>
            <strong>{fields[field]}</strong>
          </div>
        ))}
      </div>
    </section>
  );
};
