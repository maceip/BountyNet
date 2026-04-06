"""
SimVishy — human-like solver that interacts through the web app.

Uses browser-use to automate the BountyNet webapp:
  1. Navigate to bountynet.stare.network
  2. Log in via Dynamic (email or GitHub)
  3. View dashboard — check agent status, balances
  4. Browse bounty feed — find claimable bounties
  5. Claim a bounty through the UI
  6. Check agent status after claim
  7. View bounty resolution (if CI passes)

This exercises the FULL frontend → gateway → chain pipeline.
The agent sim (sim/agent.py) exercises the CLI/API path.
Together they cover both user personas.

Usage:
  uv run python sim/sim_vishy.py
  uv run python sim/sim_vishy.py --email vishy@test.com
  uv run python sim/sim_vishy.py --headless  # no browser window
"""
import asyncio
import argparse
import logging
import os

logging.basicConfig(level=logging.INFO, format="%(asctime)s [sim-vishy] %(message)s")
log = logging.getLogger("sim-vishy")

SITE = os.environ.get("BOUNTYNET_URL", "https://bountynet.stare.network")
GATEWAY = os.environ.get("BOUNTYNET_GATEWAY", "https://gateway.stare.network")
_INSTALLATION_ID = os.environ.get("BOUNTYNET_INSTALLATION_ID", "").strip()


def _setup_url() -> str:
    if _INSTALLATION_ID:
        return f"{SITE}/setup?installation_id={_INSTALLATION_ID}"
    return f"{SITE}/setup"


async def run_vishy(email: str = "", headless: bool = False, task: str = "explore"):
    from browser_use import Agent
    from browser_use.llm import ChatAnthropic

    llm = ChatAnthropic(
        model="claude-sonnet-4-20250514",
        api_key=os.environ.get("ANTHROPIC_API_KEY", ""),
    )

    instructions = f"""You are Vishy, a solver on the BountyNet network.
You are testing the BountyNet web application at {SITE}.

Your task: {_get_task_prompt(task, email)}

Important:
- Navigate carefully, wait for pages to load
- Take screenshots at key moments
- Report what you see at each step
- If something is broken or missing, note it clearly
- You are testing the UI, not the API
"""

    agent = Agent(
        task=instructions,
        llm=llm,
        browser_config={
            "headless": headless,
        },
    )

    result = await agent.run()
    log.info("sim-vishy completed: %s", result)
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
2. Click the Dynamic login widget (top right)
3. Try to sign in with email: {email or 'test@bountynet.dev'}
4. If login succeeds — note what changes on the page
5. Check if you see: agent ID, wallet address, ENS name
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
2. Click Dynamic login — sign in with email {email or 'test@bountynet.dev'}
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
    p = argparse.ArgumentParser(description="SimVishy — browser-automated solver")
    p.add_argument("--email", default="", help="Email for Dynamic login")
    p.add_argument("--headless", action="store_true")
    p.add_argument("--task", default="explore",
                   choices=["explore", "login", "setup", "bounty_feed", "full_flow"])
    args = p.parse_args()

    log.info("starting sim-vishy task=%s headless=%s", args.task, args.headless)
    asyncio.run(run_vishy(args.email, args.headless, args.task))


if __name__ == "__main__":
    main()
