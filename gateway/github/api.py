"""Low-level GitHub REST helpers (token must be an installation token)."""

from __future__ import annotations

import base64
import textwrap

import requests

from gateway.github.app_auth import get_installation_token

BOUNTYNET_YML_DEFAULT = textwrap.dedent(
    """\
    # BountyNet — CI bounty bridge (added automatically by the BountyNet GitHub App).
    # Docs: https://github.com/maceip/BountyNet
    version: 1
    app: bountynet
    notify_on_failure: true
    """
).strip() + "\n"


def gh_post_comment(token: str, repo: str, sha: str, body: str) -> None:
    requests.post(
        f"https://api.github.com/repos/{repo}/commits/{sha}/comments",
        headers={"Authorization": f"token {token}", "Accept": "application/vnd.github+json"},
        json={"body": body},
        timeout=10,
    )


def gh_create_branch(token: str, repo: str, branch: str, from_sha: str) -> bool:
    resp = requests.post(
        f"https://api.github.com/repos/{repo}/git/refs",
        headers={"Authorization": f"token {token}", "Accept": "application/vnd.github+json"},
        json={"ref": f"refs/heads/{branch}", "sha": from_sha},
        timeout=10,
    )
    return resp.status_code in (200, 201)


def gh_commit_files(token: str, repo: str, branch: str, files: list, message: str) -> str | None:
    headers = {"Authorization": f"token {token}", "Accept": "application/vnd.github+json"}

    ref_resp = requests.get(
        f"https://api.github.com/repos/{repo}/git/ref/heads/{branch}",
        headers=headers,
        timeout=10,
    )
    if ref_resp.status_code != 200:
        return None
    base_sha = ref_resp.json()["object"]["sha"]

    commit_resp = requests.get(
        f"https://api.github.com/repos/{repo}/git/commits/{base_sha}",
        headers=headers,
        timeout=10,
    )
    base_tree = commit_resp.json()["tree"]["sha"]

    tree_items = []
    for f in files:
        blob = requests.post(
            f"https://api.github.com/repos/{repo}/git/blobs",
            headers=headers,
            json={"content": f["content"], "encoding": "utf-8"},
            timeout=10,
        ).json()
        tree_items.append({
            "path": f["path"],
            "mode": "100644",
            "type": "blob",
            "sha": blob["sha"],
        })

    tree = requests.post(
        f"https://api.github.com/repos/{repo}/git/trees",
        headers=headers,
        json={"base_tree": base_tree, "tree": tree_items},
        timeout=10,
    ).json()

    commit = requests.post(
        f"https://api.github.com/repos/{repo}/git/commits",
        headers=headers,
        json={"message": message, "tree": tree["sha"], "parents": [base_sha]},
        timeout=10,
    ).json()

    requests.patch(
        f"https://api.github.com/repos/{repo}/git/refs/heads/{branch}",
        headers=headers,
        json={"sha": commit["sha"]},
        timeout=10,
    )

    return commit.get("sha")


def gh_create_pr(token: str, repo: str, head: str, base: str, title: str, body: str) -> dict:
    return requests.post(
        f"https://api.github.com/repos/{repo}/pulls",
        headers={"Authorization": f"token {token}", "Accept": "application/vnd.github+json"},
        json={"title": title, "body": body, "head": head, "base": base},
        timeout=10,
    ).json()


def gh_default_branch(token: str, repo: str) -> str | None:
    resp = requests.get(
        f"https://api.github.com/repos/{repo}",
        headers={"Authorization": f"token {token}", "Accept": "application/vnd.github+json"},
        timeout=10,
    )
    if resp.status_code != 200:
        return None
    return resp.json().get("default_branch")


def gh_get_contents(token: str, repo: str, path: str, ref: str | None = None) -> dict | None:
    url = f"https://api.github.com/repos/{repo}/contents/{path}"
    params = {}
    if ref:
        params["ref"] = ref
    resp = requests.get(
        url,
        headers={"Authorization": f"token {token}", "Accept": "application/vnd.github+json"},
        params=params or None,
        timeout=15,
    )
    if resp.status_code == 404:
        return None
    if resp.status_code != 200:
        return None
    data = resp.json()
    return data if isinstance(data, dict) else None


def gh_create_file(
    token: str, repo: str, path: str, content: str, message: str, branch: str
) -> bool:
    b64 = base64.b64encode(content.encode("utf-8")).decode("ascii")
    resp = requests.put(
        f"https://api.github.com/repos/{repo}/contents/{path}",
        headers={"Authorization": f"token {token}", "Accept": "application/vnd.github+json"},
        json={"message": message, "content": b64, "branch": branch},
        timeout=20,
    )
    return resp.status_code in (200, 201)


def gh_ensure_bountynet_yml(token: str, repo: str) -> dict:
    """
    Create `.github/bountynet.yml` on the default branch when missing.
    Returns { "created": bool, "reason": str }.
    """
    branch = gh_default_branch(token, repo)
    if not branch:
        return {"created": False, "reason": "no_default_branch"}
    existing = gh_get_contents(token, repo, ".github/bountynet.yml", ref=branch)
    if existing and existing.get("type") == "file":
        return {"created": False, "reason": "already_present"}
    # Ensure .github exists by creating the file path (GitHub creates parent dirs).
    ok = gh_create_file(
        token,
        repo,
        ".github/bountynet.yml",
        BOUNTYNET_YML_DEFAULT,
        "chore: add BountyNet config (auto)",
        branch,
    )
    return {"created": ok, "reason": "committed" if ok else "api_error"}


def gh_list_repos(installation_id: int) -> list:
    token = get_installation_token(installation_id)
    if not token:
        return []
    resp = requests.get(
        "https://api.github.com/installation/repositories",
        headers={"Authorization": f"token {token}", "Accept": "application/vnd.github+json"},
        timeout=10,
    )
    return [r["full_name"] for r in resp.json().get("repositories", [])]
