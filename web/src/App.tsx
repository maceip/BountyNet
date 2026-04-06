import { Route, Routes } from "react-router-dom";
import { DashboardLayout } from "@/layout/DashboardLayout";
import AgentPage from "@/pages/AgentPage.tsx";
import BountiesPage from "@/pages/BountiesPage.tsx";
import BountyDetailPage from "@/pages/BountyDetailPage.tsx";
import ExplorePage from "@/pages/ExplorePage.tsx";
import GatewayPage from "@/pages/GatewayPage.tsx";
import OverviewPage from "@/pages/OverviewPage.tsx";
import ResourcesPage from "@/pages/ResourcesPage.tsx";
import SettingsPage from "@/pages/SettingsPage.tsx";
import SolvePage from "@/pages/SolvePage.tsx";
import StakePage from "@/pages/StakePage.tsx";

export default function App() {
  return (
    <Routes>
      <Route element={<DashboardLayout />}>
        <Route index element={<OverviewPage />} />
        <Route path="bounties" element={<BountiesPage />} />
        <Route path="bounties/:hash" element={<BountyDetailPage />} />
        <Route path="gateway" element={<GatewayPage />} />
        <Route path="resources" element={<ResourcesPage />} />
        <Route path="stake" element={<StakePage />} />
        <Route path="solve" element={<SolvePage />} />
        <Route path="explore" element={<ExplorePage />} />
        <Route path="agent" element={<AgentPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}
