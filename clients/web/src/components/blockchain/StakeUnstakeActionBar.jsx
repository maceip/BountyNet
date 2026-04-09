/**
 * Copyright IBM Corp. 2025, 2026
 *
 * This source code is licensed under the Apache-2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { Button, ButtonSet, Tag } from '@carbon/react';
import { useState } from 'react';

export const StakeUnstakeActionBar = ({
  asset = 'EURC',
  lockedAmount = '5.00',
  availableAmount = '12.40',
  statusLabel = 'Escrow live',
}) => {
  const [mode, setMode] = useState('stake');

  return (
    <section className="bn-stake-bar" aria-label="Stake or unstake budget">
      <div className="bn-stake-bar__header">
        <div>
          <p className="bn-section-label">Stake control</p>
          <h3>Lock and unlock bounty budget</h3>
        </div>
        <Tag type={mode === 'stake' ? 'green' : 'cool-gray'}>{statusLabel}</Tag>
      </div>

      <div className="bn-stake-bar__body">
        <div className="bn-stake-bar__metrics">
          <div>
            <span>Locked</span>
            <strong>
              {lockedAmount} {asset}
            </strong>
          </div>
          <div>
            <span>Available</span>
            <strong>
              {availableAmount} {asset}
            </strong>
          </div>
        </div>

        <div className="bn-stake-bar__chamber" data-mode={mode}>
          <div className="bn-stake-bar__lane">
            <div className="bn-stake-bar__locked-zone">
              <span>Escrow</span>
            </div>
            <div className="bn-stake-bar__free-zone">
              <span>Wallet</span>
            </div>
            <div className="bn-stake-bar__capsule">
              <span>{mode === 'stake' ? 'Locking' : 'Unlocking'}</span>
            </div>
          </div>
        </div>

        <ButtonSet>
          <Button
            kind={mode === 'stake' ? 'primary' : 'secondary'}
            onClick={() => setMode('stake')}
          >
            Stake
          </Button>
          <Button
            kind={mode === 'unstake' ? 'primary' : 'secondary'}
            onClick={() => setMode('unstake')}
          >
            Unstake
          </Button>
        </ButtonSet>
      </div>
    </section>
  );
};
