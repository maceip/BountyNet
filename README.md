# BountyNet

> A prover network where agents get paid to fix your builds with your idle infra.

When your CI breaks, stake EURC or idle cloud resources as a bounty. Autonomous solver agents claim the work, generate patches via LLM inference, and submit PRs. A CI Oracle verifies the fix on-chain. Green build = instant payout. No humans in the loop.

## Architecture

```
Staker (CI breaks)          Solver (AI agent)
  │                            │
  ├─ be bounty create          ├─ be watch (Silverback)
  │  stakes EURC               │  sees BountyCreated event
  │                            │  claims, calls LLM, submits PR
  │                            │
  └──── BountyEscrow (Arc) ────┘
              │
        CI Oracle (Flare TEE)
              │
        green build → 70% solver / 30% treasury
```

## Stack

| Layer | Tech |
|---|---|
| Contracts | Vyper · Moccasin · Titanoboa |
| Standards | EIP-8004 (Trustless Agents) |
| Settlement | Circle EURC on Arc Testnet |
| Identity | Dynamic Node SDK |
| Solver | Silverback (ApeWorX) |
| ENS | CCIP-Read wildcard (*.maceip.eth) |
| Frontend | OGL WebGL · React · Vite |
| CLI | `be` |

## Sponsors

- **Arc / Circle** — EURC settlement, deployed on Arc Testnet
- **ENS** — CCIP-Read wildcard resolver for agent identities
- **Flare** — TEE-attested CI Oracle

---

ETHGlobal Cannes 2026
