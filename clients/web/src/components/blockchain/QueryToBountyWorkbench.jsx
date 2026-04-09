/**
 * Copyright IBM Corp. 2025, 2026
 *
 * This source code is licensed under the Apache-2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */
import {
  Button,
  CodeSnippet,
  ContainedList,
  ContainedListItem,
  StructuredListBody,
  StructuredListCell,
  StructuredListHead,
  StructuredListRow,
  StructuredListWrapper,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Tag,
} from '@carbon/react';

export const QueryToBountyWorkbench = () => {
  return (
    <section
      className="bn-query-workbench"
      aria-label="Query to bounty workbench"
    >
      <div className="bn-query-workbench__header">
        <div>
          <p className="bn-section-label">Query-to-bounty workbench</p>
          <h3>Translate analytics findings into funded remediation</h3>
        </div>
        <Button size="sm">Create bounty from result set</Button>
      </div>

      <Tabs>
        <TabList aria-label="Query workbench tabs" contained>
          <Tab>Signal query</Tab>
          <Tab>Budget recipe</Tab>
          <Tab>Execution map</Tab>
        </TabList>
        <TabPanels>
          <TabPanel>
            <div className="bn-query-workbench__panel">
              <CodeSnippet type="multi">
                {`SELECT repo, check_name, failures_7d, mean_tokens
FROM ci_failures
WHERE failures_7d > 3
ORDER BY mean_tokens DESC;`}
              </CodeSnippet>
              <StructuredListWrapper selection={false}>
                <StructuredListHead>
                  <StructuredListRow head>
                    <StructuredListCell head>Field</StructuredListCell>
                    <StructuredListCell head>Meaning</StructuredListCell>
                  </StructuredListRow>
                </StructuredListHead>
                <StructuredListBody>
                  <StructuredListRow>
                    <StructuredListCell>failures_7d</StructuredListCell>
                    <StructuredListCell>
                      Repeated build pain signal
                    </StructuredListCell>
                  </StructuredListRow>
                  <StructuredListRow>
                    <StructuredListCell>mean_tokens</StructuredListCell>
                    <StructuredListCell>
                      Expected gateway budget pressure
                    </StructuredListCell>
                  </StructuredListRow>
                </StructuredListBody>
              </StructuredListWrapper>
            </div>
          </TabPanel>
          <TabPanel>
            <div className="bn-query-workbench__panel">
              <ContainedList label="Budget automation recipe">
                <ContainedListItem action={<Tag type="green">Auto</Tag>}>
                  Trigger on repeated CI failure streaks only
                </ContainedListItem>
                <ContainedListItem action={<Tag type="blue">Policy</Tag>}>
                  Route lint / format checks to token budgets first
                </ContainedListItem>
                <ContainedListItem action={<Tag type="purple">Escrow</Tag>}>
                  Escalate production-critical checks into EURC settlement
                </ContainedListItem>
              </ContainedList>
            </div>
          </TabPanel>
          <TabPanel>
            <div className="bn-query-workbench__panel">
              <div className="bn-query-workbench__flow">
                <Tag type="cool-gray">Signal</Tag>
                <Tag type="blue">Threshold</Tag>
                <Tag type="green">Budget</Tag>
                <Tag type="purple">Claimable context</Tag>
                <Tag type="warm-gray">Validation</Tag>
              </div>
              <p>
                This composite is the missing bridge between analytics and the
                operational bounty surface. Carbon ships excellent tabs,
                snippets, and structured lists, but not this domain-specific
                “query result becomes funding policy” workflow.
              </p>
            </div>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </section>
  );
};
