import { CpuIcon, ExternalLinkIcon } from "lucide-react";
import { Link } from "react-router-dom";
import {
  Card,
  CardDescription,
  CardHeader,
  CardPanel,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function StakePage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="flex items-center gap-2 font-heading font-semibold text-lg">
        <CpuIcon className="size-5 opacity-80" />
        Stake — connect a repo
      </h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">GitHub App</CardTitle>
          <CardDescription>
            Install the BountyNet GitHub App on orgs or repos you own. On install the
            gateway records the installation, injects{" "}
            <code className="text-xs">.github/bountynet.yml</code> when missing, and
            opens bounties when CI fails. Budget escalates on repeated failures for the
            same check until green again.
          </CardDescription>
        </CardHeader>
        <CardPanel className="flex flex-wrap gap-2">
          <Button
            render={
              <a
                href="https://github.com/apps/bountynet"
                rel="noreferrer"
                target="_blank"
              />
            }
          >
            Install GitHub App
            <ExternalLinkIcon className="size-4" />
          </Button>
          <Button variant="outline" render={<Link to="/gateway" />}>
            Configure gateway URL
          </Button>
        </CardPanel>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">API key budget</CardTitle>
          <CardDescription>
            After install, call{" "}
            <code className="text-xs">POST /github/setup</code> with your Anthropic or
            OpenAI key and <code className="text-xs">budget_tokens</code>. That value
            feeds inference for solvers on new bounties.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
