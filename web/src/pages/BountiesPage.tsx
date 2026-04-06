import { ListOrderedIcon, RefreshCwIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
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

type BountyRow = {
  context_hash?: string;
  repo?: string;
  check_name?: string;
  claimable?: boolean;
  amount_eurc?: string | number;
  budget_mode?: string;
};

export default function BountiesPage() {
  const { gatewayBase } = useGateway();
  const [bounties, setBounties] = useState<BountyRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch(gatewayFetchPath(gatewayBase, "/bounties"));
      const j = (await r.json()) as {
        bounties?: BountyRow[];
        error?: string;
      };
      if (!r.ok) {
        setBounties([]);
        setErr(j.error ?? r.statusText);
        return;
      }
      setBounties(j.bounties ?? []);
    } catch (e) {
      setBounties([]);
      setErr(e instanceof Error ? e.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }, [gatewayBase]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2 font-heading font-semibold text-lg">
            <ListOrderedIcon className="size-5 opacity-80" />
            Bounties
          </h1>
          <p className="text-muted-foreground text-sm">
            From <code className="text-xs">GET /bounties</code>
          </p>
        </div>
        <Button loading={loading} onClick={() => void load()} variant="outline">
          <RefreshCwIcon className="size-4" />
          Refresh
        </Button>
      </div>

      {err ? (
        <Alert variant="error">
          <AlertTitle>Feed error</AlertTitle>
          <AlertDescription>{err}</AlertDescription>
        </Alert>
      ) : null}

      {loading && bounties.length === 0 ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : null}

      {!loading && bounties.length === 0 && !err ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ListOrderedIcon className="size-4 opacity-80" />
            </EmptyMedia>
            <EmptyTitle>No open bounties</EmptyTitle>
            <EmptyDescription>
              When checks fail, rows appear here. Open a repo detail from the table
              when jobs exist.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : null}

      {bounties.length > 0 ? (
        <Table data-slot="frame">
          <TableHeader>
            <TableRow>
              <TableHead>Context</TableHead>
              <TableHead>Repo</TableHead>
              <TableHead>Check</TableHead>
              <TableHead>Budget</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bounties.map((b, i) => (
              <TableRow key={b.context_hash ?? `bounty-${i}`}>
                <TableCell className="max-w-[200px] truncate font-mono text-xs">
                  {b.context_hash ? (
                    <Link
                      className="text-primary underline-offset-4 hover:underline"
                      to={`/bounties/${encodeURIComponent(b.context_hash)}`}
                    >
                      {b.context_hash}
                    </Link>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell className="max-w-[160px] truncate">
                  {b.repo ?? "—"}
                </TableCell>
                <TableCell>{b.check_name ?? "—"}</TableCell>
                <TableCell>{b.amount_eurc ?? "—"}</TableCell>
                <TableCell>
                  {b.budget_mode ? (
                    <Badge variant="warning">{b.budget_mode}</Badge>
                  ) : null}{" "}
                  <Badge variant={b.claimable ? "success" : "secondary"}>
                    {b.claimable ? "Claimable" : "Claimed"}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : null}
    </div>
  );
}
