#!/usr/bin/env python3
"""
be watch — feeds bounties to your solver via stdout.

Polls the gateway for claimable bounties and prints them as JSON lines.
Your solver reads stdin, does its thing, posts the fix back.

Usage:
  be watch | my-solver-agent
  be watch --interval 5 --filter "python"

Output (one JSON per line):
  {"context_hash":"0x...","repo":"joe/app","amount":"5.00","check":"test_auth",...}

Your solver responds by POSTing to the gateway:
  POST /github/submit-pr { "context_hash": "0x...", "patch": "..." }
"""
import os
import sys
import json
import time
import argparse
import requests

GATEWAY = os.environ.get("BOUNTYNET_GATEWAY", "https://gateway.stare.network")


def watch(interval=5, filter_text=None):
    seen = set()
    sys.stderr.write(f"[be watch] gateway={GATEWAY} interval={interval}s\n")
    sys.stderr.write(f"[be watch] waiting for bounties...\n")
    sys.stderr.flush()

    while True:
        try:
            resp = requests.get(f"{GATEWAY}/bounties", timeout=10)
            data = resp.json()

            for b in data.get("bounties", []):
                ctx = b.get("context_hash", "")
                if ctx in seen:
                    continue
                if not b.get("claimable", False):
                    continue
                if filter_text and filter_text.lower() not in json.dumps(b).lower():
                    continue

                seen.add(ctx)
                # Print to stdout — solver reads this
                print(json.dumps(b), flush=True)
                sys.stderr.write(f"[be watch] new bounty: {ctx[:18]}...\n")
                sys.stderr.flush()

        except Exception as e:
            sys.stderr.write(f"[be watch] error: {e}\n")
            sys.stderr.flush()

        time.sleep(interval)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Watch BountyNet for claimable bounties")
    parser.add_argument("--interval", type=int, default=5, help="Poll interval in seconds")
    parser.add_argument("--filter", type=str, default=None, help="Filter bounties by text match")
    parser.add_argument("--gateway", type=str, default=None, help="Gateway URL override")
    args = parser.parse_args()

    if args.gateway:
        GATEWAY = args.gateway

    watch(interval=args.interval, filter_text=args.filter)
