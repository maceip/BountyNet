import { CpuIcon, HardDriveIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardDescription,
  CardHeader,
  CardPanel,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useGateway } from "@/context/gateway-context";
import { gatewayFetchPath } from "@/lib/gateway";

type CreditsRatesPayload = {
  models?: Record<string, unknown>;
  instances?: Record<string, unknown>;
  error?: string;
};

type ResourceStakeRow = {
  token_id?: number;
  resource_type?: string;
  provider?: string;
  spec?: string;
  tokens_remaining?: number;
  active?: boolean;
};

export default function ResourcesPage() {
  const { gatewayBase } = useGateway();
  const [rates, setRates] = useState<CreditsRatesPayload | null>(null);
  const [rows, setRows] = useState<ResourceStakeRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    const base = gatewayFetchPath(gatewayBase, "");
    try {
      const [rRates, rRes] = await Promise.all([
        fetch(`${base}/credits/rates`),
        fetch(`${base}/resources`),
      ]);
      const ratesJson = (await rRates.json()) as CreditsRatesPayload;
      const resJson = (await rRes.json()) as {
        resources?: ResourceStakeRow[];
        error?: string;
      };
      let e: string | null = null;
      if (!rRates.ok) {
        setRates(null);
        e = ratesJson.error ?? rRates.statusText;
      } else {
        setRates(ratesJson);
      }
      if (!rRes.ok) {
        setRows([]);
        e = e ?? resJson.error ?? rRes.statusText;
      } else {
        setRows(resJson.resources ?? []);
      }
      setErr(e);
    } catch (x) {
      setRates(null);
      setRows([]);
      setErr(x instanceof Error ? x.message : "Failed");
    } finally {
      setLoading(false);
    }
  }, [gatewayBase]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="flex items-center gap-2 font-heading font-semibold text-lg">
        <HardDriveIcon className="size-5 opacity-80" />
        Resources
      </h1>

      <Alert variant="warning">
        <AlertTitle>Credit rates & stakes</AlertTitle>
        <AlertDescription>
          <code className="text-xs">GET /credits/rates</code> ·{" "}
          <code className="text-xs">GET /resources</code> · stake via{" "}
          <code className="text-xs">POST /resources/stake</code>
        </AlertDescription>
      </Alert>

      {err ? (
        <Alert variant="error">
          <AlertTitle>Load error</AlertTitle>
          <AlertDescription>{err}</AlertDescription>
        </Alert>
      ) : null}

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
        </div>
      ) : null}

      {rates && !loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CpuIcon className="size-4 opacity-80" />
                Instance rates
              </CardTitle>
              <CardDescription>/credits/rates instances</CardDescription>
            </CardHeader>
            <CardPanel className="flex flex-wrap gap-2">
              {rates.instances && Object.keys(rates.instances).length > 0 ? (
                Object.keys(rates.instances).map((k) => (
                  <Badge key={k} variant="secondary">
                    {k}
                  </Badge>
                ))
              ) : (
                <span className="text-muted-foreground text-sm">—</span>
              )}
            </CardPanel>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Model rates</CardTitle>
              <CardDescription>/credits/rates models</CardDescription>
            </CardHeader>
            <CardPanel className="flex flex-wrap gap-2">
              {rates.models && Object.keys(rates.models).length > 0 ? (
                Object.keys(rates.models).map((k) => (
                  <Badge key={k} variant="info">
                    {k}
                  </Badge>
                ))
              ) : (
                <span className="text-muted-foreground text-sm">—</span>
              )}
            </CardPanel>
          </Card>
        </div>
      ) : null}

      {rows.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Staked resources</CardTitle>
          </CardHeader>
          <CardPanel>
            <Table data-slot="frame">
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Spec</TableHead>
                  <TableHead>Remaining</TableHead>
                  <TableHead>Active</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.token_id ?? `${r.spec}-${r.provider}`}>
                    <TableCell>{r.token_id ?? "—"}</TableCell>
                    <TableCell>{r.resource_type ?? "—"}</TableCell>
                    <TableCell className="max-w-[200px] truncate font-mono text-xs">
                      {r.spec ?? "—"}
                    </TableCell>
                    <TableCell>{r.tokens_remaining ?? "—"}</TableCell>
                    <TableCell>
                      {r.active === undefined ? "—" : String(r.active)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardPanel>
        </Card>
      ) : null}
    </div>
  );
}
