# BountyNet — Implementation Gaps

Tracked list. Everything here gets built or explicitly cut before submission.

## Done
- [x] GitHub comment notifications (github-app/app.py)
- [x] PR submission via GitHub App token (/github/submit-pr)
- [x] Inference credit display (/credits/<agent_id>)
- [x] Contracts: escrow, identity, validation (Arc Testnet)
- [x] ENS CCIP-Read wildcard resolver (Sepolia)
- [x] Gateway: unified API surface
- [x] Wallet: Dynamic identity + Circle settlement
- [x] bountynet/attest GitHub Action (OIDC)
- [x] Fleet reverse mapping (owner → agent IDs)
- [x] E2E test: register → bounty → claim → validate → payout
- [x] Proxy: API key budget mode (Joe deposits key + token budget)
- [x] `be watch`: stdout bounty feed for custom solvers
- [x] GitHub App: full webhook handler + solver PR submission

## In Progress

## Open
- [ ] Default bounty pricing (progressive escalation, no config from Joe)
- [ ] Gasless claims via Circle paymaster (Vishy never needs gas)
- [ ] Custom solver integration docs (REST API reference)
- [ ] SimBountyNet (fake activity loop for demo)
- [ ] Web dashboard: wire to gateway API (currently reads contract direct)
- [ ] `bountynet.yml` injection on GitHub App install

## Deferred (post-hackathon)
- [ ] Fiat onramp (API key model removes need for demo)
- [ ] Resource Claim NFT (idle infra as stake)
- [ ] Flare TEE attestation on CI Oracle
- [ ] Enclave runner (bountynet/attest-enclave)
- [ ] Principal→agent band model (attestation-based)
- [ ] EIP-712 Proof of Intent signatures
- [ ] Context Payload canonical format (.be-agent.toml)
- [ ] Compute Credits display (EURC → token conversion)
