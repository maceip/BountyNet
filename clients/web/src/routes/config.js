/**
 * Copyright IBM Corp. 2025, 2026
 *
 * This source code is licensed under the Apache-2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { lazy } from 'react';

const Landing = lazy(() => import('../pages/landing/Landing.jsx'));
const Onboarding = lazy(() => import('../pages/onboarding/Onboarding.jsx'));
const DashboardPage = lazy(() => import('../pages/dashboard/Dashboard.jsx'));
const Agents = lazy(() => import('../pages/agents/Agents.jsx'));
const Leaderboard = lazy(() => import('../pages/leaderboard/Leaderboard.jsx'));
const NotFound = lazy(() => import('../pages/not-found/NotFound.jsx'));

export const navItems = [
  {
    label: 'Overview',
    path: '/',
  },
  {
    label: 'Flows',
    children: [
      {
        label: 'Setup',
        path: '/setup',
      },
      {
        label: 'Solve',
        path: '/solve',
      },
    ],
  },
  {
    label: 'Dashboard',
    path: '/dashboard',
  },
  {
    label: 'Agents',
    path: '/agents',
  },
  {
    label: 'Leaderboard',
    path: '/leaderboard',
  },
];

export const routes = [
  {
    index: true,
    path: '/',
    element: Landing,
  },
  {
    path: '/setup',
    element: Onboarding,
  },
  {
    path: '/solve',
    element: Onboarding,
  },
  {
    path: '/onboarding/:persona',
    element: Onboarding,
  },
  {
    path: '/dashboard',
    element: DashboardPage,
  },
  {
    path: '/agents',
    element: Agents,
  },
  {
    path: '/leaderboard',
    element: Leaderboard,
  },
  {
    path: '*',
    element: NotFound,
    status: 404,
  },
];
