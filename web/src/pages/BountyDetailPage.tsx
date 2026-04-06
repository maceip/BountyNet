import { ArrowLeftIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardPanel,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useGateway } from "@/context/gateway-context";
import { gatewayFetchPath } from "@/lib/gateway";

export default function BountyDetailPage() {
  const { hash } = useParams<{ hash: string }>();
  const { gatewayBase } = useGateway();
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!hash) return;
    let cancel = false;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const path = `/bounties/${encodeURIComponent(hash)}`;
        const r = await fetch(gatewayFetchPath(gatewayBase, path));
        const j = (await r.json()) as Record<string, unknown>;
        if (!cancel) {
          if (!r.ok) {
            setData(null);
            setErr(String(j.error ?? r.statusText));
          } else {
            setData(j);
          }
        }
      } catch (e) {
        if (!cancel) {
          setErr(e instanceof Error ? e.message : "Failed");
          setData(null);
        }
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [hash, gatewayBase]);

  if (!hash) {
    return <Alert variant="error"><AlertTitle>Missing hash</AlertTitle></Alert>;
  }

  return (
    <div className="flex flex-col gap-4">
      <Button render={<Link to="/bounties" />} size="sm" variant="ghost">
        <ArrowLeftIcon className="size-4" />
        Back to feed
      </Button>

      <Card>
        <CardHeader>
          <CardTitle className="font-mono text-base">{hash}</CardTitle>
          <CardDescription>
            <code className="text-xs">GET /bounties/&lt;context_hash&gt;</code>
          </CardDescription>
        </CardHeader>
        <CardPanel>
          {loading ? <Skeleton className="h-32 w-full" /> : null}
          {err ? (
            <Alert variant="error">
              <AlertTitle>Not found or error</AlertTitle>
              <AlertDescription>{err}</AlertDescription>
            </Alert>
          ) : null}
          {data && !loading ? (
            <dl className="grid gap-2 text-sm">
              {Object.entries(data).map(([k, v]) => (
                <div key={k} className="flex flex-wrap gap-2">
                  <dt className="min-w-[8rem] text-muted-foreground">{k}</dt>
                  <dd className="font-mono text-xs break-all">
                    {typeof v === "object" ? JSON.stringify(v) : String(v)}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
          {data?.claimable === true ? (
            <Badge className="mt-4" variant="success">
              Claimable — use POST /bounties/…/claim with agent_id
            </Badge>
          ) : null}
        </CardPanel>
      </Card>
    </div>
  );
}
