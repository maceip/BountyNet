# Repository layout

High-level grouping:

| Path | Role |
|------|------|
| **`clients/`** | User-facing apps: Android, Rust **`be`** CLI, Vite web dashboard, browser extension. |
| **`services/`** | Long-running / deployable companions: inference **proxy** injectors, **oracle-tee**, headless **wallet** + `dynamic_bridge.mjs`. |
| **`gateway/`** | Main HTTP API (Flask + ASGI): identity, bounties, GitHub app, inference, CCIP-Read helpers. |
| **`contracts/`** | Vyper contracts, Moccasin tests, CCIP resolver gateway (`contracts/gateway/`). |
| **`ops/`** | Operator tooling (e.g. `ops/runner/` — self-hosted Actions runner image + compose). |
| **`integrations/`** | Third-party bundles (Claude Code plugin, etc.). |
| **`scripts/`** | Repo maintenance (Android submodule patch, cron stubs). |
| **`action/`** | GitHub Marketplace action (stays at repo root by convention). |
| **`sim/`**, **`tools/`**, **`examples/`**, **`infra/`** | Simulation agents, utilities, samples, deployment notes. |

**Python path:** run gateway tests and the app with repo root on `PYTHONPATH` (e.g. `PYTHONPATH=.`), unchanged by this layout.

**Submodule:** `clients/android/third_party/keyattestation` → see [`clients/android/README.md`](clients/android/README.md).
