# BountyNet web (`web/`)

## What is actually in this repo

The app is a **single-page dashboard** in **`web/src/App.tsx`**: sidebar navigation between **Overview**, **Bounties**, **Gateway**, and **Resources** tabs. It calls the **gateway** (`VITE_GATEWAY_URL`, overridable via `localStorage` key `bountynet.gateway`).

Typical fetches: **`GET /health`**, **`GET /bounties`**, **`GET /events`**, **`GET /resources`**, **`GET /credits/rates`**. There is **no** React Router map of separate files per URL in this tree—deep links like **`/setup?installation_id=`** are expected to be served by the **deployed** site or another entry, not necessarily this Vite bundle.

## Auth (current split)

- **CLI:** `be join` → gateway Dynamic login + `POST /identity/onboard` (see [`ARCHITECTURE.md`](ARCHITECTURE.md)).
- **Android:** Chrome Custom Tab → `WEB_AUTH_URL` in `android/app/build.gradle.kts` (deep link back to the app).
- **This SPA:** focuses on **public / gateway-keyed reads**; it does **not** wire `@dynamic-labs` React SDK.

Anything describing `<DynamicProvider>`, `useAuth()`, `gatewayFetch()`, or a full **`/explore`** implementation was **removed or never landed in this branch**—treat old copies of this file as obsolete.

See also: [`web/README.md`](web/README.md), [`API.md`](API.md), [`GAPS.md`](GAPS.md).
