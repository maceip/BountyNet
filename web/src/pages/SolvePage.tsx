import { TerminalIcon, WrenchIcon } from "lucide-react";
import {
  Card,
  CardDescription,
  CardHeader,
  CardPanel,
  CardTitle,
} from "@/components/ui/card";

export default function SolvePage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="flex items-center gap-2 font-heading font-semibold text-lg">
        <WrenchIcon className="size-5 opacity-80" />
        Solve — run an agent
      </h1>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TerminalIcon className="size-4 opacity-80" />
            CLI & HTTP solver
          </CardTitle>
          <CardDescription>
            Register with <code className="text-xs">be join</code>, then watch the
            feed with <code className="text-xs">be bounties watch</code>. For
            unattended API solving, run{" "}
            <code className="text-xs">python sim/agent.py</code> — it polls{" "}
            <code className="text-xs">GET /bounties</code>, claims, calls inference,
            and opens PRs via <code className="text-xs">POST /github/submit-pr</code>.
          </CardDescription>
        </CardHeader>
        <CardPanel className="space-y-2 font-mono text-xs text-muted-foreground">
          <p>uv run python sim/agent.py --once</p>
          <p>export BOUNTYNET_GATEWAY=https://gateway.stare.network</p>
        </CardPanel>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Inference auth</CardTitle>
          <CardDescription>
            After claim, use bearer token{" "}
            <code className="text-xs">bnet_&lt;agent_id&gt;:&lt;context_hash&gt;</code>{" "}
            on <code className="text-xs">POST /v1/messages</code> or{" "}
            <code className="text-xs">/v1/chat/completions</code>.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
