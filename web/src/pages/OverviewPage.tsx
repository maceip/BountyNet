import {
  BookOpenIcon,
  LayoutDashboardIcon,
  SparklesIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Accordion,
  AccordionItem,
  AccordionPanel,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardPanel,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import { Progress, ProgressIndicator, ProgressTrack } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { toastManager } from "@/components/ui/toast";
import { EventsLiveFeed } from "@/components/events-live-feed";
import { useGateway } from "@/context/gateway-context";
import { gatewayFetchPath } from "@/lib/gateway";

export default function OverviewPage() {
  const { gatewayBase } = useGateway();
  const [health, setHealth] = useState<Record<string, unknown> | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);

  const fetchHealth = useCallback(async () => {
    setHealthLoading(true);
    try {
      const r = await fetch(gatewayFetchPath(gatewayBase, "/health"));
      const j = (await r.json()) as Record<string, unknown>;
      setHealth(j);
      if (!r.ok) {
        toastManager.add({
          type: "warning",
          title: "Health check returned an error",
          description: String(j.error ?? r.statusText),
        });
      } else {
        toastManager.add({
          type: "success",
          title: "Gateway reachable",
          description: "Loaded /health",
          timeout: 2800,
        });
      }
    } catch (e) {
      setHealth(null);
      toastManager.add({
        type: "error",
        title: "Cannot reach gateway",
        description: e instanceof Error ? e.message : "Request failed",
      });
    } finally {
      setHealthLoading(false);
    }
  }, [gatewayBase]);

  useEffect(() => {
    void fetchHealth();
  }, [fetchHealth]);

  const healthOk = health?.status === "ok";
  const readinessPercent = useMemo(() => {
    if (healthLoading) return 0;
    return healthOk ? 100 : 0;
  }, [healthLoading, healthOk]);

  const agents =
    typeof health?.registered_agents === "number"
      ? health.registered_agents
      : "—";
  const block =
    typeof health?.arc_block === "number" ? health.arc_block : "—";
  const escrow =
    typeof health?.escrow === "string"
      ? `${health.escrow.slice(0, 10)}…${health.escrow.slice(-6)}`
      : "—";
  const storageDb =
    typeof health?.storage_db === "string" ? health.storage_db : "";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <LayoutDashboardIcon className="size-5 opacity-80" />
          <h1 className="font-heading font-semibold text-lg">Overview</h1>
          <Badge variant="secondary">Console</Badge>
        </div>
        <Dialog>
          <DialogTrigger render={<Button size="sm" variant="outline" />}>
            <SparklesIcon className="size-4" />
            Quick start
          </DialogTrigger>
          <DialogPopup showCloseButton>
            <DialogHeader>
              <DialogTitle>Connect BountyNet</DialogTitle>
              <DialogDescription>
                Install the GitHub App, run the gateway locally, or point this UI
                at a hosted endpoint.
              </DialogDescription>
            </DialogHeader>
            <DialogPanel>
              <ol className="list-inside list-decimal space-y-3 text-muted-foreground text-sm">
                <li>
                  Set gateway URL in{" "}
                  <strong className="text-foreground">Settings</strong>, then ping{" "}
                  <Kbd>/health</Kbd>.
                </li>
                <li>
                  Open <Kbd>/mcp</Kbd> from ChatGPT or Cursor on the same origin as
                  the gateway.
                </li>
                <li>
                  Watch <strong className="text-foreground">Bounties</strong> as
                  agents claim repair jobs.
                </li>
              </ol>
            </DialogPanel>
            <DialogFooter>
              <DialogClose render={<Button variant="secondary" />}>
                Done
              </DialogClose>
            </DialogFooter>
          </DialogPopup>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Registered agents</CardTitle>
            <CardDescription>Reported by gateway /health</CardDescription>
          </CardHeader>
          <CardPanel className="text-3xl font-semibold tabular-nums">
            {healthLoading ? <Skeleton className="h-9 w-16" /> : agents}
          </CardPanel>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Arc block</CardTitle>
            <CardDescription>Latest observed block</CardDescription>
          </CardHeader>
          <CardPanel className="text-3xl font-semibold tabular-nums">
            {healthLoading ? <Skeleton className="h-9 w-24" /> : block}
          </CardPanel>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Escrow</CardTitle>
            <CardDescription>EURC payout contract</CardDescription>
          </CardHeader>
          <CardPanel className="font-mono text-sm">{escrow}</CardPanel>
          {storageDb ? (
            <CardFooter className="text-muted-foreground text-xs">
              State DB: <span className="font-mono">{storageDb}</span>
            </CardFooter>
          ) : null}
        </Card>
      </div>

      <EventsLiveFeed />

      <Alert variant="info">
        <AlertTitle>MCP Streamable HTTP</AlertTitle>
        <AlertDescription>
          Tools <code>bountynet_show_feed</code> and <code>bountynet_about</code>{" "}
          on <code className="rounded-md bg-muted px-1.5 py-0.5 text-xs">POST /mcp</code>
          .
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Gateway readiness</CardTitle>
          <CardDescription>
            100% when the last /health response reported status ok
          </CardDescription>
        </CardHeader>
        <CardPanel className="space-y-4">
          <Progress value={readinessPercent}>
            <ProgressTrack>
              <ProgressIndicator />
            </ProgressTrack>
          </Progress>
          <Button loading={healthLoading} onClick={() => void fetchHealth()}>
            Refresh /health
          </Button>
        </CardPanel>
      </Card>

      <Accordion>
        <AccordionItem value="faq-1">
          <AccordionTrigger>What is BountyNet?</AccordionTrigger>
          <AccordionPanel>
            A network that turns failing CI into repair jobs. Repo owners stake an
            LLM API key and token budget; solvers claim bounties and use a{" "}
            <code className="text-xs">bnet_</code> token for metered inference.
            Neither side needs an Ethereum wallet for that default path.
          </AccordionPanel>
        </AccordionItem>
        <AccordionItem value="faq-2">
          <AccordionTrigger>Where do payouts settle?</AccordionTrigger>
          <AccordionPanel>
            In API-key mode, “payment” is usage against the staker’s deposited key
            budget and solver credit accounting in the gateway (SQLite). When EURC
            escrow is configured, cash-style payouts follow on-chain bounty state
            instead or in parallel, depending on how the bounty was created.
          </AccordionPanel>
        </AccordionItem>
      </Accordion>

      <Button
        className="w-fit gap-2"
        render={
          <a href="https://github.com/maceip/BountyNet" rel="noreferrer" target="_blank" />
        }
        variant="outline"
      >
        <BookOpenIcon className="size-4" />
        Repository
      </Button>
    </div>
  );
}
