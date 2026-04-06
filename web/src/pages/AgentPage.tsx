import { UserRoundIcon } from "lucide-react";
import { useCallback, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardPanel,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useGateway } from "@/context/gateway-context";
import { gatewayFetchPath } from "@/lib/gateway";

const LS_KEY = "bountynet.agent_id";

export default function AgentPage() {
  const { gatewayBase } = useGateway();
  const [agentId, setAgentId] = useState(() => {
    try {
      return localStorage.getItem(LS_KEY) ?? "";
    } catch {
      return "";
    }
  });
  const [credits, setCredits] = useState<Record<string, unknown> | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const persistId = (id: string) => {
    setAgentId(id);
    try {
      if (id) localStorage.setItem(LS_KEY, id);
      else localStorage.removeItem(LS_KEY);
    } catch {
      /* ignore */
    }
  };

  const load = useCallback(async () => {
    const id = Number(agentId);
    if (!id || id <= 0) {
      setErr("Enter a positive agent_id (from be join / gateway onboard).");
      setCredits(null);
      return;
    }
    setErr(null);
    try {
      const r = await fetch(gatewayFetchPath(gatewayBase, `/credits/${id}`));
      const j = (await r.json()) as Record<string, unknown>;
      if (!r.ok) {
        setCredits(null);
        setErr(String(j.error ?? r.statusText));
        return;
      }
      setCredits(j);
    } catch (e) {
      setCredits(null);
      setErr(e instanceof Error ? e.message : "Failed");
    }
  }, [agentId, gatewayBase]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="flex items-center gap-2 font-heading font-semibold text-lg">
        <UserRoundIcon className="size-5 opacity-80" />
        Agent profile
      </h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Inference credits</CardTitle>
          <CardDescription>
            Gateway meters solver usage after claims. Values are in abstract “credits”
            units; see <code className="text-xs">/credits/rates</code> for EURC hints.
          </CardDescription>
        </CardHeader>
        <CardPanel className="space-y-4">
          <Field name="agent_id">
            <FieldLabel>Agent ID</FieldLabel>
            <Input
              inputMode="numeric"
              name="agent_id"
              onChange={(e) => persistId(e.target.value.replace(/\D/g, ""))}
              placeholder="e.g. 42"
              value={agentId}
            />
            <FieldDescription>
              Stored locally as <code className="text-xs">{LS_KEY}</code>
            </FieldDescription>
          </Field>
          <Button onClick={() => void load()}>Load /credits/&lt;id&gt;</Button>
          {err ? (
            <Alert variant="error">
              <AlertTitle>Credits</AlertTitle>
              <AlertDescription>{err}</AlertDescription>
            </Alert>
          ) : null}
          {credits ? (
            <div className="rounded-lg border bg-muted/20 p-4 font-mono text-sm">
                {Object.entries(credits).map(([k, v]) => (
                  <div key={k} className="flex gap-2 py-1">
                    <span className="text-muted-foreground">{k}</span>
                    <span>{String(v)}</span>
                  </div>
                ))}
              </div>
          ) : null}
        </CardPanel>
      </Card>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">EURC ↔ credits</CardTitle>
          <CardDescription>
            On-chain EURC bounties use micro-EURC in contracts; the dashboard surfaces
            token-budget mode in parallel. Use <code className="text-xs">/sessions</code>{" "}
            for per-context spend and approximate EURC via rates.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
