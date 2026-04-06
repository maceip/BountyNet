import { SettingsIcon } from "lucide-react";
import {
  Card,
  CardDescription,
  CardHeader,
  CardPanel,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useGateway } from "@/context/gateway-context";

const CIRCLE_KEY_HINT = import.meta.env.VITE_CIRCLE_CLIENT_KEY
  ? "Configured (non-empty VITE_CIRCLE_CLIENT_KEY)."
  : "Set VITE_CIRCLE_CLIENT_KEY in web env for passkey / smart-account flows.";

export default function SettingsPage() {
  const { gatewayBase, setGatewayBase } = useGateway();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="flex items-center gap-2 font-heading font-semibold text-lg">
        <SettingsIcon className="size-5 opacity-80" />
        Settings
      </h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Gateway</CardTitle>
          <CardDescription>Same origin as this UI should reach MCP + REST.</CardDescription>
        </CardHeader>
        <CardPanel>
          <Field name="gw">
            <FieldLabel>Base URL</FieldLabel>
            <Input
              name="gw"
              onChange={(e) => setGatewayBase(e.target.value)}
              value={gatewayBase}
            />
            <FieldDescription>Persisted in localStorage.</FieldDescription>
          </Field>
        </CardPanel>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Circle Modular Wallets</CardTitle>
          <CardDescription>
            For gasless Arc smart accounts, create a client key in the Circle Developer
            Console and expose it to this bundle. Link the resulting address through the
            gateway <code className="text-xs">POST /identity/&lt;id&gt;/wallet</code>{" "}
            (see <code className="text-xs">wallet/circle_link.py</code>).
          </CardDescription>
        </CardHeader>
        <CardPanel className="space-y-3 text-sm text-muted-foreground">
          <p>{CIRCLE_KEY_HINT}</p>
          <p>
            Official docs:{" "}
            <a
              className="text-primary underline"
              href="https://developers.circle.com/wallets/modular"
              rel="noreferrer"
              target="_blank"
            >
              Modular Wallets
            </a>
            .
          </p>
        </CardPanel>
      </Card>
    </div>
  );
}
