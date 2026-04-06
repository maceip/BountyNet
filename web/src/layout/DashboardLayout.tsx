import {
  BookOpenIcon,
  CompassIcon,
  CpuIcon,
  HardDriveIcon,
  LayoutDashboardIcon,
  ListOrderedIcon,
  ServerIcon,
  SettingsIcon,
  UserRoundIcon,
  WrenchIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
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
import { ThemeToggle } from "@/components/theme-toggle";
import { useGateway } from "@/context/gateway-context";
import { gatewayFetchPath } from "@/lib/gateway";

function GitHubMark(props: React.ComponentProps<"svg">) {
  return (
    <svg
      aria-hidden
      fill="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404L12 0z" />
    </svg>
  );
}

const CRUMB: Record<string, string> = {
  "/": "Overview",
  "/bounties": "Bounties",
  "/gateway": "Gateway",
  "/resources": "Resources",
  "/stake": "Stake",
  "/solve": "Solve",
  "/explore": "Explore",
  "/agent": "Agent profile",
  "/settings": "Settings",
};

export function DashboardLayout() {
  const { gatewayBase } = useGateway();
  const location = useLocation();
  const path = location.pathname;
  const [bountyCount, setBountyCount] = useState(0);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const r = await fetch(gatewayFetchPath(gatewayBase, "/bounties"));
        const j = (await r.json()) as { count?: number; bounties?: unknown[] };
        if (!cancel) {
          setBountyCount(
            j.count ?? (Array.isArray(j.bounties) ? j.bounties.length : 0),
          );
        }
      } catch {
        if (!cancel) setBountyCount(0);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [gatewayBase]);

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
            <SidebarGroupLabel>Console</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton isActive={path === "/"} render={<Link to="/" />}>
                    <LayoutDashboardIcon />
                    <span>Overview</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={path === "/bounties" || path.startsWith("/bounties/")}
                    render={<Link to="/bounties" />}
                  >
                    <ListOrderedIcon />
                    <span>Bounties</span>
                    {bountyCount > 0 ? (
                      <SidebarMenuBadge>{bountyCount}</SidebarMenuBadge>
                    ) : null}
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton isActive={path === "/gateway"} render={<Link to="/gateway" />}>
                    <ServerIcon />
                    <span>Gateway</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={path === "/resources"}
                    render={<Link to="/resources" />}
                  >
                    <HardDriveIcon />
                    <span>Resources</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          <SidebarGroup>
            <SidebarGroupLabel>Flows</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton isActive={path === "/stake"} render={<Link to="/stake" />}>
                    <CpuIcon />
                    <span>Stake</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton isActive={path === "/solve"} render={<Link to="/solve" />}>
                    <WrenchIcon />
                    <span>Solve</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton isActive={path === "/explore"} render={<Link to="/explore" />}>
                    <CompassIcon />
                    <span>Explore</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton isActive={path === "/agent"} render={<Link to="/agent" />}>
                    <UserRoundIcon />
                    <span>Agent</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton isActive={path === "/settings"} render={<Link to="/settings" />}>
                    <SettingsIcon />
                    <span>Settings</span>
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
                <BreadcrumbPage>
                  {CRUMB[location.pathname] ??
                    (location.pathname.startsWith("/bounties/")
                      ? "Bounty detail"
                      : "Page")}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <div className="ml-auto flex items-center gap-1">
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
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
