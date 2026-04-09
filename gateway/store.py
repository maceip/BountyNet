"""
SQLite persistence for gateway operational state.

Tables: installations, install_repos, bounty_prs, staker_budgets, solver_keys,
        credits, apikey_bounties, chatgpt_links, inference_calls, ci_failure_streak.

Env:
  BOUNTYNET_DB_PATH   — sqlite file (default: $BOUNTYNET_DATA_DIR/gateway.db or ~/.bountynet/gateway.db)
  BOUNTYNET_DATA_DIR  — directory for default db path
"""
from __future__ import annotations

import os
import sqlite3
import threading
import time
from pathlib import Path
from typing import Any

_lock = threading.RLock()

# Multipliers vs consecutive CI failures for the same repo+check (streak from DB: 1 = first failure).
_STREAK_MULTIPLIERS = (1.0, 1.15, 1.35, 1.6, 2.0, 2.5)


def db_path() -> str:
    data = os.environ.get("BOUNTYNET_DATA_DIR", "").strip()
    if not data:
        data = str(Path.home() / ".bountynet")
    Path(data).mkdir(parents=True, exist_ok=True)
    return os.environ.get("BOUNTYNET_DB_PATH", str(Path(data) / "gateway.db"))


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(db_path(), timeout=60.0, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db() -> None:
    with _lock:
        conn = _connect()
        try:
            conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS installations (
                    repo TEXT PRIMARY KEY,
                    installation_id INTEGER NOT NULL,
                    owner TEXT DEFAULT '',
                    github_id INTEGER DEFAULT 0,
                    api_key TEXT DEFAULT '',
                    budget_tokens INTEGER DEFAULT 100000,
                    budget_used INTEGER DEFAULT 0,
                    updated_at REAL DEFAULT 0
                );

                CREATE TABLE IF NOT EXISTS install_repos (
                    installation_id INTEGER NOT NULL,
                    repo TEXT NOT NULL,
                    PRIMARY KEY (installation_id, repo)
                );

                CREATE TABLE IF NOT EXISTS bounty_prs (
                    context_hash TEXT PRIMARY KEY,
                    pr_number INTEGER,
                    repo TEXT NOT NULL,
                    solver_agent_id INTEGER DEFAULT 0,
                    branch TEXT DEFAULT ''
                );

                CREATE TABLE IF NOT EXISTS staker_budgets (
                    context_hash TEXT PRIMARY KEY,
                    anthropic_key TEXT DEFAULT '',
                    openai_key TEXT DEFAULT '',
                    budget_tokens INTEGER DEFAULT 100000,
                    used_tokens INTEGER DEFAULT 0
                );

                CREATE TABLE IF NOT EXISTS solver_keys (
                    agent_id INTEGER PRIMARY KEY,
                    anthropic_key TEXT DEFAULT '',
                    openai_key TEXT DEFAULT ''
                );

                CREATE TABLE IF NOT EXISTS credits (
                    agent_id INTEGER PRIMARY KEY,
                    total INTEGER DEFAULT 0,
                    used INTEGER DEFAULT 0
                );

                CREATE TABLE IF NOT EXISTS apikey_bounties (
                    context_hash TEXT PRIMARY KEY,
                    repo TEXT DEFAULT '',
                    commit_ref TEXT DEFAULT '',
                    check_name TEXT DEFAULT '',
                    budget_tokens INTEGER DEFAULT 0,
                    budget_used INTEGER DEFAULT 0,
                    solver_agent_id INTEGER DEFAULT 0,
                    resolved INTEGER DEFAULT 0,
                    owner TEXT DEFAULT '',
                    created_at INTEGER DEFAULT 0
                );

                CREATE TABLE IF NOT EXISTS chatgpt_links (
                    link_id TEXT PRIMARY KEY,
                    label TEXT DEFAULT '',
                    api_key TEXT DEFAULT '',
                    budget_tokens INTEGER DEFAULT 100000,
                    budget_used INTEGER DEFAULT 0,
                    created_at INTEGER DEFAULT 0,
                    openai_sub TEXT DEFAULT ''
                );

                CREATE TABLE IF NOT EXISTS inference_calls (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    agent_id INTEGER NOT NULL,
                    context_hash TEXT DEFAULT '',
                    model TEXT DEFAULT '',
                    tokens_in INTEGER DEFAULT 0,
                    tokens_out INTEGER DEFAULT 0,
                    tokens_total INTEGER DEFAULT 0,
                    key_source TEXT DEFAULT '',
                    ts REAL NOT NULL
                );

                CREATE INDEX IF NOT EXISTS idx_inference_ctx ON inference_calls (context_hash);
                CREATE INDEX IF NOT EXISTS idx_inference_agent ON inference_calls (agent_id);

                CREATE TABLE IF NOT EXISTS ci_failure_streak (
                    repo TEXT NOT NULL,
                    check_name TEXT NOT NULL,
                    streak INTEGER NOT NULL DEFAULT 0,
                    updated_at REAL DEFAULT 0,
                    PRIMARY KEY (repo, check_name)
                );
                """
            )
            conn.commit()
        finally:
            conn.close()


def streak_multiplier(streak: int) -> float:
    if streak <= 1:
        return 1.0
    idx = min(streak - 1, len(_STREAK_MULTIPLIERS) - 1)
    return _STREAK_MULTIPLIERS[idx]


def bump_failure_streak(repo: str, check_name: str) -> int:
    """Increment failure count for repo+check; return new streak (>=1)."""
    now = time.time()
    with _lock:
        c = _connect()
        try:
            c.execute(
                """
                INSERT INTO ci_failure_streak (repo, check_name, streak, updated_at)
                VALUES (?, ?, 1, ?)
                ON CONFLICT(repo, check_name) DO UPDATE SET
                    streak = streak + 1,
                    updated_at = excluded.updated_at
                """,
                (repo, check_name, now),
            )
            row = c.execute(
                "SELECT streak FROM ci_failure_streak WHERE repo = ? AND check_name = ?",
                (repo, check_name),
            ).fetchone()
            c.commit()
            return int(row["streak"]) if row else 1
        finally:
            c.close()


def reset_failure_streak(repo: str, check_name: str) -> None:
    with _lock:
        c = _connect()
        try:
            c.execute(
                "DELETE FROM ci_failure_streak WHERE repo = ? AND check_name = ?",
                (repo, check_name),
            )
            c.commit()
        finally:
            c.close()


# --- installations ---

def installation_put(
    repo: str,
    installation_id: int,
    owner: str = "",
    github_id: int = 0,
    api_key: str = "",
    budget_tokens: int = 100_000,
    budget_used: int = 0,
) -> None:
    now = time.time()
    with _lock:
        c = _connect()
        try:
            c.execute(
                """
                INSERT INTO installations (
                    repo, installation_id, owner, github_id, api_key, budget_tokens, budget_used, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(repo) DO UPDATE SET
                    installation_id = excluded.installation_id,
                    owner = CASE WHEN excluded.owner != '' THEN excluded.owner ELSE owner END,
                    github_id = CASE WHEN excluded.github_id != 0 THEN excluded.github_id ELSE github_id END,
                    api_key = excluded.api_key,
                    budget_tokens = excluded.budget_tokens,
                    budget_used = excluded.budget_used,
                    updated_at = excluded.updated_at
                """,
                (
                    repo,
                    installation_id,
                    owner,
                    github_id,
                    api_key,
                    budget_tokens,
                    budget_used,
                    now,
                ),
            )
            c.commit()
        finally:
            c.close()


def installation_merge_setup(
    repo: str,
    installation_id: int,
    owner: str,
    api_key: str,
    budget_tokens: int,
) -> None:
    """POST /github/setup — preserve github_id when updating."""
    now = time.time()
    with _lock:
        c = _connect()
        try:
            row = c.execute(
                "SELECT github_id FROM installations WHERE repo = ?",
                (repo,),
            ).fetchone()
            gh = int(row["github_id"]) if row else 0
            c.execute(
                """
                INSERT INTO installations (
                    repo, installation_id, owner, github_id, api_key, budget_tokens, budget_used, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, 0, ?)
                ON CONFLICT(repo) DO UPDATE SET
                    installation_id = excluded.installation_id,
                    owner = CASE WHEN excluded.owner != '' THEN excluded.owner ELSE owner END,
                    api_key = excluded.api_key,
                    budget_tokens = excluded.budget_tokens,
                    updated_at = excluded.updated_at
                """,
                (repo, installation_id, owner, gh, api_key, budget_tokens, now),
            )
            c.commit()
        finally:
            c.close()


def installation_get(repo: str) -> dict[str, Any] | None:
    with _lock:
        c = _connect()
        try:
            row = c.execute(
                "SELECT * FROM installations WHERE repo = ?",
                (repo,),
            ).fetchone()
            if not row:
                return None
            return {
                "installation_id": row["installation_id"],
                "owner": row["owner"] or "",
                "github_id": row["github_id"] or 0,
                "api_key": row["api_key"] or "",
                "budget_tokens": row["budget_tokens"],
                "budget_used": row["budget_used"],
            }
        finally:
            c.close()


# --- install_repos ---

def install_repos_set(installation_id: int, repos: list[str]) -> None:
    with _lock:
        c = _connect()
        try:
            c.execute("DELETE FROM install_repos WHERE installation_id = ?", (installation_id,))
            for r in repos:
                c.execute(
                    "INSERT INTO install_repos (installation_id, repo) VALUES (?, ?)",
                    (installation_id, r),
                )
            c.commit()
        finally:
            c.close()


def install_repos_get(installation_id: int) -> list[str]:
    with _lock:
        c = _connect()
        try:
            rows = c.execute(
                "SELECT repo FROM install_repos WHERE installation_id = ? ORDER BY repo",
                (installation_id,),
            ).fetchall()
            return [str(r["repo"]) for r in rows]
        finally:
            c.close()


# --- bounty_prs ---

def bounty_pr_put(
    context_hash: str,
    pr_number: int | None,
    repo: str,
    solver_agent_id: int,
    branch: str,
) -> None:
    with _lock:
        c = _connect()
        try:
            c.execute(
                """
                INSERT INTO bounty_prs (context_hash, pr_number, repo, solver_agent_id, branch)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(context_hash) DO UPDATE SET
                    pr_number = excluded.pr_number,
                    repo = excluded.repo,
                    solver_agent_id = excluded.solver_agent_id,
                    branch = excluded.branch
                """,
                (context_hash, pr_number, repo, solver_agent_id, branch),
            )
            c.commit()
        finally:
            c.close()


def bounty_prs_for_repo(repo: str) -> list[tuple[str, dict[str, Any]]]:
    with _lock:
        c = _connect()
        try:
            rows = c.execute(
                "SELECT * FROM bounty_prs WHERE repo = ?",
                (repo,),
            ).fetchall()
            out = []
            for row in rows:
                out.append(
                    (
                        row["context_hash"],
                        {
                            "pr_number": row["pr_number"],
                            "repo": row["repo"],
                            "solver_agent_id": row["solver_agent_id"],
                            "branch": row["branch"],
                        },
                    )
                )
            return out
        finally:
            c.close()


# --- staker_budgets ---

def staker_budget_put(
    context_hash: str,
    anthropic_key: str,
    openai_key: str,
    budget_tokens: int,
    used_tokens: int = 0,
) -> None:
    with _lock:
        c = _connect()
        try:
            c.execute(
                """
                INSERT INTO staker_budgets (context_hash, anthropic_key, openai_key, budget_tokens, used_tokens)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(context_hash) DO UPDATE SET
                    anthropic_key = excluded.anthropic_key,
                    openai_key = excluded.openai_key,
                    budget_tokens = excluded.budget_tokens,
                    used_tokens = excluded.used_tokens
                """,
                (context_hash, anthropic_key, openai_key, budget_tokens, used_tokens),
            )
            c.commit()
        finally:
            c.close()


def staker_budget_get(context_hash: str) -> dict[str, Any] | None:
    with _lock:
        c = _connect()
        try:
            row = c.execute(
                "SELECT * FROM staker_budgets WHERE context_hash = ?",
                (context_hash,),
            ).fetchone()
            if not row:
                return None
            return {
                "anthropic_key": row["anthropic_key"] or "",
                "openai_key": row["openai_key"] or "",
                "budget_tokens": row["budget_tokens"],
                "used_tokens": row["used_tokens"],
            }
        finally:
            c.close()


def staker_budget_add_used(context_hash: str, delta: int) -> None:
    with _lock:
        c = _connect()
        try:
            c.execute(
                """
                UPDATE staker_budgets SET used_tokens = used_tokens + ?
                WHERE context_hash = ?
                """,
                (delta, context_hash),
            )
            c.commit()
        finally:
            c.close()


# --- solver_keys ---

def solver_keys_put(agent_id: int, anthropic_key: str, openai_key: str) -> None:
    with _lock:
        c = _connect()
        try:
            c.execute(
                """
                INSERT INTO solver_keys (agent_id, anthropic_key, openai_key)
                VALUES (?, ?, ?)
                ON CONFLICT(agent_id) DO UPDATE SET
                    anthropic_key = excluded.anthropic_key,
                    openai_key = excluded.openai_key
                """,
                (agent_id, anthropic_key, openai_key),
            )
            c.commit()
        finally:
            c.close()


def solver_keys_get(agent_id: int) -> dict[str, Any] | None:
    with _lock:
        c = _connect()
        try:
            row = c.execute(
                "SELECT * FROM solver_keys WHERE agent_id = ?",
                (agent_id,),
            ).fetchone()
            if not row:
                return None
            return {
                "anthropic_key": row["anthropic_key"] or "",
                "openai_key": row["openai_key"] or "",
            }
        finally:
            c.close()


# --- credits ---

def credits_get(agent_id: int) -> dict[str, int]:
    with _lock:
        c = _connect()
        try:
            row = c.execute(
                "SELECT total, used FROM credits WHERE agent_id = ?",
                (agent_id,),
            ).fetchone()
            if not row:
                return {"total": 0, "used": 0}
            return {"total": row["total"], "used": row["used"]}
        finally:
            c.close()


def credits_add_total(agent_id: int, delta: int) -> None:
    with _lock:
        c = _connect()
        try:
            c.execute(
                """
                INSERT INTO credits (agent_id, total, used) VALUES (?, ?, 0)
                ON CONFLICT(agent_id) DO UPDATE SET total = total + excluded.total
                """,
                (agent_id, delta),
            )
            c.commit()
        finally:
            c.close()


def credits_add_used(agent_id: int, delta: int) -> None:
    with _lock:
        c = _connect()
        try:
            c.execute(
                """
                INSERT INTO credits (agent_id, total, used) VALUES (?, 0, ?)
                ON CONFLICT(agent_id) DO UPDATE SET used = used + excluded.used
                """,
                (agent_id, delta),
            )
            c.commit()
        finally:
            c.close()


# --- apikey bounties ---

def apikey_bounty_upsert(context_hash: str, row: dict[str, Any]) -> None:
    with _lock:
        c = _connect()
        try:
            c.execute(
                """
                INSERT INTO apikey_bounties (
                    context_hash, repo, commit_ref, check_name, budget_tokens, budget_used,
                    solver_agent_id, resolved, owner, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(context_hash) DO UPDATE SET
                    repo = excluded.repo,
                    commit_ref = excluded.commit_ref,
                    check_name = excluded.check_name,
                    budget_tokens = excluded.budget_tokens,
                    budget_used = excluded.budget_used,
                    solver_agent_id = excluded.solver_agent_id,
                    resolved = excluded.resolved,
                    owner = excluded.owner,
                    created_at = excluded.created_at
                """,
                (
                    context_hash,
                    row.get("repo", ""),
                    row.get("commit", "") or row.get("commit_ref", ""),
                    row.get("check_name", ""),
                    int(row.get("budget_tokens", 0)),
                    int(row.get("budget_used", 0)),
                    int(row.get("solver_agent_id", 0)),
                    1 if row.get("resolved") else 0,
                    row.get("owner", ""),
                    int(row.get("created_at", 0)),
                ),
            )
            c.commit()
        finally:
            c.close()


def apikey_bounty_get(context_hash: str) -> dict[str, Any] | None:
    with _lock:
        c = _connect()
        try:
            row = c.execute(
                "SELECT * FROM apikey_bounties WHERE context_hash = ?",
                (context_hash,),
            ).fetchone()
            if not row:
                return None
            return _row_to_apikey_bounty(row)
        finally:
            c.close()


def _row_to_apikey_bounty(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "repo": row["repo"] or "",
        "commit": row["commit_ref"] or "",
        "check_name": row["check_name"] or "",
        "budget_tokens": row["budget_tokens"],
        "budget_used": row["budget_used"],
        "solver_agent_id": row["solver_agent_id"],
        "resolved": bool(row["resolved"]),
        "owner": row["owner"] or "",
        "created_at": row["created_at"],
    }


def apikey_bounties_all() -> dict[str, dict[str, Any]]:
    with _lock:
        c = _connect()
        try:
            rows = c.execute("SELECT * FROM apikey_bounties").fetchall()
            return {row["context_hash"]: _row_to_apikey_bounty(row) for row in rows}
        finally:
            c.close()


def apikey_bounty_mark_resolved(context_hash: str) -> None:
    """Mirror on-chain resolution when the same context exists in apikey_bounties."""
    with _lock:
        c = _connect()
        try:
            c.execute(
                "UPDATE apikey_bounties SET resolved = 1 WHERE context_hash = ?",
                (context_hash,),
            )
            c.commit()
        finally:
            c.close()


def apikey_bounty_set_solver(context_hash: str, agent_id: int) -> dict[str, Any] | None:
    """Mark bounty claimed by solver; returns full row dict or None."""
    with _lock:
        c = _connect()
        try:
            row = c.execute(
                "SELECT * FROM apikey_bounties WHERE context_hash = ?",
                (context_hash,),
            ).fetchone()
            if not row:
                return None
            c.execute(
                "UPDATE apikey_bounties SET solver_agent_id = ? WHERE context_hash = ?",
                (agent_id, context_hash),
            )
            c.commit()
            d = _row_to_apikey_bounty(row)
            d["solver_agent_id"] = agent_id
            return d
        finally:
            c.close()


# --- chatgpt ---

def chatgpt_link_create(link_id: str, label: str) -> None:
    with _lock:
        c = _connect()
        try:
            c.execute(
                """
                INSERT INTO chatgpt_links (link_id, label, api_key, budget_tokens, budget_used, created_at, openai_sub)
                VALUES (?, ?, '', 100000, 0, ?, '')
                """,
                (link_id, label, int(time.time())),
            )
            c.commit()
        finally:
            c.close()


def chatgpt_link_get(link_id: str) -> dict[str, Any] | None:
    with _lock:
        c = _connect()
        try:
            row = c.execute("SELECT * FROM chatgpt_links WHERE link_id = ?", (link_id,)).fetchone()
            if not row:
                return None
            return dict(row)
        finally:
            c.close()


def chatgpt_link_update_keys(
    link_id: str, api_key: str, budget_tokens: int, openai_sub: str
) -> None:
    with _lock:
        c = _connect()
        try:
            c.execute(
                """
                UPDATE chatgpt_links SET api_key = ?, budget_tokens = ?, openai_sub = ?
                WHERE link_id = ?
                """,
                (api_key, budget_tokens, openai_sub, link_id),
            )
            c.commit()
        finally:
            c.close()


def chatgpt_link_count() -> int:
    with _lock:
        c = _connect()
        try:
            row = c.execute("SELECT COUNT(*) AS n FROM chatgpt_links").fetchone()
            return int(row["n"]) if row else 0
        finally:
            c.close()


# --- inference log ---

def inference_append(entry: dict[str, Any]) -> None:
    with _lock:
        c = _connect()
        try:
            c.execute(
                """
                INSERT INTO inference_calls (
                    agent_id, context_hash, model, tokens_in, tokens_out, tokens_total, key_source, ts
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    entry["agent_id"],
                    entry.get("context_hash", ""),
                    entry.get("model", ""),
                    entry.get("tokens_in", 0),
                    entry.get("tokens_out", 0),
                    entry.get("tokens_total", 0),
                    entry.get("key_source", ""),
                    float(entry.get("timestamp", time.time())),
                ),
            )
            c.commit()
        finally:
            c.close()


def inference_recent(limit: int = 500) -> list[dict[str, Any]]:
    with _lock:
        c = _connect()
        try:
            rows = c.execute(
                """
                SELECT agent_id, context_hash, model, tokens_in, tokens_out, tokens_total, key_source, ts AS timestamp
                FROM inference_calls
                ORDER BY id DESC
                LIMIT ?
                """,
                (limit,),
            ).fetchall()
            # Return chronological for session grouping (oldest first within window)
            out = [dict(r) for r in reversed(rows)]
            return out
        finally:
            c.close()


def inference_prune(keep: int = 2000) -> None:
    """Delete older rows, keep the latest `keep` by id."""
    with _lock:
        c = _connect()
        try:
            c.execute(
                """
                DELETE FROM inference_calls WHERE id NOT IN (
                    SELECT id FROM inference_calls ORDER BY id DESC LIMIT ?
                )
                """,
                (keep,),
            )
            c.commit()
        finally:
            c.close()
