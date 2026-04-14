# Specialist Matrix

## Purpose

This document defines the first specialist fleet for the trusted patching wedge.

Top-line product:

`An agent marketplace for accepted repository improvements.`

Immediate wedge:

`Trusted patching.`

Trusted patching includes:

- security patches
- dependency patches
- deprecation migrations
- component swaps
- validation and regression checking

## Why this wedge

These lanes are attractive because they are:

- commercially legible
- operationally urgent
- measurable
- demoable using historical repository events

They also avoid the weakest launch category:

- vague “AI code review” without clear economic or verification boundaries

## Pod strategy

The fleet should be organized by language pod first, then by patching lane.

Initial pods:

- `typescript`
- `python`
- `rust`

Do not attempt broad language coverage at launch.

## Matrix

| Lane | Pod strategy | What it does | Gold outcome | Honest auto-judge signals | Human / domain judgment | Core metrics | Historical corpus sources | Launch priority |
|---|---|---|---|---|---|---|---|---|
| `dependency_patch` | one specialist per language pod | keeps dependencies current with safe patch and minor updates | outdated or risky dependency is updated, checks pass, accepted PR lands | manifest and lockfile changed, tests pass, build passes, no immediate rollback, stale-package delta reduced | was the update worth landing now, did it introduce subtle compatibility risk | accepted rate, stale-package delta reduced, revert rate, cost per accepted update, median time to accepted PR | Dependabot PRs, Renovate PRs, lockfile update histories, package manifest diffs | `P0` |
| `security_patch` | one specialist per language pod | patches known vulnerabilities, advisories, and high-urgency incidents | vulnerability is removed or mitigated, checks pass, accepted PR lands | vulnerable version removed, advisory no longer applies, tests pass, build passes, scan output improves | was the mitigation correct, was patch scope controlled, was the risk model sound | time-to-patch, accepted rate, revert rate, vulnerability-removal rate, cost per accepted patch | GitHub Advisories, CVE-related PRs, OSV data, security fix commits | `P0` |
| `deprecation_migration` | one specialist per language pod | handles vendor, framework, and package deprecations before forced breakage | deprecated API or component is removed, supported replacement works, accepted PR lands | deprecated usage removed, replacement added, checks pass, config/build still valid | was the migration architecturally sound, did it preserve intended behavior | migration completion rate, accepted rate, time to accept, revert rate, cost per accepted migration | framework migration guides, old migration PRs, release-note-driven upgrade diffs | `P1` |
| `validation_regression` | cross-cutting specialist with pod-aware logic | validates that patches did not introduce regressions or fake fixes | patch survives regression checks and remains accepted | target checks pass, no net increase in failing checks, no obvious assertion weakening, no crash signals | did the patch preserve intent, did it cheat tests, is runtime behavior still credible | no-crash rate, regression pass rate, false-fix rate, patch survival rate | prior failing-to-green CI runs, flaky test histories, reverted patch sets | `P1` |
| `component_swap` | one specialist per language pod | swaps old libraries or services for approved replacements | old component removed, new component integrated, accepted PR lands | target dependency removed, replacement present, checks pass, diff matches approved migration scope | was the swap strategically correct, is the new dependency or service a good choice | swap completion rate, accepted rate, rollback rate, scope compliance, cost per accepted swap | service replacement PRs, library swap migrations, deprecated vendor exit projects | `P2` |

## Notes on research grounding

The specialist choice is supported by published trends and benchmarks:

- multilingual software engineering benchmarks now exist, which supports language-specific specialization rather than one generic coding agent for everything
- migration work is measurable enough to benchmark at repository level
- patch correctness remains a central failure mode in automated repair, which is why `validation_regression` must be first-class
- industry research is converging on agent-based repair and patching with verification, not just broad code review

Reference links:

- [Multi-SWE-bench](https://arxiv.org/abs/2504.02605)
- [MigrationBench](https://github.com/amazon-science/MigrationBench)
- [Invalidator](https://arxiv.org/abs/2301.01113)
- [Identifying Patch Correctness](https://arxiv.org/abs/1706.09120)
- [Evaluating Agent-based Program Repair at Google](https://arxiv.org/abs/2501.07531)
- [Google AI-powered patching](https://research.google/pubs/ai-powered-patching-the-future-of-automated-vulnerability-fixes/)

## Why `validation_regression` is in the first five

Without a dedicated validation lane, the system will over-reward patches that merely make tests green.

That is unacceptable for trusted patching.

Validation must be a first-class specialist because:

- automated patching often overfits visible checks
- “accepted” is good, but “accepted and survives” is better
- repository owners need evidence that patching is not just cosmetic

## Why `performance` is not in the first five

Performance is valuable but is not a strong launch lane because:

- the eval problem is much noisier
- it is easier to game
- performance success is workload-dependent
- the historical corpus is harder to normalize

Performance can become a later specialist lane after trusted patching is operating.

## Launch order

Recommended launch order:

1. `dependency_patch`
2. `security_patch`
3. `deprecation_migration`
4. `validation_regression`
5. `component_swap`

Reasoning:

- `dependency_patch` is frequent and easy to demonstrate
- `security_patch` is high-value and high-trust
- `deprecation_migration` supports the “don’t get forced into breakage” story
- `validation_regression` increases trust in the other lanes
- `component_swap` is valuable but more consultative and should follow once the core wedge works

## First visible market presentation

The product does not need to expose all specialists as separate cards immediately.

Initial market-facing categories can be:

- `Dependency patching`
- `Security patching`
- `Deprecation migration`
- `Component replacement`
- `Patch validation`

Each category can later fan out into language-pod specialists:

- `rust/security_patch`
- `python/dependency_patch`
- `typescript/deprecation_migration`

## First three demo scenarios

### Demo 1: Patch a vulnerable dependency

- input: repository with known vulnerable package
- specialist: `security_patch`
- success: accepted PR removes the vulnerable version and passes checks

### Demo 2: Update stale dependencies safely

- input: repository with multiple outdated but non-breaking updates
- specialist: `dependency_patch`
- success: accepted PR reduces stale-package delta and keeps the repo green

### Demo 3: Migrate off a deprecated component

- input: repository using a package or service marked deprecated
- specialist: `deprecation_migration`
- success: accepted PR replaces deprecated usage with approved supported alternative

## What to build next against this matrix

The matrix should drive implementation in three areas:

1. `specialist_spec`
   A machine-readable definition for each specialist.

2. recommendation engine
   Jobs should be routed based on lane, language pod, trust tier, and budget compatibility.

3. evaluation definitions
   Each specialist needs explicit success criteria and historical corpus sources.
