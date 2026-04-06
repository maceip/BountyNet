"""
`sim_staker.py` — browser automation for the **staker** persona (repo owner / GitHub App onboarding).

Uses browser-use to automate:
  1. Visit bountynet.stare.network
  2. "Install GitHub App" → GitHub install page
  3. `/setup` (optionally `?installation_id=` from BOUNTYNET_INSTALLATION_ID)
  4. Repo scan
  5. API key + budget slider
  6. Activate
  7. Success screen
  8. Dashboard / bounty visibility

Usage:
  export ANTHROPIC_API_KEY=sk-ant-...
  uv run python sim/sim_staker.py --task full_flow
  uv run python sim/sim_staker.py --task setup_only --headless
"""
import argparse
import asyncio
import logging
import os

logging.basicConfig(level=logging.INFO, format="%(asctime)s [sim-staker] %(message)s")
log = logging.getLogger("sim-staker")

SITE = os.environ.get("BOUNTYNET_URL", "https://bountynet.stare.network")
GATEWAY = os.environ.get("BOUNTYNET_GATEWAY", "https://gateway.stare.network")
_INSTALLATION_ID = os.environ.get("BOUNTYNET_INSTALLATION_ID", "").strip()


def _setup_url() -> str:
    if _INSTALLATION_ID:
        return f"{SITE}/setup?installation_id={_INSTALLATION_ID}"
    return f"{SITE}/setup"


async def run_staker(headless: bool = False, task: str = "full_flow", api_key_to_paste: str = ""):
    from browser_use import Agent
    from browser_use.llm import ChatAnthropic

    llm = ChatAnthropic(
        model="claude-sonnet-4-20250514",
        api_key=os.environ.get("ANTHROPIC_API_KEY", ""),
    )

    instructions = f"""You are a developer who owns repos with failing CI — a BountyNet **staker**.
You are testing staker onboarding at {SITE}.
You have never used BountyNet before and have no prior crypto context.

Your task: {_get_task_prompt(task, api_key_to_paste)}

Important:
- You are a staker, not a solver
- You care about getting CI fixed, not earning crypto from others' work
- Note everything you see for review
- If something is confusing or broken, say so clearly
- Take your time, read the page before clicking
"""

    agent = Agent(
        task=instructions,
        llm=llm,
        browser_config={"headless": headless},
        generate_gif=f"sim_staker_{task}.gif",
    )

    result = await agent.run()
    log.info("sim-staker completed: %s", _summarize(result))
    return result


def _get_task_prompt(task: str, api_key: str) -> str:
    key = (api_key or os.environ.get("BOUNTYNET_TEST_API_KEY", "")).strip()
    if task in ("setup_only", "full_flow") and not key:
        raise SystemExit(
            "sim_staker: set --api-key or BOUNTYNET_TEST_API_KEY "
            "(no built-in placeholder secrets)."
        )

    prompts = {
        "landing": f"""
1. Go to {SITE}
2. Read the hero section. What does BountyNet claim to do?
3. Is there a clear call-to-action? What buttons do you see?
4. Scroll down. What sections are there?
5. Is there a bounty feed? What bounties are listed?
6. Check the Network stats. Is the system live?
7. Would you, as a developer, understand what this does in 10 seconds?
8. Report: first impressions, clarity, what's missing
""",
        "install_flow": f"""
1. Go to {SITE}
2. Find and click the "Install GitHub App" button
3. You should land on a GitHub page. What does it show?
4. DO NOT actually install — just note what the page looks like
5. Go back to {SITE}
6. Report: is the install flow clear? Would a dev trust this?
""",
        "setup_only": f"""
1. Go to {_setup_url()} (export BOUNTYNET_INSTALLATION_ID for a real GitHub App install)
2. What do you see? Is there a loading/scanning state?
3. Wait for the scan to complete (or timeout)
4. Are repos listed? Do they have status indicators?
5. Find the API key input. Type this test key: {key}
6. Find the budget slider. Move it to about 200k tokens
7. Check the cost estimate — does it update?
8. Look for the "Activate" button. Is it enabled now?
9. Click "Activate" and note what happens
10. Report: setup flow completeness, UX quality, any confusion
""",
        "full_flow": f"""
Walk through the entire staker experience:

1. Go to {SITE}
2. Read the landing page. Understand what BountyNet does.
3. Click "Install GitHub App" — note the GitHub page, then go back
4. Now go to {_setup_url()} (set BOUNTYNET_INSTALLATION_ID when exercising a real install)
5. Watch the scan results load
6. Look at what it found — any CI failures? Any suggestions?
7. In the API key field, type: {key}
8. Adjust the budget slider to your preference
9. Click "Activate"
10. On the success screen — what does it tell you?
11. Go back to {SITE} main page
12. Check if anything changed on the dashboard
13. Report your full experience:
    - Was onboarding clear?
    - Did you understand what you were paying for?
    - Would you trust this with your API key?
    - What was confusing?
    - What was impressive?
""",
        "check_bounties": f"""
1. Go to {SITE}
2. Look for any active bounties on the page
3. Go to {GATEWAY}/bounties and check the raw API response
4. Compare — does the website show the same bounties as the API?
5. Click on any bounty if possible
6. Report: bounty visibility, data accuracy, navigation
""",
    }
    return prompts.get(task, prompts["full_flow"])


def _summarize(result) -> str:
    try:
        results = result.all_results
        errors = sum(1 for r in results if r.error)
        done = any(r.is_done for r in results)
        return f"steps={len(results)} errors={errors} done={done}"
    except Exception:
        return str(result)[:200]


def main():
    p = argparse.ArgumentParser(description="Browser sim — staker journey (browser-use)")
    p.add_argument("--headless", action="store_true")
    p.add_argument("--task", default="full_flow",
                   choices=["landing", "install_flow", "setup_only", "full_flow", "check_bounties"])
    p.add_argument("--api-key", default="", help="API key text for the setup flow (or set BOUNTYNET_TEST_API_KEY)")
    args = p.parse_args()

    log.info("starting sim_staker task=%s headless=%s", args.task, args.headless)
    asyncio.run(run_staker(args.headless, args.task, args.api_key))


if __name__ == "__main__":
    main()
