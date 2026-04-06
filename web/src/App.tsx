"use client";

import {
  BookOpenIcon,
  CpuIcon,
  HardDriveIcon,
  LayoutDashboardIcon,
  ListOrderedIcon,
  RefreshCwIcon,
  ServerIcon,
  SparklesIcon,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ComponentProps,
} from "react";
import {
  Accordion,
  AccordionItem,
  AccordionPanel,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
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
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { Label } from "@/components/ui/label";
import { Progress, ProgressIndicator, ProgressTrack } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs";
import { ThemeToggle } from "@/components/theme-toggle";
import { toastManager } from "@/components/ui/toast";

type MainTab = "overview" | "bounties" | "gateway" | "resources";

type BountyRow = {
  context_hash?: string;
  repo?: string;
  check_name?: string;
  claimable?: boolean;
  amount_eurc?: string | number;
  budget_mode?: string;
  commit?: string;
};

/** Dev defaults to localhost; production builds default to the public gateway unless overridden. */
const DEFAULT_GATEWAY =
  import.meta.env.VITE_GATEWAY_URL?.trim() ||
  (import.meta.env.DEV ? "http://127.0.0.1:8090" : "https://gateway.stare.network");

type CreditsRatesPayload = {
  models?: Record<string, unknown>;
  instances?: Record<string, unknown>;
  usd_to_eurc?: number;
  examples?: Record<string, string>;
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

function GitHubMark(props: ComponentProps<"svg">) {
  return (
    <svg
      aria-hidden
      fill="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    </svg>
  );
}

const TAB_LABEL: Record<MainTab, string> = {
  overview: "Overview",
  bounties: "Bounties",
  gateway: "Gateway",
  resources: "Resources",
};

function loadGatewayBase(): string {
  try {
    return localStorage.getItem("bountynet.gateway") ?? DEFAULT_GATEWAY;
  } catch {
    return DEFAULT_GATEWAY;
  }
}

export default function App() {
  const [mainTab, setMainTab] = useState<MainTab>("overview");
  const [gatewayBase, setGatewayBase] = useState(loadGatewayBase);
  const [health, setHealth] = useState<Record<string, unknown> | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [bounties, setBounties] = useState<BountyRow[]>([]);
  const [bountyCount, setBountyCount] = useState(0);
  const [bountiesLoading, setBountiesLoading] = useState(false);
  const [bountyError, setBountyError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [ratesData, setRatesData] = useState<CreditsRatesPayload | null>(null);
  const [resourceRows, setResourceRows] = useState<ResourceStakeRow[]>([]);
  const [resourcesError, setResourcesError] = useState<string | null>(null);
  const [resourcesLoading, setResourcesLoading] = useState(false);

  const persistGateway = useCallback((next: string) => {
    setGatewayBase(next);
    try {
      localStorage.setItem("bountynet.gateway", next);
    } catch {
      /* ignore */
    }
  }, []);

  const fetchHealth = useCallback(async () => {
    setHealthLoading(true);
    try {
      const r = await fetch(`${gatewayBase.replace(/\/$/, "")}/health`);
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

  const fetchResourcesTab = useCallback(async () => {
    setResourcesLoading(true);
    setResourcesError(null);
    const base = gatewayBase.replace(/\/$/, "");
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
      let err: string | null = null;
      if (!rRates.ok) {
        setRatesData(null);
        err = ratesJson.error ?? rRates.statusText;
      } else {
        setRatesData(ratesJson);
      }
      if (!rRes.ok) {
        setResourceRows([]);
        err = err ?? resJson.error ?? rRes.statusText;
      } else {
        setResourceRows(resJson.resources ?? []);
      }
      setResourcesError(err);
    } catch (e) {
      setRatesData(null);
      setResourceRows([]);
      setResourcesError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setResourcesLoading(false);
    }
  }, [gatewayBase]);

  const fetchBounties = useCallback(async () => {
    setBountiesLoading(true);
    setBountyError(null);
    try {
      const r = await fetch(`${gatewayBase.replace(/\/$/, "")}/bounties`);
      const j = (await r.json()) as {
        bounties?: BountyRow[];
        count?: number;
        error?: string;
      };
      if (!r.ok) {
        setBounties([]);
        setBountyError(j.error ?? r.statusText);
        return;
      }
      setBounties(j.bounties ?? []);
      setBountyCount(j.count ?? (j.bounties?.length ?? 0));
    } catch (e) {
      setBounties([]);
      setBountyError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBountiesLoading(false);
    }
  }, [gatewayBase]);

  useEffect(() => {
    if (mainTab === "bounties") void fetchBounties();
  }, [mainTab, fetchBounties]);

  useEffect(() => {
    if (mainTab === "resources") void fetchResourcesTab();
  }, [mainTab, fetchResourcesTab]);

  const healthOk = health?.status === "ok";
  const readinessPercent = useMemo(() => {
    if (healthLoading) return 0;
    return healthOk ? 100 : 0;
  }, [health, healthLoading, healthOk]);

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

  return (
    <SidebarProvider defaultOpen>
      <Sidebar collapsible="icon">
        <SidebarHeader className="border-sidebar-border border-b">
          <div className="flex items-center gap-2 px-2 py-1">
            <Avatar className="size-8 rounded-lg">
              <AvatarFallback className="rounded-lg bg-primary text-primary-foreground text-xs">
                BN
              </AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5 group-data-[collapsible=icon]:hidden">
              <span className="truncate font-heading font-semibold text-sm">
                BountyNet
              </span>
              <span className="truncate text-muted-foreground text-xs">
                Prover network dashboard
              </span>
            </div>
            <Badge className="group-data-[collapsible=icon]:hidden" variant="info">
              MCP
            </Badge>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Navigate</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={mainTab === "overview"}
                    onClick={() => setMainTab("overview")}
                    tooltip="Product overview"
                  >
                    <LayoutDashboardIcon />
                    <span>{TAB_LABEL.overview}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={mainTab === "bounties"}
                    onClick={() => setMainTab("bounties")}
                    tooltip="Bounty feed from the gateway"
                  >
                    <ListOrderedIcon />
                    <span>{TAB_LABEL.bounties}</span>
                    {bountyCount > 0 ? (
                      <SidebarMenuBadge>{bountyCount}</SidebarMenuBadge>
                    ) : null}
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={mainTab === "gateway"}
                    onClick={() => setMainTab("gateway")}
                    tooltip="Point the UI at your gateway"
                  >
                    <ServerIcon />
                    <span>{TAB_LABEL.gateway}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={mainTab === "resources"}
                    onClick={() => setMainTab("resources")}
                    tooltip="Resource claims and credits"
                  >
                    <HardDriveIcon />
                    <span>{TAB_LABEL.resources}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="border-sidebar-border border-t p-2">
          <Button
            className="w-full gap-2"
            render={
              <a
                href="https://github.com/cosscom/coss"
                rel="noreferrer"
                target="_blank"
              />
            }
            size="sm"
            variant="outline"
          >
            <BookOpenIcon className="size-4" />
            coss ui
          </Button>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur-md">
          <SidebarTrigger className="-ms-1" />
          <Separator className="mx-1 h-6" orientation="vertical" />
          <Breadcrumb className="hidden min-w-0 sm:block">
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="#">Console</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{TAB_LABEL[mainTab]}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <div className="ml-auto flex items-center gap-1">
            <Dialog>
              <DialogTrigger
                render={<Button size="sm" variant="outline" />}
              >
                <SparklesIcon className="size-4" />
                Quick start
              </DialogTrigger>
              <DialogPopup showCloseButton>
                <DialogHeader>
                  <DialogTitle>Connect BountyNet</DialogTitle>
                  <DialogDescription>
                    Install the GitHub App, run the gateway locally, or point
                    this UI at a hosted endpoint.
                  </DialogDescription>
                </DialogHeader>
                <DialogPanel>
                  <ol className="list-inside list-decimal space-y-3 text-muted-foreground text-sm">
                    <li>
                      Set gateway URL in the{" "}
                      <strong className="text-foreground">Gateway</strong> tab,
                      then ping <Kbd>/health</Kbd>.
                    </li>
                    <li>
                      Open <Kbd>/mcp</Kbd> from ChatGPT or Cursor on the same
                      origin as the gateway.
                    </li>
                    <li>
                      Watch the <strong className="text-foreground">Bounties</strong>{" "}
                      feed as agents claim repair jobs.
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
            <Button
              render={
                <a
                  href="https://github.com/maceip/BountyNet"
                  rel="noreferrer"
                  target="_blank"
                />
              }
              size="icon"
              variant="ghost"
            >
              <GitHubMark className="size-4" />
            </Button>
            <ThemeToggle />
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
          <Tabs
            onValueChange={(v) => setMainTab(v as MainTab)}
            value={mainTab}
          >
            <TabsList className="w-full min-[720px]:w-auto">
              <TabsTab value="overview">Overview</TabsTab>
              <TabsTab value="bounties">
                Bounties
                {bountyCount > 0 ? (
                  <Badge className="ms-1" variant="secondary">
                    {bountyCount}
                  </Badge>
                ) : null}
              </TabsTab>
              <TabsTab value="gateway">Gateway</TabsTab>
              <TabsTab value="resources">Resources</TabsTab>
            </TabsList>

            <TabsPanel className="flex flex-col gap-6 pt-4" value="overview">
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Registered agents</CardTitle>
                    <CardDescription>Reported by gateway /health</CardDescription>
                  </CardHeader>
                  <CardPanel className="text-3xl font-semibold tabular-nums">
                    {healthLoading ? <Skeleton className="h-9 w-16" /> : agents}
                  </CardPanel>
                  <CardFooter className="text-muted-foreground text-xs">
                    Requires working RPC + identity contracts
                  </CardFooter>
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
                </Card>
              </div>

              <Alert variant="info">
                <AlertTitle>MCP Streamable HTTP</AlertTitle>
                <AlertDescription>
                  The gateway exposes tools for models (<code>bountynet_show_feed</code>,{" "}
                  <code>bountynet_about</code>) on the same origin as{" "}
                  <code className="rounded-md bg-muted px-1.5 py-0.5 text-xs">
                    POST /mcp
                  </code>
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
                  <p className="text-muted-foreground text-xs">
                    Use the Gateway tab to ping /health. Stats above update from that
                    response.
                  </p>
                </CardPanel>
              </Card>

              <Accordion>
                <AccordionItem value="faq-1">
                  <AccordionTrigger>
                    What is BountyNet?
                  </AccordionTrigger>
                  <AccordionPanel>
                    A network that turns failing CI into funded repair jobs: repos
                    connect via GitHub or ChatGPT, bounties open on red checks, and
                    solvers claim work through the gateway.
                  </AccordionPanel>
                </AccordionItem>
                <AccordionItem value="faq-2">
                  <AccordionTrigger>Where do payouts settle?</AccordionTrigger>
                  <AccordionPanel>
                    When EURC escrow is configured on the gateway, amounts follow
                    on-chain bounty state; API-key mode keeps token budgets off-chain.
                  </AccordionPanel>
                </AccordionItem>
              </Accordion>
            </TabsPanel>

            <TabsPanel className="flex flex-col gap-4 pt-4" value="bounties">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-heading font-semibold text-lg">Bounty feed</h2>
                  <p className="text-muted-foreground text-sm">
                    From <code className="text-xs">GET /bounties</code> on your gateway
                  </p>
                </div>
                <Button
                  loading={bountiesLoading}
                  onClick={() => void fetchBounties()}
                  variant="outline"
                >
                  <RefreshCwIcon className="size-4" />
                  Refresh
                </Button>
              </div>

              {bountyError ? (
                <Alert variant="error">
                  <AlertTitle>Feed error</AlertTitle>
                  <AlertDescription>{bountyError}</AlertDescription>
                </Alert>
              ) : null}

              {bountiesLoading && bounties.length === 0 ? (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : null}

              {!bountiesLoading && bounties.length === 0 && !bountyError ? (
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <ListOrderedIcon className="size-4 opacity-80" />
                    </EmptyMedia>
                    <EmptyTitle>No open bounties</EmptyTitle>
                    <EmptyDescription>
                      When checks fail or jobs are opened, rows appear here. Ensure
                      the gateway can reach your RPC for on-chain discovery.
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
                        <TableCell className="max-w-[140px] truncate font-mono text-xs">
                          {b.context_hash ?? "—"}
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
            </TabsPanel>

            <TabsPanel className="flex flex-col gap-4 pt-4" value="gateway">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Gateway base URL</CardTitle>
                  <CardDescription>
                    Used for{" "}
                    <code className="rounded-md bg-muted px-1.5 py-0.5 text-xs">
                      /health
                    </code>{" "}
                    and{" "}
                    <code className="rounded-md bg-muted px-1.5 py-0.5 text-xs">
                      /bounties
                    </code>
                  </CardDescription>
                </CardHeader>
                <CardPanel className="space-y-4">
                  <Field name="gateway">
                    <FieldLabel>Origin</FieldLabel>
                    <Input
                      name="gateway"
                      onChange={(e) => persistGateway(e.target.value)}
                      placeholder="https://gateway.stare.network"
                      value={gatewayBase}
                    />
                    <FieldDescription>
                      Persisted in <code className="text-xs">localStorage</code> (
                      <code className="text-xs">bountynet.gateway</code>). Build-time
                      default from <code className="text-xs">VITE_GATEWAY_URL</code>{" "}
                      (see <code className="text-xs">web/.env.example</code>).
                    </FieldDescription>
                  </Field>
                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      loading={healthLoading}
                      onClick={() => void fetchHealth()}
                    >
                      Ping /health
                    </Button>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={showAdvanced}
                        onCheckedChange={setShowAdvanced}
                      />
                      <Label className="text-sm">Show raw JSON</Label>
                    </div>
                  </div>
                  {showAdvanced && health ? (
                    <ScrollArea className="h-48 rounded-lg border bg-muted/32 p-3">
                      <pre className="font-mono text-xs">
                        {JSON.stringify(health, null, 2)}
                      </pre>
                    </ScrollArea>
                  ) : null}
                </CardPanel>
              </Card>

            </TabsPanel>

            <TabsPanel className="flex flex-col gap-4 pt-4" value="resources">
              <Alert variant="warning">
                <AlertTitle>Resources & credits</AlertTitle>
                <AlertDescription>
                  Data below is loaded from{" "}
                  <code className="rounded-md bg-muted px-1.5 py-0.5 text-xs">
                    GET /credits/rates
                  </code>{" "}
                  and{" "}
                  <code className="rounded-md bg-muted px-1.5 py-0.5 text-xs">
                    GET /resources
                  </code>{" "}
                  on the configured gateway. Staking uses{" "}
                  <code className="rounded-md bg-muted px-1.5 py-0.5 text-xs">
                    POST /resources/stake
                  </code>
                  .
                </AlertDescription>
              </Alert>

              {resourcesError ? (
                <Alert variant="error">
                  <AlertTitle>Could not load resources</AlertTitle>
                  <AlertDescription>{resourcesError}</AlertDescription>
                </Alert>
              ) : null}

              {resourcesLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : null}

              {!resourcesLoading && ratesData ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <CpuIcon className="size-4 opacity-80" />
                        Instance rates
                      </CardTitle>
                      <CardDescription>Keys from /credits/rates instances</CardDescription>
                    </CardHeader>
                    <CardPanel className="flex flex-wrap gap-2">
                      {ratesData.instances && Object.keys(ratesData.instances).length > 0 ? (
                        Object.keys(ratesData.instances).map((k) => (
                          <Badge key={k} variant="secondary">
                            {k}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-muted-foreground text-sm">No instance rows returned</span>
                      )}
                    </CardPanel>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Model rates</CardTitle>
                      <CardDescription>Keys from /credits/rates models</CardDescription>
                    </CardHeader>
                    <CardPanel className="flex flex-wrap gap-2">
                      {ratesData.models && Object.keys(ratesData.models).length > 0 ? (
                        Object.keys(ratesData.models).map((k) => (
                          <Badge key={k} variant="info">
                            {k}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-muted-foreground text-sm">No model rows returned</span>
                      )}
                    </CardPanel>
                  </Card>
                </div>
              ) : null}

              {!resourcesLoading && resourceRows.length > 0 ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Staked resources</CardTitle>
                    <CardDescription>From GET /resources</CardDescription>
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
                        {resourceRows.map((r) => (
                          <TableRow key={r.token_id ?? `${r.spec}-${r.provider}`}>
                            <TableCell>{r.token_id ?? "—"}</TableCell>
                            <TableCell>{r.resource_type ?? "—"}</TableCell>
                            <TableCell className="max-w-[200px] truncate font-mono text-xs">
                              {r.spec ?? "—"}
                            </TableCell>
                            <TableCell>{r.tokens_remaining ?? "—"}</TableCell>
                            <TableCell>{r.active === undefined ? "—" : String(r.active)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardPanel>
                </Card>
              ) : null}

            </TabsPanel>
          </Tabs>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
