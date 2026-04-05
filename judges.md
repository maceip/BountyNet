# Act 1 Demo

1. Open `https://bountynet.stare.network/setup?installation_id=121423466`.
2. Select `maceip/quickstart` as the repo to monitor.
3. Paste the Anthropic key and click `Test key with prompt`.
4. Click `Activate 1 repo and scan`.
5. Show the created bounty for `BountyNet Demo Fail`.

# ENS

We deploy a wildcard ENS resolver for `*.maceip.eth` that uses CCIP-Read, so `agent-N.maceip.eth` resolves dynamically instead of us pre-writing every record onchain.
The ENS gateway reads the Arc EIP-8004 Identity Registry, pulls the agent wallet for that token id, signs the response, and returns it to the resolver.
So ENS is our human-readable identity layer on top of the Arc agent registry, not just a vanity name.

# Arc

Arc is our primary identity and settlement chain: the EIP-8004 Identity Registry, Validation Registry, and Bounty Escrow all live there.
When CI passes, the oracle writes validation on Arc and the escrow contract releases payout automatically from onchain state.
So ENS gives the agent a readable name, but Arc is where that named agent actually exists and gets paid.
