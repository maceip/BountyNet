"""
`sim_solver.py` — browser automation for the **solver** persona (solver journey via the web app).

Uses browser-use to exercise the BountyNet webapp end-to-end:
  1. Open the landing page
  2. Log in via the web auth widget (email or GitHub)
  3. Dashboard — agent status, balances
  4. Bounty feed — claimable work
  5. Claim through the UI
  6. Post-claim state
  7. Resolution when CI passes

This complements `sim/agent.py` (direct API/CLI path).

Usage:
  uv run python sim/sim_solver.py
  uv run python sim/sim_solver.py --email solver@test.local
  uv run python sim/sim_solver.py --headless
"""
import argparse
import asyncio
import logging
import os

logging.basicConfig(level=logging.INFO, format="%(asctime)s [sim-solver] %(message)s")
log = logging.getLogger("sim-solver")

SITE = os.environ.get("BOUNTYNET_URL", "https://bountynet.stare.network")
GATEWAY = os.environ.get("BOUNTYNET_GATEWAY", "https://gateway.stare.network")
_INSTALLATION_ID = os.environ.get("BOUNTYNET_INSTALLATION_ID", "").strip()


def _setup_url() -> str:
    if _INSTALLATION_ID:
        return f"{SITE}/setup?installation_id={_INSTALLATION_ID}"
    return f"{SITE}/setup"


async def run_solver(email: str = "", headless: bool = False, task: str = "explore"):
    from browser_use import Agent
    from browser_use.llm import ChatAnthropic

    llm = ChatAnthropic(
        model="claude-sonnet-4-20250514",
        api_key=os.environ.get("ANTHROPIC_API_KEY", ""),
    )

    instructions = f"""You are a BountyNet solver testing the web application at {SITE}.
Solvers claim CI-fix bounties, run inference through the gateway, and ship patches.

Your task: {_get_task_prompt(task, email)}

Important:
- Navigate carefully, wait for pages to load
- Take screenshots at key moments
- Report what you see at each step
- If something is broken or missing, note it clearly
- You are exercising the UI, not raw API calls
"""

    agent = Agent(
        task=instructions,
        llm=llm,
        browser_config={
            "headless": headless,
        },
    )

    result = await agent.run()
    log.info("sim-solver completed: %s", result)
    return result


def _get_task_prompt(task: str, email: str) -> str:
    prompts = {
        "explore": f"""
1. Go to {SITE}
2. Look at the landing page — note what you see (hero text, bounty feed, stats)
3. Click around — check the "How It Works" section, the "Stack" section
4. Look at the Network Stats card — are there live stats?
5. Check if there's an "Active Bounties" section — note any bounties listed
6. Click "Install GitHub App" — does it go to the right GitHub page?
7. Report: what works, what's broken, what's missing
""",
        "login": f"""
1. Go to {SITE}
2. Click the login widget (top right)
3. Try to sign in with email: {email or 'solver@test.local'}
4. If login succeeds — note what changes on the page
5. Check if you see: agent ID, wallet address, human-readable agent hostname if shown
6. Check if "Quick Actions" appear (Create Bounty, Watch for Bounties)
7. Report: login flow, post-login state, any errors
""",
        "setup": f"""
1. Go to {_setup_url()} (set BOUNTYNET_INSTALLATION_ID for a specific GitHub App install)
2. Note what the setup page shows
3. Check: is there a repo list? CI analysis section?
4. Check: is there an API key input and budget slider?
5. Try to interact with the slider
6. Report: setup flow completeness, any missing pieces
""",
        "bounty_feed": f"""
1. Go to {SITE}
2. Find the Active Bounties section
3. If there are bounties listed, note: repo name, status (claimable/claimed), amount
4. If no bounties, note that
5. Try to navigate to {GATEWAY}/bounties directly and compare
6. Report: does the web UI match the API data?
""",
        "full_flow": f"""
1. Go to {SITE}
2. Click login — sign in with email {email or 'solver@test.local'}
3. Wait for login to complete
4. Check dashboard — agent ID, wallet, balances
5. Look for bounties — are any claimable?
6. If there's a "Create Bounty" button, click it and note what happens
7. Navigate to {_setup_url()}
8. Check the setup page — scan results, config form
9. Go back to main page
10. Report: full end-to-end experience, what works, what breaks
""",
    }
    return prompts.get(task, prompts["explore"])


def main():
    p = argparse.ArgumentParser(description="Browser sim — solver journey (browser-use)")
    p.add_argument("--email", default="", help="Email for browser login flow")
    p.add_argument("--headless", action="store_true")
    p.add_argument("--task", default="explore",
                   choices=["explore", "login", "setup", "bounty_feed", "full_flow"])
    args = p.parse_args()

    log.info("starting sim_solver task=%s headless=%s", args.task, args.headless)
    asyncio.run(run_solver(args.email, args.headless, args.task))


if __name__ == "__main__":
    main()
