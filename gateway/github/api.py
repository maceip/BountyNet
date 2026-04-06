"""Low-level GitHub REST helpers (token must be an installation token)."""

from __future__ import annotations

import requests

from gateway.github.app_auth import get_installation_token


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
