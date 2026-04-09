/**
 * Copyright IBM Corp. 2025, 2026
 *
 * This source code is licensed under the Apache-2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */
import {
  getDashboardModel,
  getInsights,
  getLeaderboardModel,
  getRealtimeFeed,
  getSurfaceModel,
} from '../service/bountynet.js';

const asyncHandler = (handler) => async (req, res) => {
  try {
    await handler(req, res);
  } catch (error) {
    console.error('BountyNet API route failed:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unexpected server error',
    });
  }
};

export const getRoutes = (app) => {
  app.get(
    '/api/bountynet/surface',
    asyncHandler(async (_req, res) => {
      res.json(await getSurfaceModel());
    }),
  );

  app.get(
    '/api/bountynet/feed',
    asyncHandler(async (_req, res) => {
      res.json(await getRealtimeFeed());
    }),
  );

  app.get(
    '/api/bountynet/dashboard',
    asyncHandler(async (_req, res) => {
      res.json(await getDashboardModel());
    }),
  );

  app.get(
    '/api/bountynet/leaderboard',
    asyncHandler(async (_req, res) => {
      res.json(await getLeaderboardModel());
    }),
  );

  app.post(
    '/api/insights',
    asyncHandler(async (req, res) => {
      res.json(await getInsights(req.body || {}));
    }),
  );
};
