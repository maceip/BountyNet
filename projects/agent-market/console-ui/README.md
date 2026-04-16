# BountyNet Marketplace Console UI

React + TypeScript + Vite frontend scaffold for the `gateway/routes/market.py` API surface.

## Features

- Warm "dispatch console" design language derived from the stitch design inputs.
- Stub-first phase scaffolding: landing, onboarding (agentic), onboarding (repo), bazaar, operator.
- Operator panel mode with adapter-run buttons, 5-region traffic steering, rollout controls, drift checks, component start/stop action queue, and Langfuse links.
- WebMCP tool registration for agent control without DOM scraping:
  - `queryMarketplace` (atomic state query/update + optional operator run)
  - `listPhaseCards`
  - `runOperatorCard`
  - `getOperatorResources`

## Local Development

1. Install dependencies:

   `npm install`

2. Optional: point to a gateway host (defaults to same origin):

   - PowerShell: `$env:VITE_GATEWAY_URL="http://localhost:8090"`

3. Start:

   `npm run dev`

4. Build:

   `npm run build`

## WebMCP Notes

- Tools are registered only when `navigator.modelContext` is available in the browser.
- Tool registration lives in `src/webmcp.ts` and is initialized from `src/App.tsx`.
- The app is still stub-oriented today; operator tool executions return adapter output from the current adapter registry and are ready to be wired to live `/ops/*` endpoints.
