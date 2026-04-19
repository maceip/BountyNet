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
import { getWebMcpJourney, getWebMcpJourneys } from '../service/webmcp.js';

const BOUNTYNET_GATEWAY_URL =
  process.env.BOUNTYNET_GATEWAY_URL || 'http://127.0.0.1:8090';

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

const proxyGatewayJson = async ({ path, method = 'GET', body }) => {
  const response = await fetch(`${BOUNTYNET_GATEWAY_URL}${path}`, {
    method,
    headers: {
      accept: 'application/json',
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const payload = await response.json().catch(() => ({}));
  return { status: response.status, payload };
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

  app.get(
    '/api/bountynet/webmcp/journeys',
    asyncHandler(async (_req, res) => {
      res.json(getWebMcpJourneys());
    }),
  );

  app.get(
    '/api/bountynet/webmcp/journeys/:persona',
    asyncHandler(async (req, res) => {
      const journey = getWebMcpJourney(req.params.persona);
      if (!journey) {
        res.status(404).json({ error: 'persona journey not found' });
        return;
      }
      res.json({
        version: '1.0',
        kind: 'webmcp_persona_journey',
        journey,
      });
    }),
  );

  app.get(
    '/api/bountynet/market/jobs',
    asyncHandler(async (req, res) => {
      const { status, payload } = await proxyGatewayJson({
        path: '/market/jobs?limit=20',
      });
      res.status(status).json(payload);
    }),
  );

  app.get(
    '/api/bountynet/market/operators',
    asyncHandler(async (_req, res) => {
      const { status, payload } = await proxyGatewayJson({
        path: '/market/operators',
      });
      res.status(status).json(payload);
    }),
  );

  app.post(
    '/api/bountynet/market/operators',
    asyncHandler(async (req, res) => {
      const { status, payload } = await proxyGatewayJson({
        path: '/market/operators',
        method: 'POST',
        body: req.body || {},
      });
      res.status(status).json(payload);
    }),
  );

  app.post(
    '/api/bountynet/market/operators/:operatorId/onboard',
    asyncHandler(async (req, res) => {
      const operatorId = encodeURIComponent(req.params.operatorId || '');
      const { status, payload } = await proxyGatewayJson({
        path: `/market/operators/${operatorId}/onboard`,
        method: 'POST',
        body: req.body || {},
      });
      res.status(status).json(payload);
    }),
  );

  app.get(
    '/api/bountynet/market/agents',
    asyncHandler(async (_req, res) => {
      const { status, payload } = await proxyGatewayJson({
        path: '/market/agents',
      });
      res.status(status).json(payload);
    }),
  );

  app.post(
    '/api/bountynet/market/agents',
    asyncHandler(async (req, res) => {
      const { status, payload } = await proxyGatewayJson({
        path: '/market/agents',
        method: 'POST',
        body: req.body || {},
      });
      res.status(status).json(payload);
    }),
  );

  app.get(
    '/api/bountynet/market/repositories',
    asyncHandler(async (_req, res) => {
      const { status, payload } = await proxyGatewayJson({
        path: '/market/repositories',
      });
      res.status(status).json(payload);
    }),
  );

  app.post(
    '/api/bountynet/market/seed',
    asyncHandler(async (_req, res) => {
      const { status, payload } = await proxyGatewayJson({
        path: '/market/agents/seed',
        method: 'POST',
        body: {},
      });
      res.status(status).json(payload);
    }),
  );

  app.post(
    '/api/bountynet/market/repositories/setup',
    asyncHandler(async (req, res) => {
      const { status, payload } = await proxyGatewayJson({
        path: '/market/repositories/setup',
        method: 'POST',
        body: req.body || {},
      });
      res.status(status).json(payload);
    }),
  );

  app.post(
    '/api/bountynet/market/repositories/:repo/apply-preset',
    asyncHandler(async (req, res) => {
      const repo = encodeURIComponent(req.params.repo || '');
      const { status, payload } = await proxyGatewayJson({
        path: `/market/repositories/${repo}/apply-preset`,
        method: 'POST',
        body: req.body || {},
      });
      res.status(status).json(payload);
    }),
  );

  app.post(
    '/api/bountynet/market/jobs',
    asyncHandler(async (req, res) => {
      const { status, payload } = await proxyGatewayJson({
        path: '/market/jobs',
        method: 'POST',
        body: req.body || {},
      });
      res.status(status).json(payload);
    }),
  );

  app.post(
    '/api/bountynet/market/jobs/:jobId/autopilot',
    asyncHandler(async (req, res) => {
      const jobId = encodeURIComponent(req.params.jobId || '');
      const { status, payload } = await proxyGatewayJson({
        path: `/market/jobs/${jobId}/autopilot`,
        method: 'POST',
        body: req.body || {},
      });
      res.status(status).json(payload);
    }),
  );

  app.get(
    '/api/bountynet/market/jobs/:jobId/offers',
    asyncHandler(async (req, res) => {
      const jobId = encodeURIComponent(req.params.jobId || '');
      const { status, payload } = await proxyGatewayJson({
        path: `/market/jobs/${jobId}/offers`,
      });
      res.status(status).json(payload);
    }),
  );

  app.post(
    '/api/bountynet/market/jobs/:jobId/offers',
    asyncHandler(async (req, res) => {
      const jobId = encodeURIComponent(req.params.jobId || '');
      const { status, payload } = await proxyGatewayJson({
        path: `/market/jobs/${jobId}/offers`,
        method: 'POST',
        body: req.body || {},
      });
      res.status(status).json(payload);
    }),
  );

  app.get(
    '/api/bountynet/market/jobs/:jobId/award',
    asyncHandler(async (req, res) => {
      const jobId = encodeURIComponent(req.params.jobId || '');
      const { status, payload } = await proxyGatewayJson({
        path: `/market/jobs/${jobId}/award`,
      });
      res.status(status).json(payload);
    }),
  );

  app.post(
    '/api/bountynet/market/jobs/:jobId/award',
    asyncHandler(async (req, res) => {
      const jobId = encodeURIComponent(req.params.jobId || '');
      const { status, payload } = await proxyGatewayJson({
        path: `/market/jobs/${jobId}/award`,
        method: 'POST',
        body: req.body || {},
      });
      res.status(status).json(payload);
    }),
  );

  app.get(
    '/api/bountynet/market/settlements',
    asyncHandler(async (_req, res) => {
      const { status, payload } = await proxyGatewayJson({
        path: '/market/settlements',
      });
      res.status(status).json(payload);
    }),
  );

  app.get(
    '/api/bountynet/market/jobs/:jobId/settlements',
    asyncHandler(async (req, res) => {
      const jobId = encodeURIComponent(req.params.jobId || '');
      const { status, payload } = await proxyGatewayJson({
        path: `/market/jobs/${jobId}/settlements`,
      });
      res.status(status).json(payload);
    }),
  );

  app.post(
    '/api/bountynet/market/settlements/:settlementId/pay',
    asyncHandler(async (req, res) => {
      const settlementId = encodeURIComponent(req.params.settlementId || '');
      const { status, payload } = await proxyGatewayJson({
        path: `/market/settlements/${settlementId}/pay`,
        method: 'POST',
        body: req.body || {},
      });
      res.status(status).json(payload);
    }),
  );

  app.post(
    '/api/bountynet/market/settlements/:settlementId/refund',
    asyncHandler(async (req, res) => {
      const settlementId = encodeURIComponent(req.params.settlementId || '');
      const { status, payload } = await proxyGatewayJson({
        path: `/market/settlements/${settlementId}/refund`,
        method: 'POST',
        body: req.body || {},
      });
      res.status(status).json(payload);
    }),
  );

  app.get(
    '/api/bountynet/market/jobs/:jobId/disputes',
    asyncHandler(async (req, res) => {
      const jobId = encodeURIComponent(req.params.jobId || '');
      const { status, payload } = await proxyGatewayJson({
        path: `/market/jobs/${jobId}/disputes`,
      });
      res.status(status).json(payload);
    }),
  );

  app.post(
    '/api/bountynet/market/jobs/:jobId/disputes',
    asyncHandler(async (req, res) => {
      const jobId = encodeURIComponent(req.params.jobId || '');
      const { status, payload } = await proxyGatewayJson({
        path: `/market/jobs/${jobId}/disputes`,
        method: 'POST',
        body: req.body || {},
      });
      res.status(status).json(payload);
    }),
  );

  app.post(
    '/api/bountynet/market/disputes/:disputeId/evidence',
    asyncHandler(async (req, res) => {
      const disputeId = encodeURIComponent(req.params.disputeId || '');
      const { status, payload } = await proxyGatewayJson({
        path: `/market/disputes/${disputeId}/evidence`,
        method: 'POST',
        body: req.body || {},
      });
      res.status(status).json(payload);
    }),
  );

  app.post(
    '/api/bountynet/market/disputes/:disputeId/resolve',
    asyncHandler(async (req, res) => {
      const disputeId = encodeURIComponent(req.params.disputeId || '');
      const { status, payload } = await proxyGatewayJson({
        path: `/market/disputes/${disputeId}/resolve`,
        method: 'POST',
        body: req.body || {},
      });
      res.status(status).json(payload);
    }),
  );

  app.get(
    '/api/bountynet/market/reputation/agents',
    asyncHandler(async (_req, res) => {
      const { status, payload } = await proxyGatewayJson({
        path: '/market/reputation/agents',
      });
      res.status(status).json(payload);
    }),
  );

  app.get(
    '/api/bountynet/market/reputation/operators',
    asyncHandler(async (_req, res) => {
      const { status, payload } = await proxyGatewayJson({
        path: '/market/reputation/operators',
      });
      res.status(status).json(payload);
    }),
  );

  app.get(
    '/api/bountynet/market/reputation/agents/:agentId',
    asyncHandler(async (req, res) => {
      const agentId = encodeURIComponent(req.params.agentId || '');
      const { status, payload } = await proxyGatewayJson({
        path: `/market/reputation/agents/${agentId}`,
      });
      res.status(status).json(payload);
    }),
  );

  app.post(
    '/api/bountynet/ops/market/operators/:operatorId/suspend',
    asyncHandler(async (req, res) => {
      const operatorId = encodeURIComponent(req.params.operatorId || '');
      const { status, payload } = await proxyGatewayJson({
        path: `/ops/market/operators/${operatorId}/suspend`,
        method: 'POST',
        body: req.body || {},
      });
      res.status(status).json(payload);
    }),
  );

  app.post(
    '/api/bountynet/ops/market/operators/:operatorId/unsuspend',
    asyncHandler(async (req, res) => {
      const operatorId = encodeURIComponent(req.params.operatorId || '');
      const { status, payload } = await proxyGatewayJson({
        path: `/ops/market/operators/${operatorId}/unsuspend`,
        method: 'POST',
        body: req.body || {},
      });
      res.status(status).json(payload);
    }),
  );

  app.post(
    '/api/bountynet/ops/market/agents/:agentId/suspend',
    asyncHandler(async (req, res) => {
      const agentId = encodeURIComponent(req.params.agentId || '');
      const { status, payload } = await proxyGatewayJson({
        path: `/ops/market/agents/${agentId}/suspend`,
        method: 'POST',
        body: req.body || {},
      });
      res.status(status).json(payload);
    }),
  );

  app.post(
    '/api/bountynet/ops/market/agents/:agentId/unsuspend',
    asyncHandler(async (req, res) => {
      const agentId = encodeURIComponent(req.params.agentId || '');
      const { status, payload } = await proxyGatewayJson({
        path: `/ops/market/agents/${agentId}/unsuspend`,
        method: 'POST',
        body: req.body || {},
      });
      res.status(status).json(payload);
    }),
  );

  app.post(
    '/api/bountynet/ops/market/settlements/:settlementId/freeze',
    asyncHandler(async (req, res) => {
      const settlementId = encodeURIComponent(req.params.settlementId || '');
      const { status, payload } = await proxyGatewayJson({
        path: `/ops/market/settlements/${settlementId}/freeze`,
        method: 'POST',
        body: req.body || {},
      });
      res.status(status).json(payload);
    }),
  );

  app.post(
    '/api/bountynet/ops/market/settlements/:settlementId/unfreeze',
    asyncHandler(async (req, res) => {
      const settlementId = encodeURIComponent(req.params.settlementId || '');
      const { status, payload } = await proxyGatewayJson({
        path: `/ops/market/settlements/${settlementId}/unfreeze`,
        method: 'POST',
        body: req.body || {},
      });
      res.status(status).json(payload);
    }),
  );

  app.get(
    '/api/bountynet/ops/market/incidents',
    asyncHandler(async (_req, res) => {
      const { status, payload } = await proxyGatewayJson({
        path: '/ops/market/incidents',
      });
      res.status(status).json(payload);
    }),
  );

  app.get(
    '/api/bountynet/ops/serving/topology',
    asyncHandler(async (_req, res) => {
      const { status, payload } = await proxyGatewayJson({
        path: '/ops/serving/topology',
      });
      res.status(status).json(payload);
    }),
  );

  app.get(
    '/api/bountynet/ops/infra/drift',
    asyncHandler(async (_req, res) => {
      const { status, payload } = await proxyGatewayJson({
        path: '/ops/infra/drift',
      });
      res.status(status).json(payload);
    }),
  );

  app.post(
    '/api/bountynet/ops/infra/drift/run',
    asyncHandler(async (req, res) => {
      const { status, payload } = await proxyGatewayJson({
        path: '/ops/infra/drift/run',
        method: 'POST',
        body: req.body || {},
      });
      res.status(status).json(payload);
    }),
  );

  app.get(
    '/api/bountynet/ops/components',
    asyncHandler(async (_req, res) => {
      const { status, payload } = await proxyGatewayJson({
        path: '/ops/components',
      });
      res.status(status).json(payload);
    }),
  );

  app.post(
    '/api/bountynet/ops/components/action',
    asyncHandler(async (req, res) => {
      const { status, payload } = await proxyGatewayJson({
        path: '/ops/components/action',
        method: 'POST',
        body: req.body || {},
      });
      res.status(status).json(payload);
    }),
  );

  app.get(
    '/api/bountynet/ops/observability/runbook',
    asyncHandler(async (_req, res) => {
      const { status, payload } = await proxyGatewayJson({
        path: '/ops/observability/runbook',
      });
      res.status(status).json(payload);
    }),
  );
};
