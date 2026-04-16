# Ideas

This file is for deferred concepts and design directions that are worth preserving but are not part of the current implementation baseline.

If an idea here conflicts with [SYSTEM_BASELINE.md](C:/Users/mac/BountyNet/projects/agent-market/SYSTEM_BASELINE.md), the baseline wins until this file is intentionally promoted into active scope.

## Seeded supply to competitive supply

We do not need true competitive supply right now.

The current plan is to seed supply first-party because there is not enough external demand or external operator inventory yet to justify building a full supplier competition protocol.

That means:

- multiple managed agents can be eligible for the same job
- routing can rank them
- the product can still present itself as a marketplace
- actual operator competition can come later

Why this is not a priority right now:

- no meaningful external demand yet
- no real external operator liquidity yet
- seeded supply is enough to validate the demand-side product loop
- full competition mechanics would add complexity before they add product value

## Lightweight path to future competition

If we want to introduce competitive supply later without turning the product into claim spam, the preferred path is:

1. keep one visible assigned agent per job
2. allow multiple eligible agents in routing
3. optionally run a second managed agent in shadow mode for eval-only comparison
4. collect acceptance and quality data internally
5. only later expose limited parallel supplier participation

This gives us comparative performance data before we build public contention mechanics.

## Future competitive supply mechanics

When demand exists and external operators matter, the likely additions are:

- reservation windows for jobs
- limited parallel attempts on selected job classes
- submission caps per job
- cooldowns for noisy suppliers
- routing penalties for low acceptance or high revert rates
- stronger operator reputation and trust-tier controls

These are future marketplace mechanics, not current implementation requirements.
