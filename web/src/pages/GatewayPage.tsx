import { ServerIcon } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { toastManager } from "@/components/ui/toast";
import { useGateway } from "@/context/gateway-context";
import { gatewayFetchPath } from "@/lib/gateway";

export default function GatewayPage() {
  const { gatewayBase, setGatewayBase } = useGateway();
  const [health, setHealth] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [showRaw, setShowRaw] = useState(false);

  const ping = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(gatewayFetchPath(gatewayBase, "/health"));
      const j = (await r.json()) as Record<string, unknown>;
      setHealth(j);
      if (!r.ok) {
        toastManager.add({
          type: "warning",
          title: "/health error",
          description: String(j.error ?? r.statusText),
        });
      }
    } catch (e) {
      setHealth(null);
      toastManager.add({
        type: "error",
        title: "Request failed",
        description: e instanceof Error ? e.message : "error",
      });
    } finally {
      setLoading(false);
    }
  }, [gatewayBase]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="flex items-center gap-2 font-heading font-semibold text-lg">
        <ServerIcon className="size-5 opacity-80" />
        Gateway
      </h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Gateway base URL</CardTitle>
          <CardDescription>
            Used for <code className="text-xs">/health</code>,{" "}
            <code className="text-xs">/bounties</code>, and the rest of the API.
          </CardDescription>
        </CardHeader>
        <CardPanel className="space-y-4">
          <Field name="gateway">
            <FieldLabel>Origin</FieldLabel>
            <Input
              name="gateway"
              onChange={(e) => setGatewayBase(e.target.value)}
              placeholder="https://gateway.stare.network"
              value={gatewayBase}
            />
            <FieldDescription>
              Persisted in <code className="text-xs">localStorage</code>. Build
              default: <code className="text-xs">VITE_GATEWAY_URL</code>.
            </FieldDescription>
          </Field>
          <div className="flex flex-wrap items-center gap-3">
            <Button loading={loading} onClick={() => void ping()}>
              Ping /health
            </Button>
            <div className="flex items-center gap-2">
              <Switch checked={showRaw} onCheckedChange={setShowRaw} />
              <Label className="text-sm">Show raw JSON</Label>
            </div>
          </div>
          {showRaw && health ? (
            <ScrollArea className="h-48 rounded-lg border bg-muted/32 p-3">
              <pre className="font-mono text-xs">
                {JSON.stringify(health, null, 2)}
              </pre>
            </ScrollArea>
          ) : null}
        </CardPanel>
      </Card>

      <Alert variant="info">
        <AlertTitle>MCP</AlertTitle>
        <AlertDescription>
          Streamable HTTP lives at <code className="text-xs">/mcp</code> on the
          same origin.
        </AlertDescription>
      </Alert>
    </div>
  );
}
