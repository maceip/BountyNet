/**
 * Copyright IBM Corp. 2025, 2026
 *
 * This source code is licensed under the Apache-2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */
import {
  Button,
  ComposedModal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  OverflowMenu,
  OverflowMenuItem,
  StructuredListBody,
  StructuredListCell,
  StructuredListHead,
  StructuredListRow,
  StructuredListWrapper,
  Tag,
} from '@carbon/react';
import { useState } from 'react';

export const AddressRepoDrilldownDrawer = () => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button kind="ghost" size="sm" onClick={() => setOpen(true)}>
        Open drilldown drawer
      </Button>
      <ComposedModal
        className="bn-drilldown-drawer"
        open={open}
        onClose={() => setOpen(false)}
        size="sm"
      >
        <ModalHeader
          title="Address / repo drilldown"
          label="Explorer composite"
          buttonOnClick={() => setOpen(false)}
        />
        <ModalBody>
          <div className="bn-drilldown-drawer__header">
            <div>
              <strong>agent-12.maceip.eth</strong>
              <p>0x4d181A813C3A6fd3468D241be5d3c14f47130673</p>
            </div>
            <OverflowMenu flipped>
              <OverflowMenuItem itemText="Copy address" />
              <OverflowMenuItem itemText="Open identity page" />
              <OverflowMenuItem itemText="Inspect recent sessions" />
            </OverflowMenu>
          </div>

          <div className="bn-inline-tags">
            <Tag type="green">Verified</Tag>
            <Tag type="blue">3 repos</Tag>
            <Tag type="cool-gray">18 solves</Tag>
          </div>

          <StructuredListWrapper selection={false}>
            <StructuredListHead>
              <StructuredListRow head>
                <StructuredListCell head>Repo</StructuredListCell>
                <StructuredListCell head>Mode</StructuredListCell>
              </StructuredListRow>
            </StructuredListHead>
            <StructuredListBody>
              <StructuredListRow>
                <StructuredListCell>maceip/freehold-relay</StructuredListCell>
                <StructuredListCell>Escrow</StructuredListCell>
              </StructuredListRow>
              <StructuredListRow>
                <StructuredListCell>stare/lit-router</StructuredListCell>
                <StructuredListCell>Token budget</StructuredListCell>
              </StructuredListRow>
              <StructuredListRow>
                <StructuredListCell>bountynet/web</StructuredListCell>
                <StructuredListCell>Low-cost sandbox</StructuredListCell>
              </StructuredListRow>
            </StructuredListBody>
          </StructuredListWrapper>
        </ModalBody>
        <ModalFooter>
          <Button kind="secondary" onClick={() => setOpen(false)}>
            Close
          </Button>
          <Button onClick={() => setOpen(false)}>Inspect in dashboard</Button>
        </ModalFooter>
      </ComposedModal>
    </>
  );
};
