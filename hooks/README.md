# BountyNet Webhook Receivers

Three services, all behind Caddy on EC2:

| Service | Port | Route | Purpose |
|---|---|---|---|
| `github_ci.py` | 8091 | `/github` | GitHub App webhook — CI failure → bounty candidate |
| `ci_oracle.py` | 8092 | `/oracle` | CI Oracle — green build → on-chain validation + payout |
| ENS gateway | 8090 | `/{sender}/{data}.json` | CCIP-Read resolver for *.maceip.eth |

## Caddy routes

```
hooks.stare.network → localhost:8091 (GitHub App)
oracle.stare.network → localhost:8092 (CI Oracle)
gateway.stare.network → localhost:8090 (ENS CCIP-Read)
```
