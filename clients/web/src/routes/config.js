/**
 * Copyright IBM Corp. 2025, 2026
 *
 * This source code is licensed under the Apache-2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { lazy } from 'react';

const Landing = lazy(() => import('../pages/landing/LandingLite.jsx'));
const Marketplace = lazy(() => import('../pages/marketplace/Marketplace.jsx'));
const RepoOwnerOnboarding = lazy(
  () => import('../pages/onboarding/BobOnboarding.jsx'),
);
const AgentOperatorOnboarding = lazy(
  () => import('../pages/onboarding/AliceOnboarding.jsx'),
);
const RepoOwnerSettings = lazy(() => import('../pages/settings/BobSettings.jsx'));
const AgentOperatorSettings = lazy(
  () => import('../pages/settings/AliceSettings.jsx'),
);
const Inventory = lazy(() => import('../pages/inventory/Inventory.jsx'));
const WebMcpDiagnostics = lazy(
  () => import('../pages/diagnostics/WebMcpDiagnostics.jsx'),
);
const Reputation = lazy(() => import('../pages/marketplace/Reputation.jsx'));
const Settlement = lazy(() => import('../pages/marketplace/Settlement.jsx'));
const Disputes = lazy(() => import('../pages/marketplace/Disputes.jsx'));
const MarketAdmin = lazy(() => import('../pages/admin/MarketAdmin.jsx'));
const SimulatorConfig = lazy(() => import('../pages/admin/SimulatorConfig.jsx'));
const AgentTrack = lazy(() => import('../pages/agent-track/AgentTrack.jsx'));
const NotFound = lazy(() => import('../pages/not-found/NotFoundLite.jsx'));

export const navItems = [
  {
    label: 'Home',
    path: '/',
  },
  {
    label: 'Marketplace',
    path: '/marketplace',
  },
  {
    label: 'Inventory',
    path: '/inventory',
  },
  {
    label: 'Repo Owner Setup',
    path: '/onboarding/repo-owner',
  },
  {
    label: 'Agent Operator Setup',
    path: '/onboarding/agent-operator',
  },
  {
    label: 'Diagnostics',
    path: '/diagnostics/webmcp',
  },
  {
    label: 'Control Plane',
    path: '/ops/control-plane',
  },
  {
    label: 'Reputation',
    path: '/marketplace/reputation',
  },
  {
    label: 'Simulator',
    path: '/ops/simulator',
  },
  {
    label: 'Agent Track',
    path: '/agent-track',
  },
];

export const routes = [
  {
    index: true,
    path: '/',
    element: Landing,
  },
  {
    path: '/onboarding/repo-owner',
    element: RepoOwnerOnboarding,
  },
  {
    path: '/onboarding/agent-operator',
    element: AgentOperatorOnboarding,
  },
  {
    path: '/settings/repo-owner',
    element: RepoOwnerSettings,
  },
  {
    path: '/settings/agent-operator',
    element: AgentOperatorSettings,
  },
  {
    path: '/inventory',
    element: Inventory,
  },
  {
    path: '/dashboard',
    element: Inventory,
  },
  {
    path: '/diagnostics/webmcp',
    element: WebMcpDiagnostics,
  },
  {
    path: '/marketplace/reputation',
    element: Reputation,
  },
  {
    path: '/marketplace/settlements',
    element: Settlement,
  },
  {
    path: '/marketplace/disputes',
    element: Disputes,
  },
  {
    path: '/ops/control-plane',
    element: MarketAdmin,
  },
  {
    path: '/ops/simulator',
    element: SimulatorConfig,
  },
  {
    path: '/agent-track',
    element: AgentTrack,
  },
  {
    path: '/market',
    element: Marketplace,
  },
  {
    path: '/marketplace',
    element: Marketplace,
  },
  {
    path: '*',
    element: NotFound,
    status: 404,
  },
];
