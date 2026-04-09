"""
GitHub REST stub for soak — enough of the git + PR API for install, yml, comments,
and `POST /github/submit-pr` (branch, commit, open PR).
"""

from __future__ import annotations

import hashlib
import json
import threading
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any


def _git_hash_object(obj_type: str, data: bytes) -> str:
    hdr = f"{obj_type} {len(data)}\0".encode()
    return hashlib.sha1(hdr + data).hexdigest()


class SoakGitHubState:
    """Per-repo git objects + refs (GitHub git DB subset)."""

    def __init__(self, owner: str, name: str) -> None:
        self.full_name = f"{owner}/{name}"
        self.blobs: dict[str, str] = {}  # sha -> utf-8 text
        self.trees: dict[str, list[dict]] = {}  # sha -> tree entries
        self.commits: dict[str, dict] = {}  # sha -> {tree, parents, message}
        self.refs: dict[str, str] = {}
        self.pulls: dict[int, dict[str, Any]] = {}
        self._pr_i = 1
        self._seed_main()

    def _add_tree(self, items: list[dict]) -> str:
        raw = json.dumps(items, sort_keys=True).encode()
        sha = _git_hash_object("tree", raw)
        self.trees[sha] = items
        return sha

    def _add_commit(self, tree_sha: str, parents: list[str], message: str) -> str:
        body = f"tree {tree_sha}\n".encode()
        for p in parents:
            body += f"parent {p}\n".encode()
        body += f"\n{message}".encode()
        sha = _git_hash_object("commit", body)
        self.commits[sha] = {"tree": tree_sha, "parents": parents, "message": message}
        return sha

    def _seed_main(self) -> None:
        empty_tree = self._add_tree([])
        c0 = self._add_commit(empty_tree, [], "initial soak")
        self.refs["refs/heads/main"] = c0

    def blob_from_utf8(self, text: str) -> str:
        data = text.encode("utf-8")
        sha = _git_hash_object("blob", data)
        self.blobs[sha] = text
        return sha

    def get_ref(self, ref_path: str) -> str | None:
        return self.refs.get(ref_path)

    def set_ref(self, ref_path: str, sha: str, force: bool = False) -> bool:
        if ref_path in self.refs and not force:
            return False
        self.refs[ref_path] = sha
        return True


class _Handler(BaseHTTPRequestHandler):
    server_version = "FakeGitHub/2.0"

    def log_message(self, format: str, *args: Any) -> None:  # noqa: A003
        pass

    def _json(self, code: int, payload: dict | list) -> None:
        raw = json.dumps(payload).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def _repo_state(self, owner: str, repo: str) -> SoakGitHubState:
        repos: dict[str, SoakGitHubState] = self.server.gh_repos  # type: ignore[attr-defined]
        key = f"{owner}/{repo}"
        if key not in repos:
            repos[key] = SoakGitHubState(owner, repo)
        return repos[key]

    def do_POST(self) -> None:  # noqa: N802
        path = urllib.parse.urlparse(self.path).path
        n = int(self.server.repo_note_lock["n"])  # type: ignore[attr-defined]

        if "/commits/" in path and path.endswith("/comments"):
            self._json(201, {"id": n, "body": "ok"})
            self.server.repo_note_lock["n"] = n + 1  # type: ignore[attr-defined]
            return

        if path.startswith("/app/installations/") and path.endswith("/access_tokens"):
            self._json(201, {"token": "soak-install-token", "expires_at": "2099-01-01T00:00:00Z"})
            return

        parts = path.strip("/").split("/")
        # POST /repos/{o}/{r}/git/blobs  (5 segments: repos, o, r, git, blobs)
        if (
            len(parts) >= 5
            and parts[0] == "repos"
            and parts[3] == "git"
            and parts[4] == "blobs"
        ):
            st = self._repo_state(parts[1], parts[2])
            ln = int(self.headers.get("Content-Length", "0"))
            payload = json.loads(self.rfile.read(ln).decode() or "{}")
            content = payload.get("content", "")
            sha = st.blob_from_utf8(content)
            self._json(201, {"sha": sha, "url": f"https://api.github.com/repos/{st.full_name}/git/blobs/{sha}"})
            return

        # POST /repos/{o}/{r}/git/trees
        if len(parts) >= 5 and parts[0] == "repos" and parts[3] == "git" and parts[4] == "trees":
            st = self._repo_state(parts[1], parts[2])
            ln = int(self.headers.get("Content-Length", "0"))
            payload = json.loads(self.rfile.read(ln).decode() or "{}")
            base_tree = payload.get("base_tree")
            tree_items = payload.get("tree", [])
            combined = []
            if base_tree and base_tree in st.trees:
                combined.extend(list(st.trees[base_tree]))
            combined.extend(tree_items)
            tree_sha = st._add_tree(combined)  # noqa: SLF001
            self._json(201, {"sha": tree_sha, "url": f"...trees/{tree_sha}"})
            return

        # POST /repos/{o}/{r}/git/commits
        if len(parts) >= 5 and parts[0] == "repos" and parts[3] == "git" and parts[4] == "commits":
            st = self._repo_state(parts[1], parts[2])
            ln = int(self.headers.get("Content-Length", "0"))
            payload = json.loads(self.rfile.read(ln).decode() or "{}")
            tree_sha = payload["tree"]
            parents = payload.get("parents", [])
            message = payload.get("message", "commit")
            commit_sha = st._add_commit(tree_sha, parents, message)  # noqa: SLF001
            self._json(201, {"sha": commit_sha, "url": f"...commits/{commit_sha}"})
            return

        # POST /repos/{o}/{r}/git/refs
        if len(parts) >= 5 and parts[0] == "repos" and parts[3] == "git" and parts[4] == "refs":
            st = self._repo_state(parts[1], parts[2])
            ln = int(self.headers.get("Content-Length", "0"))
            payload = json.loads(self.rfile.read(ln).decode() or "{}")
            ref = str(payload.get("ref", ""))
            if not ref.startswith("refs/"):
                ref = "refs/heads/" + ref.removeprefix("heads/")
            from_sha = payload["sha"]
            st.refs[ref] = from_sha
            self._json(201, {"ref": ref, "object": {"sha": from_sha, "type": "commit"}})
            return

        # POST /repos/{o}/{r}/pulls  (4 segments)
        if len(parts) == 4 and parts[0] == "repos" and parts[3] == "pulls":
            st = self._repo_state(parts[1], parts[2])
            ln = int(self.headers.get("Content-Length", "0"))
            payload = json.loads(self.rfile.read(ln).decode() or "{}")
            num = self.server.pr_counter  # type: ignore[attr-defined]
            self.server.pr_counter = num + 1  # type: ignore[attr-defined]
            head = payload.get("head", "branch")
            html_url = f"https://github.com/{st.full_name}/pull/{num}"
            st.pulls[num] = {
                "number": num,
                "html_url": html_url,
                "head": {"ref": head, "sha": st.refs.get(f"refs/heads/{head}", "")},
                "merged": False,
            }
            self._json(201, {"number": num, "html_url": html_url, "url": html_url})
            return

        self._json(404, {"message": "not found"})

    def do_GET(self) -> None:  # noqa: N802
        path = urllib.parse.urlparse(self.path).path
        parts = path.strip("/").split("/")

        if len(parts) == 2 and parts[0] == "installation" and parts[1] == "repositories":
            repo = self.server.default_repo_full  # type: ignore[attr-defined]
            self._json(
                200,
                {"repositories": [{"full_name": repo, "name": repo.split("/")[-1]}]},
            )
            return

        if len(parts) >= 4 and parts[0] == "repos" and parts[3] == "contents":
            self._json(404, {"message": "Not Found"})
            return

        if len(parts) == 3 and parts[0] == "repos":
            self._json(
                200,
                {"full_name": f"{parts[1]}/{parts[2]}", "default_branch": "main"},
            )
            return

        # GET /repos/{o}/{r}/git/ref/heads/{branch}  (branch may contain '/')
        if (
            len(parts) >= 7
            and parts[0] == "repos"
            and parts[3] == "git"
            and parts[4] == "ref"
            and parts[5] == "heads"
        ):
            st = self._repo_state(parts[1], parts[2])
            ref_path = f"refs/heads/{'/'.join(parts[6:])}"
            sha = st.get_ref(ref_path)
            if not sha:
                self._json(404, {"message": "Not Found"})
                return
            self._json(
                200,
                {"ref": ref_path, "object": {"sha": sha, "type": "commit"}},
            )
            return

        # GET /repos/{o}/{r}/git/commits/{sha}
        if len(parts) >= 6 and parts[0] == "repos" and parts[3] == "git" and parts[4] == "commits":
            st = self._repo_state(parts[1], parts[2])
            commit_sha = parts[5]
            c = st.commits.get(commit_sha)
            if not c:
                self._json(404, {"message": "Not Found"})
                return
            tree_sha = c["tree"]
            self._json(
                200,
                {"sha": commit_sha, "tree": {"sha": tree_sha}},
            )
            return

        self._json(404, {"message": "not found"})

    def do_PATCH(self) -> None:  # noqa: N802
        path = urllib.parse.urlparse(self.path).path
        parts = path.strip("/").split("/")
        # PATCH /repos/{o}/{r}/git/refs/heads/{branch}  (branch may contain '/')
        if (
            len(parts) >= 7
            and parts[0] == "repos"
            and parts[3] == "git"
            and parts[4] == "refs"
            and parts[5] == "heads"
        ):
            st = self._repo_state(parts[1], parts[2])
            ref_path = f"refs/heads/{'/'.join(parts[6:])}"
            ln = int(self.headers.get("Content-Length", "0"))
            payload = json.loads(self.rfile.read(ln).decode() or "{}")
            new_sha = payload["sha"]
            st.refs[ref_path] = new_sha
            self._json(200, {"ref": ref_path, "object": {"sha": new_sha, "type": "commit"}})
            return

        self._json(404, {"message": "not found"})

    def do_PUT(self) -> None:  # noqa: N802
        path = urllib.parse.urlparse(self.path).path
        parts = path.strip("/").split("/")
        if len(parts) >= 4 and parts[0] == "repos" and "contents" in parts:
            n = int(self.server.repo_note_lock["n"])  # type: ignore[attr-defined]
            self._json(201, {"commit": {"sha": f"fake{n:07x}"}, "content": {}})
            self.server.repo_note_lock["n"] = n + 1  # type: ignore[attr-defined]
            return
        self._json(404, {"message": "not found"})


class FakeGitHubServer:
    """Bind an ephemeral port and serve GITHUB_API-compatible paths."""

    def __init__(self, default_repo_full: str = "soak-owner/soak-repo") -> None:
        self.default_repo_full = default_repo_full
        self._httpd: ThreadingHTTPServer | None = None
        self._thread: threading.Thread | None = None
        self.port: int = 0

    def start(self) -> str:
        self._httpd = ThreadingHTTPServer(("127.0.0.1", 0), _Handler)
        self._httpd.repo_note_lock = {"n": 1}  # type: ignore[attr-defined]
        self._httpd.default_repo_full = self.default_repo_full  # type: ignore[attr-defined]
        self._httpd.gh_repos: dict[str, SoakGitHubState] = {}  # type: ignore[attr-defined]
        self._httpd.pr_counter = 1  # type: ignore[attr-defined]
        self.port = self._httpd.server_address[1]
        self._thread = threading.Thread(target=self._httpd.serve_forever, daemon=True)
        self._thread.start()
        return f"http://127.0.0.1:{self.port}"

    def shutdown(self) -> None:
        if self._httpd:
            self._httpd.shutdown()
            self._httpd.server_close()
            self._httpd = None
