# BountyNet web (`clients/web/`)

## Layout

The dashboard uses **React Router** (`clients/web/src/App.tsx`, `clients/web/src/layout/DashboardLayout.tsx`, pages under `clients/web/src/pages/`). It loads gateway data from `VITE_GATEWAY_URL` or `localStorage` (`bountynet.gateway`).

Typical calls: **`GET /health`**, **`GET /bounties`**, **`GET /events`**, **`GET /resources/claims`**, **`GET /credits/rates`**.

## Canonical flow

The canonical buyer path is the web setup flow:

1. Open `/setup`
2. Install the GitHub App
3. Return with `?installation_id=...`
4. Select repos
5. Add and test API key budget
6. Activate + scan for failing CI

The rest of the app is an operator/inspection surface around that path.

## Auth

- **CLI:** `be join` → `POST /identity/cli/sessions` → web `/auth/cli` → `POST /identity/onboard` (see [`ARCHITECTURE.md`](ARCHITECTURE.md)).
- **This SPA:** public reads, setup flow, and the browser-side CLI auth handoff at `/auth/cli`.

See [`clients/web/README.md`](clients/web/README.md), [`API.md`](API.md), [`GAPS.md`](GAPS.md), [`REPO_LAYOUT.md`](REPO_LAYOUT.md).
