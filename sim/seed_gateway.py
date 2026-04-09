"""
Populate a gateway with sample installations, bounties, claims, and optional inference.

Usage:
  python sim/seed_gateway.py
  python sim/seed_gateway.py --gateway https://example.com
"""
import os
import sys
import time

import requests

GATEWAY = (
    sys.argv[1]
    if len(sys.argv) > 1 and not sys.argv[1].startswith("--")
    else os.environ.get("BOUNTYNET_GATEWAY", "https://gateway.stare.network")
)
if "--gateway" in sys.argv:
    idx = sys.argv.index("--gateway")
    GATEWAY = sys.argv[idx + 1]

JOE_KEY = os.environ.get("ANTHROPIC_API_KEY", "")


def gw(path, **kw):
    method = kw.pop("method", "GET")
    if method == "POST":
        return requests.post(f"{GATEWAY}{path}", **kw, timeout=15)
    return requests.get(f"{GATEWAY}{path}", **kw, timeout=15)


print("=" * 50)
print("BOUNTYNET GATEWAY SEED")
print(f"Gateway: {GATEWAY}")
print("=" * 50)

print("\n--- 1. Seed installations ---")
for repo in ["example/freehold-relay", "example/scute", "example/bountynet"]:
    gw(
        "/github/setup",
        method="POST",
        json={
            "installation_id": 121423466,
            "repos": [repo],
            "budget_tokens": 150_000,
        },
    )
print("  3 repos configured")

print("\n--- 2. Create bounties ---")
bounty_specs = [
    ("example/freehold-relay", "build", 200_000, "staker"),
    ("example/freehold-relay", "lint & format", 75_000, "staker"),
    ("example/freehold-relay", "integration", 150_000, "staker"),
    ("example/scute", "cargo test", 100_000, "staker"),
    ("example/scute", "clippy", 50_000, "staker"),
    ("example/bountynet", "ci", 120_000, "staker"),
]

created = []
for repo, check, budget, _ in bounty_specs:
    body = {
        "repo": repo,
        "commit": f"seed-{int(time.time())}-{check.replace(' ', '')}",
        "check_name": check,
        "funding_kind": "inference_budget",
        "budget_tokens": budget,
    }
    if JOE_KEY:
        body["anthropic_key"] = JOE_KEY
    r = gw("/bounties/create", method="POST", json=body)
    ctx = r.json().get("context_hash", "")
    created.append((ctx, repo, check, budget))
    print(f"  {repo}:{check} {budget / 1000:.0f}k → {ctx[:16]}...")
    time.sleep(0.3)

print("\n--- 3. Claim bounties ---")
claimed_tokens = []
for _i, (ctx, repo, check, budget) in enumerate(created[:3]):
    r = gw(f"/bounties/{ctx}/claim", method="POST", json={"agent_id": 1})
    d = r.json()
    if d.get("status") == "claimed":
        claimed_tokens.append((ctx, d.get("bnet_token", ""), repo, check))
        print(f"  agent #1 claimed {repo}:{check}")
    time.sleep(0.2)

print("\n--- 4. Run inference ---")
if JOE_KEY and claimed_tokens:
    for ctx, token, repo, check in claimed_tokens[:2]:
        for j in range(3):
            r = requests.post(
                f"{GATEWAY}/v1/messages",
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "claude-sonnet-4-20250514",
                    "max_tokens": 40,
                    "messages": [
                        {
                            "role": "user",
                            "content": f"Analyze the {check} failure in {repo} step {j + 1}",
                        }
                    ],
                },
                timeout=30,
            )
            if r.status_code == 200:
                meta = r.json().get("_bountynet", {})
                print(
                    f"  {repo}:{check} call {j + 1} — {meta.get('cost_tokens', '?')} tokens (source={meta.get('key_source', '?')})"
                )
            time.sleep(0.5)
else:
    print("  skipped (no ANTHROPIC_API_KEY)")

print("\n--- 5. Stake compute resource ---")
r = gw(
    "/resources/claims",
    method="POST",
    json={
        "resource_type": 1,
        "provider": "aws",
        "spec": "r6i.8xlarge",
        "cores": 32,
        "memory_gb": 256,
        "token_budget": 500_000,
        "duration_hours": 48,
    },
)
print(f"  resource: {r.json().get('status', r.json().get('error', '?'))}")

print("\n--- 6. Verify ---")
r = gw("/bounties")
bounties = r.json().get("bounties", [])
claimable = sum(1 for b in bounties if b.get("claimable"))
claimed = sum(
    1 for b in bounties if not b.get("claimable") and not b.get("resolved")
)
print(f"  bounties: {len(bounties)} total, {claimable} claimable, {claimed} claimed")

r = gw("/sessions")
sessions = r.json().get("sessions", [])
print(f"  sessions: {len(sessions)}")

r = gw("/events?limit=20")
events = r.json().get("events", [])
print(f"  events: {len(events)}")
for e in events[-5:]:
    print(f"    [{e['kind']}] {e['message'][:60]}")

r = gw("/resources/claims")
resources = r.json().get("resources", [])
print(f"  resources: {len(resources)}")

print("\n" + "=" * 50)
print("SEED COMPLETE")
print(f"  {len(bounties)} bounties ({claimable} open)")
print(f"  {len(sessions)} sessions")
print(f"  {len(events)} events")
print(f"  {len(resources)} resources")
print("=" * 50)
print("\nOptional: python sim/agent.py --gateway", GATEWAY, "--honest")
