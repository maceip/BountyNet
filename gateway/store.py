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
import json
from pathlib import Path
from typing import Any

_lock = threading.RLock()

# Multipliers vs consecutive CI failures for the same repo+check (streak from DB: 1 = first failure).
_STREAK_MULTIPLIERS = (1.0, 1.15, 1.35, 1.6, 2.0, 2.5)


def db_path() -> str:
    data = os.environ.get("BOUNTYNET_DATA_DIR", "").strip()
    if not data:
        data = str(Path.home() / ".bountynet")
    try:
        Path(data).mkdir(parents=True, exist_ok=True)
    except PermissionError:
        fallback = Path.cwd() / ".bountynet"
        fallback.mkdir(parents=True, exist_ok=True)
        data = str(fallback)
        os.environ.setdefault("BOUNTYNET_DATA_DIR", data)
    return os.environ.get("BOUNTYNET_DB_PATH", str(Path(data) / "gateway.db"))


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(db_path(), timeout=60.0, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def _ensure_column(conn: sqlite3.Connection, table: str, column: str, ddl: str) -> None:
    existing = {row["name"] for row in conn.execute(f"PRAGMA table_info({table})").fetchall()}
    if column not in existing:
        conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {ddl}")


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

                CREATE TABLE IF NOT EXISTS market_repository_accounts (
                    id TEXT PRIMARY KEY,
                    repo_full_name TEXT NOT NULL UNIQUE,
                    installation_id INTEGER DEFAULT 0,
                    owner_account_id TEXT DEFAULT '',
                    enabled_job_classes_json TEXT DEFAULT '[]',
                    blocked_paths_json TEXT DEFAULT '[]',
                    required_checks_json TEXT DEFAULT '[]',
                    review_policy TEXT DEFAULT 'maintainer_review',
                    merge_policy TEXT DEFAULT 'manual_merge',
                    budget_priority_json TEXT DEFAULT '["platform_credits"]',
                    monthly_spend_cap INTEGER DEFAULT 0,
                    per_job_spend_cap INTEGER DEFAULT 0,
                    allowed_agent_pools_json TEXT DEFAULT '[]',
                    api_key_provider TEXT DEFAULT '',
                    has_api_key_pool INTEGER DEFAULT 0,
                    local_path TEXT DEFAULT '',
                    default_branch TEXT DEFAULT 'main',
                    status TEXT DEFAULT 'active',
                    updated_at REAL DEFAULT 0
                );

                CREATE TABLE IF NOT EXISTS market_operators (
                    id TEXT PRIMARY KEY,
                    slug TEXT NOT NULL UNIQUE,
                    display_name TEXT NOT NULL,
                    summary TEXT DEFAULT '',
                    status TEXT DEFAULT 'pending',
                    onboarding_status TEXT DEFAULT 'draft',
                    identity_anchor TEXT DEFAULT '',
                    wallet TEXT DEFAULT '',
                    ens_name TEXT DEFAULT '',
                    verification_status TEXT DEFAULT 'unverified',
                    contact_email TEXT DEFAULT '',
                    website_url TEXT DEFAULT '',
                    metadata_json TEXT DEFAULT '{}',
                    created_at REAL DEFAULT 0,
                    updated_at REAL DEFAULT 0
                );

                CREATE TABLE IF NOT EXISTS market_agent_profiles (
                    id TEXT PRIMARY KEY,
                    slug TEXT NOT NULL UNIQUE,
                    display_name TEXT NOT NULL,
                    operator_id TEXT DEFAULT '',
                    summary TEXT DEFAULT '',
                    agent_kind TEXT DEFAULT 'generic',
                    pod TEXT DEFAULT '',
                    lane TEXT DEFAULT '',
                    supported_job_classes_json TEXT DEFAULT '[]',
                    supported_ecosystems_json TEXT DEFAULT '[]',
                    supported_budget_types_json TEXT DEFAULT '[]',
                    model TEXT DEFAULT '',
                    execution_backend TEXT DEFAULT '',
                    specialist_id TEXT DEFAULT '',
                    trust_tier TEXT DEFAULT 'standard',
                    pricing_profile TEXT DEFAULT 'per_accepted_change',
                    acceptance_rate_30d REAL DEFAULT 0,
                    median_time_to_pr_seconds INTEGER DEFAULT 0,
                    revert_rate_90d REAL DEFAULT 0,
                    badges_json TEXT DEFAULT '[]',
                    status TEXT DEFAULT 'active',
                    created_at REAL DEFAULT 0,
                    updated_at REAL DEFAULT 0
                );

                CREATE TABLE IF NOT EXISTS market_capability_manifests (
                    id TEXT PRIMARY KEY,
                    agent_id TEXT NOT NULL UNIQUE,
                    operator_id TEXT DEFAULT '',
                    manifest_version INTEGER DEFAULT 1,
                    job_classes_json TEXT DEFAULT '[]',
                    languages_json TEXT DEFAULT '[]',
                    package_managers_json TEXT DEFAULT '[]',
                    frameworks_json TEXT DEFAULT '[]',
                    ci_providers_json TEXT DEFAULT '[]',
                    max_change_scope TEXT DEFAULT 'medium',
                    allowed_file_classes_json TEXT DEFAULT '[]',
                    requires_human_review INTEGER DEFAULT 1,
                    can_open_prs INTEGER DEFAULT 0,
                    preferred_budget_types_json TEXT DEFAULT '[]',
                    signed_at TEXT DEFAULT '',
                    metadata_json TEXT DEFAULT '{}',
                    created_at REAL DEFAULT 0,
                    updated_at REAL DEFAULT 0,
                    FOREIGN KEY (agent_id) REFERENCES market_agent_profiles(id)
                );

                CREATE TABLE IF NOT EXISTS market_specialists (
                    id TEXT PRIMARY KEY,
                    slug TEXT NOT NULL UNIQUE,
                    display_name TEXT NOT NULL,
                    pod TEXT DEFAULT '',
                    lane TEXT DEFAULT '',
                    summary TEXT DEFAULT '',
                    supported_job_classes_json TEXT DEFAULT '[]',
                    supported_ecosystems_json TEXT DEFAULT '[]',
                    supported_budget_types_json TEXT DEFAULT '[]',
                    trust_tier TEXT DEFAULT 'standard',
                    review_requirement TEXT DEFAULT 'maintainer_review',
                    status TEXT DEFAULT 'active',
                    created_at REAL DEFAULT 0,
                    updated_at REAL DEFAULT 0
                );

                CREATE TABLE IF NOT EXISTS market_jobs (
                    id TEXT PRIMARY KEY,
                    repository_account_id TEXT NOT NULL,
                    repo_full_name TEXT NOT NULL,
                    job_class TEXT NOT NULL,
                    trigger_source TEXT DEFAULT '',
                    title TEXT DEFAULT '',
                    summary TEXT DEFAULT '',
                    risk_level TEXT DEFAULT 'medium',
                    acceptance_policy TEXT DEFAULT 'maintainer_accept_or_merge',
                    budget_ceiling INTEGER DEFAULT 0,
                    status TEXT DEFAULT 'open',
                    candidate_agents_json TEXT DEFAULT '[]',
                    source_event_key TEXT DEFAULT '',
                    metadata_json TEXT DEFAULT '{}',
                    created_at REAL DEFAULT 0,
                    expires_at REAL DEFAULT 0,
                    updated_at REAL DEFAULT 0,
                    FOREIGN KEY (repository_account_id) REFERENCES market_repository_accounts(id)
                );

                CREATE UNIQUE INDEX IF NOT EXISTS idx_market_jobs_source_event_key
                ON market_jobs(source_event_key) WHERE source_event_key != '';

                CREATE INDEX IF NOT EXISTS idx_market_jobs_repo ON market_jobs (repo_full_name, status);

                CREATE TABLE IF NOT EXISTS market_submissions (
                    id TEXT PRIMARY KEY,
                    job_id TEXT NOT NULL,
                    agent_id TEXT NOT NULL,
                    branch_name TEXT DEFAULT '',
                    pr_number INTEGER DEFAULT 0,
                    pr_url TEXT DEFAULT '',
                    diff_summary TEXT DEFAULT '',
                    evidence_json TEXT DEFAULT '{}',
                    status TEXT DEFAULT 'submitted',
                    acceptance_attribution TEXT DEFAULT '',
                    submitted_at REAL DEFAULT 0,
                    updated_at REAL DEFAULT 0,
                    FOREIGN KEY (job_id) REFERENCES market_jobs(id)
                );

                CREATE TABLE IF NOT EXISTS market_submission_reviews (
                    id TEXT PRIMARY KEY,
                    submission_id TEXT NOT NULL,
                    job_id TEXT NOT NULL,
                    agent_id TEXT NOT NULL,
                    reviewer_id TEXT DEFAULT '',
                    reviewer_role TEXT DEFAULT 'maintainer',
                    action TEXT NOT NULL,
                    summary TEXT DEFAULT '',
                    notes TEXT DEFAULT '',
                    payload_json TEXT DEFAULT '{}',
                    created_at REAL DEFAULT 0,
                    FOREIGN KEY (submission_id) REFERENCES market_submissions(id)
                );

                CREATE INDEX IF NOT EXISTS idx_market_submission_reviews_submission
                    ON market_submission_reviews (submission_id, created_at);
                CREATE INDEX IF NOT EXISTS idx_market_submission_reviews_job
                    ON market_submission_reviews (job_id, created_at);

                CREATE TABLE IF NOT EXISTS market_job_plans (
                    id TEXT PRIMARY KEY,
                    job_id TEXT NOT NULL,
                    agent_id TEXT DEFAULT '',
                    operator_id TEXT DEFAULT '',
                    summary TEXT DEFAULT '',
                    steps_json TEXT DEFAULT '[]',
                    estimated_cost INTEGER DEFAULT 0,
                    estimated_seconds INTEGER DEFAULT 0,
                    status TEXT DEFAULT 'proposed',
                    created_at REAL DEFAULT 0,
                    updated_at REAL DEFAULT 0,
                    FOREIGN KEY (job_id) REFERENCES market_jobs(id)
                );

                CREATE INDEX IF NOT EXISTS idx_market_job_plans_job ON market_job_plans (job_id, created_at);

                CREATE TABLE IF NOT EXISTS market_job_assignments (
                    id TEXT PRIMARY KEY,
                    job_id TEXT NOT NULL,
                    agent_id TEXT NOT NULL,
                    specialist_id TEXT DEFAULT '',
                    recommendation_id TEXT DEFAULT '',
                    plan_id TEXT DEFAULT '',
                    assigned_by TEXT DEFAULT '',
                    mode TEXT DEFAULT 'exclusive',
                    status TEXT DEFAULT 'active',
                    lease_expires_at REAL DEFAULT 0,
                    created_at REAL DEFAULT 0,
                    updated_at REAL DEFAULT 0,
                    FOREIGN KEY (job_id) REFERENCES market_jobs(id),
                    FOREIGN KEY (plan_id) REFERENCES market_job_plans(id)
                );

                CREATE INDEX IF NOT EXISTS idx_market_job_assignments_job ON market_job_assignments (job_id, created_at);

                CREATE TABLE IF NOT EXISTS market_job_recommendations (
                    id TEXT PRIMARY KEY,
                    job_id TEXT NOT NULL,
                    specialist_id TEXT NOT NULL,
                    score INTEGER DEFAULT 0,
                    recommended INTEGER DEFAULT 0,
                    policy_pass INTEGER DEFAULT 0,
                    budget_compatible INTEGER DEFAULT 0,
                    reasons_json TEXT DEFAULT '[]',
                    policy_warnings_json TEXT DEFAULT '[]',
                    payload_json TEXT DEFAULT '{}',
                    created_at REAL DEFAULT 0,
                    FOREIGN KEY (job_id) REFERENCES market_jobs(id)
                );

                CREATE INDEX IF NOT EXISTS idx_market_job_recommendations_job
                ON market_job_recommendations (job_id, created_at);

                CREATE TABLE IF NOT EXISTS market_offers (
                    id TEXT PRIMARY KEY,
                    job_id TEXT NOT NULL,
                    agent_id TEXT NOT NULL,
                    operator_id TEXT DEFAULT '',
                    amount INTEGER DEFAULT 0,
                    currency TEXT DEFAULT 'credits',
                    eta_seconds INTEGER DEFAULT 0,
                    sla_summary TEXT DEFAULT '',
                    notes TEXT DEFAULT '',
                    status TEXT DEFAULT 'open',
                    created_at REAL DEFAULT 0,
                    updated_at REAL DEFAULT 0,
                    FOREIGN KEY (job_id) REFERENCES market_jobs(id)
                );

                CREATE INDEX IF NOT EXISTS idx_market_offers_job
                ON market_offers (job_id, created_at);

                CREATE TABLE IF NOT EXISTS market_awards (
                    id TEXT PRIMARY KEY,
                    job_id TEXT NOT NULL UNIQUE,
                    offer_id TEXT NOT NULL,
                    awarded_agent_id TEXT NOT NULL,
                    awarded_by TEXT DEFAULT '',
                    decision_notes TEXT DEFAULT '',
                    status TEXT DEFAULT 'awarded',
                    created_at REAL DEFAULT 0,
                    updated_at REAL DEFAULT 0,
                    FOREIGN KEY (job_id) REFERENCES market_jobs(id),
                    FOREIGN KEY (offer_id) REFERENCES market_offers(id)
                );

                CREATE TABLE IF NOT EXISTS market_settlements (
                    id TEXT PRIMARY KEY,
                    job_id TEXT NOT NULL,
                    submission_id TEXT DEFAULT '',
                    award_id TEXT DEFAULT '',
                    agent_id TEXT DEFAULT '',
                    operator_id TEXT DEFAULT '',
                    amount INTEGER DEFAULT 0,
                    currency TEXT DEFAULT 'credits',
                    funding_source TEXT DEFAULT '',
                    status TEXT DEFAULT 'reserved',
                    frozen INTEGER DEFAULT 0,
                    resolution_notes TEXT DEFAULT '',
                    created_at REAL DEFAULT 0,
                    updated_at REAL DEFAULT 0,
                    FOREIGN KEY (job_id) REFERENCES market_jobs(id)
                );

                CREATE INDEX IF NOT EXISTS idx_market_settlements_job
                ON market_settlements (job_id, created_at);

                CREATE TABLE IF NOT EXISTS market_disputes (
                    id TEXT PRIMARY KEY,
                    job_id TEXT NOT NULL,
                    settlement_id TEXT DEFAULT '',
                    submission_id TEXT DEFAULT '',
                    opened_by TEXT DEFAULT '',
                    reason_code TEXT DEFAULT '',
                    reason TEXT DEFAULT '',
                    status TEXT DEFAULT 'open',
                    ruling TEXT DEFAULT '',
                    created_at REAL DEFAULT 0,
                    updated_at REAL DEFAULT 0,
                    resolved_at REAL DEFAULT 0,
                    FOREIGN KEY (job_id) REFERENCES market_jobs(id)
                );

                CREATE INDEX IF NOT EXISTS idx_market_disputes_job
                ON market_disputes (job_id, created_at);

                CREATE TABLE IF NOT EXISTS market_dispute_events (
                    id TEXT PRIMARY KEY,
                    dispute_id TEXT NOT NULL,
                    actor_id TEXT DEFAULT '',
                    event_type TEXT NOT NULL,
                    detail_json TEXT DEFAULT '{}',
                    created_at REAL DEFAULT 0,
                    FOREIGN KEY (dispute_id) REFERENCES market_disputes(id)
                );

                CREATE INDEX IF NOT EXISTS idx_market_dispute_events_dispute
                ON market_dispute_events (dispute_id, created_at);

                CREATE TABLE IF NOT EXISTS market_reputation_snapshots (
                    id TEXT PRIMARY KEY,
                    entity_type TEXT NOT NULL,
                    entity_id TEXT NOT NULL,
                    wins INTEGER DEFAULT 0,
                    rejects INTEGER DEFAULT 0,
                    disputes_total INTEGER DEFAULT 0,
                    disputes_won INTEGER DEFAULT 0,
                    refunds INTEGER DEFAULT 0,
                    total_jobs INTEGER DEFAULT 0,
                    score REAL DEFAULT 0,
                    last_event_at REAL DEFAULT 0,
                    updated_at REAL DEFAULT 0
                );

                CREATE UNIQUE INDEX IF NOT EXISTS idx_market_reputation_entity
                ON market_reputation_snapshots (entity_type, entity_id);

                CREATE TABLE IF NOT EXISTS market_admin_actions (
                    id TEXT PRIMARY KEY,
                    action_type TEXT NOT NULL,
                    target_type TEXT NOT NULL,
                    target_id TEXT NOT NULL,
                    actor TEXT DEFAULT '',
                    notes TEXT DEFAULT '',
                    status TEXT DEFAULT 'applied',
                    metadata_json TEXT DEFAULT '{}',
                    created_at REAL DEFAULT 0
                );

                CREATE INDEX IF NOT EXISTS idx_market_admin_actions_target
                ON market_admin_actions (target_type, target_id, created_at);

                CREATE TABLE IF NOT EXISTS market_payout_ledger (
                    id TEXT PRIMARY KEY,
                    agent_id TEXT NOT NULL,
                    operator_id TEXT DEFAULT '',
                    repository_account_id TEXT DEFAULT '',
                    job_id TEXT DEFAULT '',
                    submission_id TEXT DEFAULT '',
                    amount INTEGER DEFAULT 0,
                    currency TEXT DEFAULT 'credits',
                    funding_source TEXT DEFAULT '',
                    status TEXT DEFAULT 'pending',
                    notes TEXT DEFAULT '',
                    created_at REAL DEFAULT 0
                );

                CREATE TABLE IF NOT EXISTS market_execution_runs (
                    id TEXT PRIMARY KEY,
                    job_id TEXT NOT NULL,
                    agent_id TEXT NOT NULL,
                    repository_account_id TEXT NOT NULL,
                    assignment_id TEXT DEFAULT '',
                    mode TEXT DEFAULT 'apply',
                    status TEXT DEFAULT 'queued',
                    summary TEXT DEFAULT '',
                    logs_json TEXT DEFAULT '[]',
                    changed_files_json TEXT DEFAULT '[]',
                    evidence_json TEXT DEFAULT '{}',
                    submission_id TEXT DEFAULT '',
                    started_at REAL DEFAULT 0,
                    finished_at REAL DEFAULT 0,
                    created_at REAL DEFAULT 0,
                    updated_at REAL DEFAULT 0,
                    FOREIGN KEY (job_id) REFERENCES market_jobs(id)
                );

                CREATE INDEX IF NOT EXISTS idx_market_execution_runs_job
                ON market_execution_runs (job_id, created_at);

                CREATE TABLE IF NOT EXISTS market_opportunities (
                    id TEXT PRIMARY KEY,
                    repository_account_id TEXT NOT NULL,
                    repo_full_name TEXT NOT NULL,
                    opportunity_type TEXT NOT NULL,
                    title TEXT DEFAULT '',
                    summary TEXT DEFAULT '',
                    pod TEXT DEFAULT '',
                    lane TEXT DEFAULT '',
                    severity TEXT DEFAULT 'medium',
                    confidence REAL DEFAULT 0,
                    files_json TEXT DEFAULT '[]',
                    evidence_json TEXT DEFAULT '{}',
                    source_agent_id TEXT DEFAULT '',
                    status TEXT DEFAULT 'open',
                    created_at REAL DEFAULT 0,
                    updated_at REAL DEFAULT 0,
                    FOREIGN KEY (repository_account_id) REFERENCES market_repository_accounts(id)
                );

                CREATE INDEX IF NOT EXISTS idx_market_opportunities_repo
                ON market_opportunities (repo_full_name, status, created_at);

                CREATE TABLE IF NOT EXISTS market_agent_invocations (
                    id TEXT PRIMARY KEY,
                    job_id TEXT DEFAULT '',
                    agent_id TEXT NOT NULL,
                    repository_account_id TEXT DEFAULT '',
                    model TEXT DEFAULT '',
                    provider TEXT DEFAULT '',
                    status TEXT DEFAULT 'pending',
                    request_json TEXT DEFAULT '{}',
                    response_json TEXT DEFAULT '{}',
                    tool_calls_json TEXT DEFAULT '[]',
                    validations_json TEXT DEFAULT '[]',
                    tokens_in INTEGER DEFAULT 0,
                    tokens_out INTEGER DEFAULT 0,
                    started_at REAL DEFAULT 0,
                    finished_at REAL DEFAULT 0,
                    created_at REAL DEFAULT 0,
                    updated_at REAL DEFAULT 0
                );

                CREATE INDEX IF NOT EXISTS idx_market_agent_invocations_job
                ON market_agent_invocations (job_id, created_at);

                CREATE TABLE IF NOT EXISTS market_ops_traffic_state (
                    id INTEGER PRIMARY KEY CHECK (id = 1),
                    us_percent INTEGER DEFAULT 50,
                    eu_percent INTEGER DEFAULT 50,
                    regional_weights_json TEXT DEFAULT '{}',
                    changed_by TEXT DEFAULT '',
                    notes TEXT DEFAULT '',
                    updated_at REAL DEFAULT 0
                );

                CREATE TABLE IF NOT EXISTS market_ops_model_rollouts (
                    id TEXT PRIMARY KEY,
                    target TEXT NOT NULL,
                    revision TEXT NOT NULL,
                    strategy TEXT DEFAULT 'canary',
                    requested_by TEXT DEFAULT '',
                    status TEXT DEFAULT 'queued',
                    metadata_json TEXT DEFAULT '{}',
                    created_at REAL DEFAULT 0,
                    updated_at REAL DEFAULT 0
                );

                CREATE TABLE IF NOT EXISTS market_ops_component_state (
                    component_id TEXT PRIMARY KEY,
                    desired_state TEXT DEFAULT 'running',
                    last_action TEXT DEFAULT '',
                    updated_by TEXT DEFAULT '',
                    notes TEXT DEFAULT '',
                    metadata_json TEXT DEFAULT '{}',
                    updated_at REAL DEFAULT 0
                );

                CREATE TABLE IF NOT EXISTS market_ops_component_actions (
                    id TEXT PRIMARY KEY,
                    component_id TEXT NOT NULL,
                    action TEXT NOT NULL,
                    requested_by TEXT DEFAULT '',
                    status TEXT DEFAULT 'queued',
                    notes TEXT DEFAULT '',
                    metadata_json TEXT DEFAULT '{}',
                    created_at REAL DEFAULT 0
                );

                CREATE TABLE IF NOT EXISTS market_ops_drift_runs (
                    id TEXT PRIMARY KEY,
                    module_key TEXT NOT NULL,
                    module_path TEXT NOT NULL,
                    trigger TEXT DEFAULT 'scheduled',
                    status TEXT DEFAULT 'queued',
                    exit_code INTEGER DEFAULT 0,
                    drift_detected INTEGER DEFAULT 0,
                    stdout_text TEXT DEFAULT '',
                    stderr_text TEXT DEFAULT '',
                    diff_summary_json TEXT DEFAULT '{}',
                    created_at REAL DEFAULT 0,
                    started_at REAL DEFAULT 0,
                    finished_at REAL DEFAULT 0
                );

                CREATE TABLE IF NOT EXISTS market_ops_alerts (
                    id TEXT PRIMARY KEY,
                    alert_type TEXT NOT NULL,
                    severity TEXT DEFAULT 'info',
                    source TEXT DEFAULT '',
                    message TEXT DEFAULT '',
                    metadata_json TEXT DEFAULT '{}',
                    acknowledged INTEGER DEFAULT 0,
                    created_at REAL DEFAULT 0,
                    acknowledged_at REAL DEFAULT 0
                );

                CREATE TABLE IF NOT EXISTS auth_principals (
                    id TEXT PRIMARY KEY,
                    status TEXT DEFAULT 'active',
                    display_name TEXT DEFAULT '',
                    created_at REAL DEFAULT 0,
                    updated_at REAL DEFAULT 0
                );

                CREATE TABLE IF NOT EXISTS auth_identifiers (
                    id TEXT PRIMARY KEY,
                    principal_id TEXT NOT NULL,
                    kind TEXT NOT NULL,
                    value_norm TEXT NOT NULL,
                    verified_at REAL DEFAULT 0,
                    metadata_json TEXT DEFAULT '{}',
                    created_at REAL DEFAULT 0,
                    updated_at REAL DEFAULT 0,
                    UNIQUE(kind, value_norm),
                    FOREIGN KEY (principal_id) REFERENCES auth_principals(id)
                );

                CREATE TABLE IF NOT EXISTS auth_credentials (
                    id TEXT PRIMARY KEY,
                    principal_id TEXT NOT NULL,
                    type TEXT NOT NULL,
                    public_data_json TEXT DEFAULT '{}',
                    status TEXT DEFAULT 'active',
                    created_at REAL DEFAULT 0,
                    last_used_at REAL DEFAULT 0,
                    FOREIGN KEY (principal_id) REFERENCES auth_principals(id)
                );

                CREATE TABLE IF NOT EXISTS auth_devices (
                    id TEXT PRIMARY KEY,
                    principal_id TEXT NOT NULL,
                    device_label TEXT DEFAULT '',
                    device_pubkey TEXT DEFAULT '',
                    device_fingerprint_hash TEXT DEFAULT '',
                    trust_level TEXT DEFAULT 'standard',
                    attestation_type TEXT DEFAULT '',
                    attestation_json TEXT DEFAULT '{}',
                    created_at REAL DEFAULT 0,
                    last_seen_at REAL DEFAULT 0,
                    FOREIGN KEY (principal_id) REFERENCES auth_principals(id)
                );

                CREATE TABLE IF NOT EXISTS auth_challenges (
                    id TEXT PRIMARY KEY,
                    principal_hint TEXT DEFAULT '',
                    factor_type TEXT NOT NULL,
                    purpose TEXT DEFAULT 'login',
                    nonce TEXT NOT NULL,
                    payload_json TEXT DEFAULT '{}',
                    ip_hash TEXT DEFAULT '',
                    ua_hash TEXT DEFAULT '',
                    expires_at REAL DEFAULT 0,
                    consumed_at REAL DEFAULT 0,
                    created_at REAL DEFAULT 0
                );

                CREATE INDEX IF NOT EXISTS idx_auth_challenges_exp
                ON auth_challenges (expires_at, consumed_at);

                CREATE TABLE IF NOT EXISTS auth_sessions (
                    id TEXT PRIMARY KEY,
                    principal_id TEXT NOT NULL,
                    device_id TEXT DEFAULT '',
                    device_fingerprint_hash TEXT DEFAULT '',
                    session_secret_hash TEXT NOT NULL,
                    csrf_secret_hash TEXT DEFAULT '',
                    aal INTEGER DEFAULT 1,
                    roles_json TEXT DEFAULT '[]',
                    issued_at REAL DEFAULT 0,
                    expires_at REAL DEFAULT 0,
                    rotated_from TEXT DEFAULT '',
                    revoked_at REAL DEFAULT 0,
                    created_at REAL DEFAULT 0,
                    updated_at REAL DEFAULT 0,
                    FOREIGN KEY (principal_id) REFERENCES auth_principals(id)
                );

                CREATE INDEX IF NOT EXISTS idx_auth_sessions_secret
                ON auth_sessions (session_secret_hash);

                CREATE TABLE IF NOT EXISTS auth_session_events (
                    id TEXT PRIMARY KEY,
                    session_id TEXT NOT NULL,
                    event TEXT NOT NULL,
                    meta_json TEXT DEFAULT '{}',
                    ts REAL DEFAULT 0
                );

                CREATE TABLE IF NOT EXISTS auth_magic_links (
                    id TEXT PRIMARY KEY,
                    principal_id TEXT DEFAULT '',
                    email_norm TEXT NOT NULL,
                    token_hash TEXT NOT NULL,
                    ip_hash TEXT DEFAULT '',
                    expires_at REAL DEFAULT 0,
                    used_at REAL DEFAULT 0,
                    created_at REAL DEFAULT 0
                );

                CREATE INDEX IF NOT EXISTS idx_auth_magic_links_token
                ON auth_magic_links (token_hash, expires_at, used_at);

                CREATE TABLE IF NOT EXISTS auth_credential_bindings (
                    id TEXT PRIMARY KEY,
                    principal_id TEXT NOT NULL,
                    credential_id TEXT NOT NULL,
                    bound_by_session TEXT DEFAULT '',
                    bound_at REAL DEFAULT 0,
                    UNIQUE(principal_id, credential_id)
                );

                CREATE TABLE IF NOT EXISTS auth_authorizations (
                    id TEXT PRIMARY KEY,
                    principal_id TEXT NOT NULL,
                    role TEXT NOT NULL,
                    scope TEXT DEFAULT '*',
                    granted_by TEXT DEFAULT '',
                    granted_at REAL DEFAULT 0,
                    expires_at REAL DEFAULT 0,
                    metadata_json TEXT DEFAULT '{}',
                    FOREIGN KEY (principal_id) REFERENCES auth_principals(id)
                );

                CREATE INDEX IF NOT EXISTS idx_auth_authorizations_principal
                ON auth_authorizations (principal_id, role, scope, expires_at);

                CREATE TABLE IF NOT EXISTS auth_rate_limits (
                    id TEXT PRIMARY KEY,
                    key TEXT NOT NULL UNIQUE,
                    count INTEGER DEFAULT 0,
                    window_start REAL DEFAULT 0,
                    updated_at REAL DEFAULT 0
                );
                """
            )
            _ensure_column(conn, "market_repository_accounts", "local_path", "TEXT DEFAULT ''")
            _ensure_column(conn, "market_repository_accounts", "default_branch", "TEXT DEFAULT 'main'")
            _ensure_column(conn, "market_agent_profiles", "agent_kind", "TEXT DEFAULT 'generic'")
            _ensure_column(conn, "market_agent_profiles", "pod", "TEXT DEFAULT ''")
            _ensure_column(conn, "market_agent_profiles", "lane", "TEXT DEFAULT ''")
            _ensure_column(conn, "market_agent_profiles", "supported_budget_types_json", "TEXT DEFAULT '[]'")
            _ensure_column(conn, "market_agent_profiles", "model", "TEXT DEFAULT ''")
            _ensure_column(conn, "market_agent_profiles", "execution_backend", "TEXT DEFAULT ''")
            _ensure_column(conn, "market_agent_profiles", "specialist_id", "TEXT DEFAULT ''")
            _ensure_column(conn, "market_payout_ledger", "funding_source", "TEXT DEFAULT ''")
            _ensure_column(conn, "market_payout_ledger", "notes", "TEXT DEFAULT ''")
            _ensure_column(conn, "market_ops_traffic_state", "regional_weights_json", "TEXT DEFAULT '{}'")
            _ensure_column(conn, "market_ops_component_actions", "execution_mode", "TEXT DEFAULT 'dry_run'")
            _ensure_column(conn, "market_ops_component_actions", "approved_by", "TEXT DEFAULT ''")
            _ensure_column(conn, "market_ops_component_actions", "approved_at", "REAL DEFAULT 0")
            _ensure_column(conn, "market_ops_component_actions", "started_at", "REAL DEFAULT 0")
            _ensure_column(conn, "market_ops_component_actions", "finished_at", "REAL DEFAULT 0")
            _ensure_column(conn, "market_ops_component_actions", "command_trace", "TEXT DEFAULT ''")
            _ensure_column(conn, "market_ops_component_actions", "error_trace", "TEXT DEFAULT ''")
            _ensure_column(conn, "market_ops_component_actions", "rollback_of_action_id", "TEXT DEFAULT ''")
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


def _json_loads(raw: str, default: Any) -> Any:
    try:
        return json.loads(raw) if raw else default
    except Exception:
        return default


def _row_to_market_operator(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "slug": row["slug"],
        "display_name": row["display_name"],
        "summary": row["summary"] or "",
        "status": row["status"] or "pending",
        "onboarding_status": row["onboarding_status"] or "draft",
        "identity_anchor": row["identity_anchor"] or "",
        "wallet": row["wallet"] or "",
        "ens_name": row["ens_name"] or "",
        "verification_status": row["verification_status"] or "unverified",
        "contact_email": row["contact_email"] or "",
        "website_url": row["website_url"] or "",
        "metadata": _json_loads(row["metadata_json"], {}),
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def market_operator_upsert(
    operator_id: str,
    slug: str,
    display_name: str,
    summary: str = "",
    status: str = "pending",
    onboarding_status: str = "draft",
    identity_anchor: str = "",
    wallet: str = "",
    ens_name: str = "",
    verification_status: str = "unverified",
    contact_email: str = "",
    website_url: str = "",
    metadata: dict[str, Any] | None = None,
) -> None:
    now = time.time()
    metadata = metadata or {}
    with _lock:
        c = _connect()
        try:
            c.execute(
                """
                INSERT INTO market_operators (
                    id, slug, display_name, summary, status, onboarding_status, identity_anchor,
                    wallet, ens_name, verification_status, contact_email, website_url,
                    metadata_json, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    slug = excluded.slug,
                    display_name = excluded.display_name,
                    summary = excluded.summary,
                    status = excluded.status,
                    onboarding_status = excluded.onboarding_status,
                    identity_anchor = excluded.identity_anchor,
                    wallet = excluded.wallet,
                    ens_name = excluded.ens_name,
                    verification_status = excluded.verification_status,
                    contact_email = excluded.contact_email,
                    website_url = excluded.website_url,
                    metadata_json = excluded.metadata_json,
                    updated_at = excluded.updated_at
                """,
                (
                    operator_id,
                    slug,
                    display_name,
                    summary,
                    status,
                    onboarding_status,
                    identity_anchor,
                    wallet,
                    ens_name,
                    verification_status,
                    contact_email,
                    website_url,
                    json.dumps(metadata),
                    now,
                    now,
                ),
            )
            c.commit()
        finally:
            c.close()


def market_operator_get(operator_id: str) -> dict[str, Any] | None:
    with _lock:
        c = _connect()
        try:
            row = c.execute("SELECT * FROM market_operators WHERE id = ?", (operator_id,)).fetchone()
            return _row_to_market_operator(row) if row else None
        finally:
            c.close()


def market_operator_get_by_slug(slug: str) -> dict[str, Any] | None:
    with _lock:
        c = _connect()
        try:
            row = c.execute("SELECT * FROM market_operators WHERE slug = ?", (slug,)).fetchone()
            return _row_to_market_operator(row) if row else None
        finally:
            c.close()


def market_operators_list(status: str | None = None) -> list[dict[str, Any]]:
    with _lock:
        c = _connect()
        try:
            if status:
                rows = c.execute("SELECT * FROM market_operators WHERE status = ? ORDER BY display_name, slug", (status,)).fetchall()
            else:
                rows = c.execute("SELECT * FROM market_operators ORDER BY display_name, slug").fetchall()
            return [_row_to_market_operator(row) for row in rows]
        finally:
            c.close()


def market_operator_summary(operator_id: str) -> dict[str, Any]:
    with _lock:
        c = _connect()
        try:
            agent_count = c.execute("SELECT COUNT(*) AS n FROM market_agent_profiles WHERE operator_id = ?", (operator_id,)).fetchone()["n"]
            accepted_submissions = c.execute(
                """
                SELECT COUNT(*) AS n
                FROM market_submissions s
                JOIN market_agent_profiles a ON a.id = s.agent_id
                WHERE a.operator_id = ? AND s.status = 'accepted'
                """,
                (operator_id,),
            ).fetchone()["n"]
            total_payout = c.execute(
                "SELECT COALESCE(SUM(amount), 0) AS total FROM market_payout_ledger WHERE operator_id = ? AND status IN ('approved','paid','settled')",
                (operator_id,),
            ).fetchone()["total"]
            return {
                "agent_count": int(agent_count or 0),
                "accepted_submissions": int(accepted_submissions or 0),
                "approved_payout_total": int(total_payout or 0),
            }
        finally:
            c.close()


def _row_to_market_repository_account(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "repo_full_name": row["repo_full_name"],
        "installation_id": row["installation_id"],
        "owner_account_id": row["owner_account_id"] or "",
        "enabled_job_classes": _json_loads(row["enabled_job_classes_json"], []),
        "blocked_paths": _json_loads(row["blocked_paths_json"], []),
        "required_checks": _json_loads(row["required_checks_json"], []),
        "review_policy": row["review_policy"] or "maintainer_review",
        "merge_policy": row["merge_policy"] or "manual_merge",
        "budget_priority": _json_loads(row["budget_priority_json"], ["platform_credits"]),
        "monthly_spend_cap": row["monthly_spend_cap"],
        "per_job_spend_cap": row["per_job_spend_cap"],
        "allowed_agent_pools": _json_loads(row["allowed_agent_pools_json"], []),
        "api_key_provider": row["api_key_provider"] or "",
        "has_api_key_pool": bool(row["has_api_key_pool"]),
        "local_path": row["local_path"] or "",
        "default_branch": row["default_branch"] or "main",
        "status": row["status"] or "active",
        "updated_at": row["updated_at"],
    }


def market_repository_account_upsert(
    account_id: str,
    repo_full_name: str,
    installation_id: int = 0,
    owner_account_id: str = "",
    enabled_job_classes: list[str] | None = None,
    blocked_paths: list[str] | None = None,
    required_checks: list[str] | None = None,
    review_policy: str = "maintainer_review",
    merge_policy: str = "manual_merge",
    budget_priority: list[str] | None = None,
    monthly_spend_cap: int = 0,
    per_job_spend_cap: int = 0,
    allowed_agent_pools: list[str] | None = None,
    api_key_provider: str = "",
    has_api_key_pool: bool = False,
    local_path: str = "",
    default_branch: str = "main",
    status: str = "active",
) -> None:
    now = time.time()
    enabled_job_classes = enabled_job_classes or ["ci_repair", "dependency_update", "security_update", "test_repair", "config_remediation", "type_repair", "codemod"]
    blocked_paths = blocked_paths or []
    required_checks = required_checks or []
    budget_priority = budget_priority or ["platform_credits"]
    allowed_agent_pools = allowed_agent_pools or []
    with _lock:
        c = _connect()
        try:
            c.execute(
                """
                INSERT INTO market_repository_accounts (
                    id, repo_full_name, installation_id, owner_account_id, enabled_job_classes_json,
                    blocked_paths_json, required_checks_json, review_policy, merge_policy,
                    budget_priority_json, monthly_spend_cap, per_job_spend_cap,
                    allowed_agent_pools_json, api_key_provider, has_api_key_pool, local_path,
                    default_branch, status, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(repo_full_name) DO UPDATE SET
                    id = excluded.id,
                    installation_id = excluded.installation_id,
                    owner_account_id = excluded.owner_account_id,
                    enabled_job_classes_json = excluded.enabled_job_classes_json,
                    blocked_paths_json = excluded.blocked_paths_json,
                    required_checks_json = excluded.required_checks_json,
                    review_policy = excluded.review_policy,
                    merge_policy = excluded.merge_policy,
                    budget_priority_json = excluded.budget_priority_json,
                    monthly_spend_cap = excluded.monthly_spend_cap,
                    per_job_spend_cap = excluded.per_job_spend_cap,
                    allowed_agent_pools_json = excluded.allowed_agent_pools_json,
                    api_key_provider = excluded.api_key_provider,
                    has_api_key_pool = excluded.has_api_key_pool,
                    local_path = excluded.local_path,
                    default_branch = excluded.default_branch,
                    status = excluded.status,
                    updated_at = excluded.updated_at
                """,
                (
                    account_id,
                    repo_full_name,
                    installation_id,
                    owner_account_id,
                    json.dumps(enabled_job_classes),
                    json.dumps(blocked_paths),
                    json.dumps(required_checks),
                    review_policy,
                    merge_policy,
                    json.dumps(budget_priority),
                    monthly_spend_cap,
                    per_job_spend_cap,
                    json.dumps(allowed_agent_pools),
                    api_key_provider,
                    1 if has_api_key_pool else 0,
                    local_path,
                    default_branch or "main",
                    status,
                    now,
                ),
            )
            c.commit()
        finally:
            c.close()


def market_repository_account_get_by_repo(repo_full_name: str) -> dict[str, Any] | None:
    with _lock:
        c = _connect()
        try:
            row = c.execute(
                "SELECT * FROM market_repository_accounts WHERE repo_full_name = ?",
                (repo_full_name,),
            ).fetchone()
            return _row_to_market_repository_account(row) if row else None
        finally:
            c.close()


def market_repository_accounts_list(installation_id: int | None = None) -> list[dict[str, Any]]:
    with _lock:
        c = _connect()
        try:
            if installation_id:
                rows = c.execute(
                    "SELECT * FROM market_repository_accounts WHERE installation_id = ? ORDER BY repo_full_name",
                    (installation_id,),
                ).fetchall()
            else:
                rows = c.execute(
                    "SELECT * FROM market_repository_accounts ORDER BY repo_full_name"
                ).fetchall()
            return [_row_to_market_repository_account(row) for row in rows]
        finally:
            c.close()


def _row_to_market_agent_profile(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "slug": row["slug"],
        "display_name": row["display_name"],
        "operator_id": row["operator_id"] or "",
        "summary": row["summary"] or "",
        "agent_kind": row["agent_kind"] or "generic",
        "pod": row["pod"] or "",
        "lane": row["lane"] or "",
        "supported_job_classes": _json_loads(row["supported_job_classes_json"], []),
        "supported_ecosystems": _json_loads(row["supported_ecosystems_json"], []),
        "supported_budget_types": _json_loads(row["supported_budget_types_json"], []),
        "model": row["model"] or "",
        "execution_backend": row["execution_backend"] or "",
        "specialist_id": row["specialist_id"] or "",
        "trust_tier": row["trust_tier"] or "standard",
        "pricing_profile": row["pricing_profile"] or "per_accepted_change",
        "acceptance_rate_30d": row["acceptance_rate_30d"],
        "median_time_to_pr_seconds": row["median_time_to_pr_seconds"],
        "revert_rate_90d": row["revert_rate_90d"],
        "badges": _json_loads(row["badges_json"], []),
        "status": row["status"] or "active",
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def market_agent_profile_upsert(
    agent_id: str,
    slug: str,
    display_name: str,
    operator_id: str = "",
    summary: str = "",
    agent_kind: str = "generic",
    pod: str = "",
    lane: str = "",
    supported_job_classes: list[str] | None = None,
    supported_ecosystems: list[str] | None = None,
    supported_budget_types: list[str] | None = None,
    model: str = "",
    execution_backend: str = "",
    specialist_id: str = "",
    trust_tier: str = "standard",
    pricing_profile: str = "per_accepted_change",
    acceptance_rate_30d: float = 0.0,
    median_time_to_pr_seconds: int = 0,
    revert_rate_90d: float = 0.0,
    badges: list[str] | None = None,
    status: str = "active",
) -> None:
    now = time.time()
    supported_job_classes = supported_job_classes or []
    supported_ecosystems = supported_ecosystems or []
    supported_budget_types = supported_budget_types or []
    badges = badges or []
    with _lock:
        c = _connect()
        try:
            c.execute(
                """
                INSERT INTO market_agent_profiles (
                    id, slug, display_name, operator_id, summary, agent_kind, pod, lane,
                    supported_job_classes_json, supported_ecosystems_json, supported_budget_types_json,
                    model, execution_backend, specialist_id, trust_tier, pricing_profile,
                    acceptance_rate_30d, median_time_to_pr_seconds, revert_rate_90d,
                    badges_json, status, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    slug = excluded.slug,
                    display_name = excluded.display_name,
                    operator_id = excluded.operator_id,
                    summary = excluded.summary,
                    agent_kind = excluded.agent_kind,
                    pod = excluded.pod,
                    lane = excluded.lane,
                    supported_job_classes_json = excluded.supported_job_classes_json,
                    supported_ecosystems_json = excluded.supported_ecosystems_json,
                    supported_budget_types_json = excluded.supported_budget_types_json,
                    model = excluded.model,
                    execution_backend = excluded.execution_backend,
                    specialist_id = excluded.specialist_id,
                    trust_tier = excluded.trust_tier,
                    pricing_profile = excluded.pricing_profile,
                    acceptance_rate_30d = excluded.acceptance_rate_30d,
                    median_time_to_pr_seconds = excluded.median_time_to_pr_seconds,
                    revert_rate_90d = excluded.revert_rate_90d,
                    badges_json = excluded.badges_json,
                    status = excluded.status,
                    updated_at = excluded.updated_at
                """,
                (
                    agent_id,
                    slug,
                    display_name,
                    operator_id,
                    summary,
                    agent_kind or "generic",
                    pod,
                    lane,
                    json.dumps(supported_job_classes),
                    json.dumps(supported_ecosystems),
                    json.dumps(supported_budget_types),
                    model,
                    execution_backend,
                    specialist_id,
                    trust_tier,
                    pricing_profile,
                    acceptance_rate_30d,
                    median_time_to_pr_seconds,
                    revert_rate_90d,
                    json.dumps(badges),
                    status,
                    now,
                    now,
                ),
            )
            c.commit()
        finally:
            c.close()


def market_agent_profile_get(agent_id: str) -> dict[str, Any] | None:
    with _lock:
        c = _connect()
        try:
            row = c.execute("SELECT * FROM market_agent_profiles WHERE id = ?", (agent_id,)).fetchone()
            return _row_to_market_agent_profile(row) if row else None
        finally:
            c.close()


def market_agent_profiles_list(
    status: str | None = None,
    agent_kind: str | None = None,
) -> list[dict[str, Any]]:
    with _lock:
        c = _connect()
        try:
            query = "SELECT * FROM market_agent_profiles"
            params: list[Any] = []
            where: list[str] = []
            if status:
                where.append("status = ?")
                params.append(status)
            if agent_kind:
                where.append("agent_kind = ?")
                params.append(agent_kind)
            if where:
                query += " WHERE " + " AND ".join(where)
            query += " ORDER BY agent_kind DESC, slug"
            rows = c.execute(query, params).fetchall()
            return [_row_to_market_agent_profile(row) for row in rows]
        finally:
            c.close()


def _row_to_market_capability_manifest(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "agent_id": row["agent_id"],
        "operator_id": row["operator_id"] or "",
        "manifest_version": row["manifest_version"] or 1,
        "job_classes": _json_loads(row["job_classes_json"], []),
        "languages": _json_loads(row["languages_json"], []),
        "package_managers": _json_loads(row["package_managers_json"], []),
        "frameworks": _json_loads(row["frameworks_json"], []),
        "ci_providers": _json_loads(row["ci_providers_json"], []),
        "max_change_scope": row["max_change_scope"] or "medium",
        "allowed_file_classes": _json_loads(row["allowed_file_classes_json"], []),
        "requires_human_review": bool(row["requires_human_review"]),
        "can_open_prs": bool(row["can_open_prs"]),
        "preferred_budget_types": _json_loads(row["preferred_budget_types_json"], []),
        "signed_at": row["signed_at"] or "",
        "metadata": _json_loads(row["metadata_json"], {}),
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def market_capability_manifest_upsert(
    manifest_id: str,
    agent_id: str,
    operator_id: str = "",
    manifest_version: int = 1,
    job_classes: list[str] | None = None,
    languages: list[str] | None = None,
    package_managers: list[str] | None = None,
    frameworks: list[str] | None = None,
    ci_providers: list[str] | None = None,
    max_change_scope: str = "medium",
    allowed_file_classes: list[str] | None = None,
    requires_human_review: bool = True,
    can_open_prs: bool = False,
    preferred_budget_types: list[str] | None = None,
    signed_at: str = "",
    metadata: dict[str, Any] | None = None,
) -> None:
    now = time.time()
    with _lock:
        c = _connect()
        try:
            c.execute(
                """
                INSERT INTO market_capability_manifests (
                    id, agent_id, operator_id, manifest_version, job_classes_json, languages_json,
                    package_managers_json, frameworks_json, ci_providers_json, max_change_scope,
                    allowed_file_classes_json, requires_human_review, can_open_prs,
                    preferred_budget_types_json, signed_at, metadata_json, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(agent_id) DO UPDATE SET
                    operator_id = excluded.operator_id,
                    manifest_version = excluded.manifest_version,
                    job_classes_json = excluded.job_classes_json,
                    languages_json = excluded.languages_json,
                    package_managers_json = excluded.package_managers_json,
                    frameworks_json = excluded.frameworks_json,
                    ci_providers_json = excluded.ci_providers_json,
                    max_change_scope = excluded.max_change_scope,
                    allowed_file_classes_json = excluded.allowed_file_classes_json,
                    requires_human_review = excluded.requires_human_review,
                    can_open_prs = excluded.can_open_prs,
                    preferred_budget_types_json = excluded.preferred_budget_types_json,
                    signed_at = excluded.signed_at,
                    metadata_json = excluded.metadata_json,
                    updated_at = excluded.updated_at
                """,
                (
                    manifest_id,
                    agent_id,
                    operator_id,
                    manifest_version,
                    json.dumps(job_classes or []),
                    json.dumps(languages or []),
                    json.dumps(package_managers or []),
                    json.dumps(frameworks or []),
                    json.dumps(ci_providers or []),
                    max_change_scope,
                    json.dumps(allowed_file_classes or []),
                    1 if requires_human_review else 0,
                    1 if can_open_prs else 0,
                    json.dumps(preferred_budget_types or []),
                    signed_at,
                    json.dumps(metadata or {}),
                    now,
                    now,
                ),
            )
            c.commit()
        finally:
            c.close()


def market_capability_manifest_get_by_agent(agent_id: str) -> dict[str, Any] | None:
    with _lock:
        c = _connect()
        try:
            row = c.execute("SELECT * FROM market_capability_manifests WHERE agent_id = ?", (agent_id,)).fetchone()
            return _row_to_market_capability_manifest(row) if row else None
        finally:
            c.close()


def _row_to_market_specialist(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "slug": row["slug"],
        "display_name": row["display_name"],
        "pod": row["pod"] or "",
        "lane": row["lane"] or "",
        "summary": row["summary"] or "",
        "supported_job_classes": _json_loads(row["supported_job_classes_json"], []),
        "supported_ecosystems": _json_loads(row["supported_ecosystems_json"], []),
        "supported_budget_types": _json_loads(row["supported_budget_types_json"], []),
        "trust_tier": row["trust_tier"] or "standard",
        "review_requirement": row["review_requirement"] or "maintainer_review",
        "status": row["status"] or "active",
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def market_specialist_upsert(
    specialist_id: str,
    slug: str,
    display_name: str,
    pod: str = "",
    lane: str = "",
    summary: str = "",
    supported_job_classes: list[str] | None = None,
    supported_ecosystems: list[str] | None = None,
    supported_budget_types: list[str] | None = None,
    trust_tier: str = "standard",
    review_requirement: str = "maintainer_review",
    status: str = "active",
) -> None:
    now = time.time()
    supported_job_classes = supported_job_classes or []
    supported_ecosystems = supported_ecosystems or []
    supported_budget_types = supported_budget_types or []
    with _lock:
        c = _connect()
        try:
            c.execute(
                """
                INSERT INTO market_specialists (
                    id, slug, display_name, pod, lane, summary,
                    supported_job_classes_json, supported_ecosystems_json,
                    supported_budget_types_json, trust_tier, review_requirement,
                    status, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    slug = excluded.slug,
                    display_name = excluded.display_name,
                    pod = excluded.pod,
                    lane = excluded.lane,
                    summary = excluded.summary,
                    supported_job_classes_json = excluded.supported_job_classes_json,
                    supported_ecosystems_json = excluded.supported_ecosystems_json,
                    supported_budget_types_json = excluded.supported_budget_types_json,
                    trust_tier = excluded.trust_tier,
                    review_requirement = excluded.review_requirement,
                    status = excluded.status,
                    updated_at = excluded.updated_at
                """,
                (
                    specialist_id,
                    slug,
                    display_name,
                    pod,
                    lane,
                    summary,
                    json.dumps(supported_job_classes),
                    json.dumps(supported_ecosystems),
                    json.dumps(supported_budget_types),
                    trust_tier,
                    review_requirement,
                    status,
                    now,
                    now,
                ),
            )
            c.commit()
        finally:
            c.close()


def market_specialists_list(status: str | None = None) -> list[dict[str, Any]]:
    with _lock:
        c = _connect()
        try:
            if status:
                rows = c.execute(
                    "SELECT * FROM market_specialists WHERE status = ? ORDER BY pod, lane, slug",
                    (status,),
                ).fetchall()
            else:
                rows = c.execute(
                    "SELECT * FROM market_specialists ORDER BY pod, lane, slug"
                ).fetchall()
            return [_row_to_market_specialist(row) for row in rows]
        finally:
            c.close()


def _row_to_market_job(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "repository_account_id": row["repository_account_id"],
        "repo_full_name": row["repo_full_name"],
        "job_class": row["job_class"],
        "trigger_source": row["trigger_source"] or "",
        "title": row["title"] or "",
        "summary": row["summary"] or "",
        "risk_level": row["risk_level"] or "medium",
        "acceptance_policy": row["acceptance_policy"] or "maintainer_accept_or_merge",
        "budget_ceiling": row["budget_ceiling"],
        "status": row["status"] or "open",
        "candidate_agents": _json_loads(row["candidate_agents_json"], []),
        "source_event_key": row["source_event_key"] or "",
        "metadata": _json_loads(row["metadata_json"], {}),
        "created_at": row["created_at"],
        "expires_at": row["expires_at"],
        "updated_at": row["updated_at"],
    }


def market_job_upsert(
    job_id: str,
    repository_account_id: str,
    repo_full_name: str,
    job_class: str,
    trigger_source: str,
    title: str,
    summary: str,
    risk_level: str = "medium",
    acceptance_policy: str = "maintainer_accept_or_merge",
    budget_ceiling: int = 0,
    status: str = "open",
    candidate_agents: list[str] | None = None,
    source_event_key: str = "",
    metadata: dict[str, Any] | None = None,
    expires_at: float = 0,
) -> None:
    now = time.time()
    candidate_agents = candidate_agents or []
    metadata = metadata or {}
    with _lock:
        c = _connect()
        try:
            c.execute(
                """
                INSERT INTO market_jobs (
                    id, repository_account_id, repo_full_name, job_class, trigger_source,
                    title, summary, risk_level, acceptance_policy, budget_ceiling, status,
                    candidate_agents_json, source_event_key, metadata_json, created_at,
                    expires_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    repository_account_id = excluded.repository_account_id,
                    repo_full_name = excluded.repo_full_name,
                    job_class = excluded.job_class,
                    trigger_source = excluded.trigger_source,
                    title = excluded.title,
                    summary = excluded.summary,
                    risk_level = excluded.risk_level,
                    acceptance_policy = excluded.acceptance_policy,
                    budget_ceiling = excluded.budget_ceiling,
                    status = excluded.status,
                    candidate_agents_json = excluded.candidate_agents_json,
                    source_event_key = excluded.source_event_key,
                    metadata_json = excluded.metadata_json,
                    expires_at = excluded.expires_at,
                    updated_at = excluded.updated_at
                """,
                (
                    job_id,
                    repository_account_id,
                    repo_full_name,
                    job_class,
                    trigger_source,
                    title,
                    summary,
                    risk_level,
                    acceptance_policy,
                    budget_ceiling,
                    status,
                    json.dumps(candidate_agents),
                    source_event_key,
                    json.dumps(metadata),
                    now,
                    expires_at,
                    now,
                ),
            )
            c.commit()
        finally:
            c.close()


def market_job_get(job_id: str) -> dict[str, Any] | None:
    with _lock:
        c = _connect()
        try:
            row = c.execute("SELECT * FROM market_jobs WHERE id = ?", (job_id,)).fetchone()
            return _row_to_market_job(row) if row else None
        finally:
            c.close()


def market_job_get_by_source_event_key(source_event_key: str) -> dict[str, Any] | None:
    if not source_event_key:
        return None
    with _lock:
        c = _connect()
        try:
            row = c.execute(
                "SELECT * FROM market_jobs WHERE source_event_key = ?",
                (source_event_key,),
            ).fetchone()
            return _row_to_market_job(row) if row else None
        finally:
            c.close()


def market_jobs_list(
    repo_full_name: str | None = None,
    status: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[dict[str, Any]]:
    with _lock:
        c = _connect()
        try:
            query = "SELECT * FROM market_jobs"
            params: list[Any] = []
            where: list[str] = []
            if repo_full_name:
                where.append("repo_full_name = ?")
                params.append(repo_full_name)
            if status:
                where.append("status = ?")
                params.append(status)
            if where:
                query += " WHERE " + " AND ".join(where)
            query += " ORDER BY created_at DESC LIMIT ? OFFSET ?"
            params.append(limit)
            params.append(max(0, int(offset or 0)))
            rows = c.execute(query, params).fetchall()
            return [_row_to_market_job(row) for row in rows]
        finally:
            c.close()


def _row_to_market_submission(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "job_id": row["job_id"],
        "agent_id": row["agent_id"],
        "branch_name": row["branch_name"] or "",
        "pr_number": row["pr_number"],
        "pr_url": row["pr_url"] or "",
        "diff_summary": row["diff_summary"] or "",
        "evidence": _json_loads(row["evidence_json"], {}),
        "status": row["status"] or "submitted",
        "acceptance_attribution": row["acceptance_attribution"] or "",
        "submitted_at": row["submitted_at"],
        "updated_at": row["updated_at"],
    }


def _row_to_market_submission_review(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "submission_id": row["submission_id"],
        "job_id": row["job_id"],
        "agent_id": row["agent_id"],
        "reviewer_id": row["reviewer_id"] or "",
        "reviewer_role": row["reviewer_role"] or "maintainer",
        "action": row["action"],
        "summary": row["summary"] or "",
        "notes": row["notes"] or "",
        "payload": _json_loads(row["payload_json"], {}),
        "created_at": row["created_at"],
    }


def market_submission_create(
    submission_id: str,
    job_id: str,
    agent_id: str,
    branch_name: str = "",
    pr_number: int = 0,
    pr_url: str = "",
    diff_summary: str = "",
    evidence: dict[str, Any] | None = None,
    status: str = "submitted",
    acceptance_attribution: str = "",
) -> None:
    now = time.time()
    evidence = evidence or {}
    with _lock:
        c = _connect()
        try:
            c.execute(
                """
                INSERT INTO market_submissions (
                    id, job_id, agent_id, branch_name, pr_number, pr_url,
                    diff_summary, evidence_json, status, acceptance_attribution,
                    submitted_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    submission_id,
                    job_id,
                    agent_id,
                    branch_name,
                    pr_number,
                    pr_url,
                    diff_summary,
                    json.dumps(evidence),
                    status,
                    acceptance_attribution,
                    now,
                    now,
                ),
            )
            c.commit()
        finally:
            c.close()


def market_submission_review_create(
    review_id: str,
    submission_id: str,
    job_id: str,
    agent_id: str,
    *,
    reviewer_id: str = "",
    reviewer_role: str = "maintainer",
    action: str,
    summary: str = "",
    notes: str = "",
    payload: dict[str, Any] | None = None,
) -> None:
    now = time.time()
    payload = payload or {}
    with _lock:
        c = _connect()
        try:
            c.execute(
                """
                INSERT INTO market_submission_reviews (
                    id, submission_id, job_id, agent_id, reviewer_id, reviewer_role,
                    action, summary, notes, payload_json, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    review_id,
                    submission_id,
                    job_id,
                    agent_id,
                    reviewer_id,
                    reviewer_role,
                    action,
                    summary,
                    notes,
                    json.dumps(payload),
                    now,
                ),
            )
            c.commit()
        finally:
            c.close()


def market_submissions_list(job_id: str) -> list[dict[str, Any]]:
    with _lock:
        c = _connect()
        try:
            rows = c.execute(
                "SELECT * FROM market_submissions WHERE job_id = ? ORDER BY submitted_at DESC",
                (job_id,),
            ).fetchall()
            return [_row_to_market_submission(row) for row in rows]
        finally:
            c.close()


def market_submission_reviews_list(submission_id: str) -> list[dict[str, Any]]:
    with _lock:
        c = _connect()
        try:
            rows = c.execute(
                "SELECT * FROM market_submission_reviews WHERE submission_id = ? ORDER BY created_at ASC",
                (submission_id,),
            ).fetchall()
            return [_row_to_market_submission_review(row) for row in rows]
        finally:
            c.close()


def market_submission_reviews_list_by_job(job_id: str) -> list[dict[str, Any]]:
    with _lock:
        c = _connect()
        try:
            rows = c.execute(
                "SELECT * FROM market_submission_reviews WHERE job_id = ? ORDER BY created_at ASC",
                (job_id,),
            ).fetchall()
            return [_row_to_market_submission_review(row) for row in rows]
        finally:
            c.close()


def market_submission_get(submission_id: str) -> dict[str, Any] | None:
    with _lock:
        c = _connect()
        try:
            row = c.execute("SELECT * FROM market_submissions WHERE id = ?", (submission_id,)).fetchone()
            return _row_to_market_submission(row) if row else None
        finally:
            c.close()


def market_submission_update(
    submission_id: str,
    *,
    status: str | None = None,
    acceptance_attribution: str | None = None,
    evidence: dict[str, Any] | None = None,
    branch_name: str | None = None,
    pr_number: int | None = None,
    pr_url: str | None = None,
    diff_summary: str | None = None,
) -> None:
    now = time.time()
    with _lock:
        c = _connect()
        try:
            current = c.execute("SELECT * FROM market_submissions WHERE id = ?", (submission_id,)).fetchone()
            if not current:
                return
            next_status = status if status is not None else (current["status"] or "submitted")
            next_acceptance_attribution = (
                acceptance_attribution
                if acceptance_attribution is not None
                else (current["acceptance_attribution"] or "")
            )
            next_evidence = evidence if evidence is not None else _json_loads(current["evidence_json"], {})
            next_branch_name = branch_name if branch_name is not None else (current["branch_name"] or "")
            next_pr_number = pr_number if pr_number is not None else int(current["pr_number"] or 0)
            next_pr_url = pr_url if pr_url is not None else (current["pr_url"] or "")
            next_diff_summary = diff_summary if diff_summary is not None else (current["diff_summary"] or "")
            c.execute(
                """
                UPDATE market_submissions
                SET branch_name = ?, pr_number = ?, pr_url = ?, diff_summary = ?,
                    status = ?, acceptance_attribution = ?, evidence_json = ?, updated_at = ?
                WHERE id = ?
                """,
                (
                    next_branch_name,
                    next_pr_number,
                    next_pr_url,
                    next_diff_summary,
                    next_status,
                    next_acceptance_attribution,
                    json.dumps(next_evidence),
                    now,
                    submission_id,
                ),
            )
            c.commit()
        finally:
            c.close()


def _row_to_market_job_plan(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "job_id": row["job_id"],
        "agent_id": row["agent_id"] or "",
        "operator_id": row["operator_id"] or "",
        "summary": row["summary"] or "",
        "steps": _json_loads(row["steps_json"], []),
        "estimated_cost": row["estimated_cost"],
        "estimated_seconds": row["estimated_seconds"],
        "status": row["status"] or "proposed",
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def market_job_plan_create(
    plan_id: str,
    job_id: str,
    agent_id: str = "",
    operator_id: str = "",
    summary: str = "",
    steps: list[str] | None = None,
    estimated_cost: int = 0,
    estimated_seconds: int = 0,
    status: str = "proposed",
) -> None:
    now = time.time()
    steps = steps or []
    with _lock:
        c = _connect()
        try:
            c.execute(
                """
                INSERT INTO market_job_plans (
                    id, job_id, agent_id, operator_id, summary, steps_json,
                    estimated_cost, estimated_seconds, status, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    plan_id,
                    job_id,
                    agent_id,
                    operator_id,
                    summary,
                    json.dumps(steps),
                    estimated_cost,
                    estimated_seconds,
                    status,
                    now,
                    now,
                ),
            )
            c.commit()
        finally:
            c.close()


def market_job_plans_list(job_id: str) -> list[dict[str, Any]]:
    with _lock:
        c = _connect()
        try:
            rows = c.execute(
                "SELECT * FROM market_job_plans WHERE job_id = ? ORDER BY created_at DESC",
                (job_id,),
            ).fetchall()
            return [_row_to_market_job_plan(row) for row in rows]
        finally:
            c.close()


def market_job_plan_get(plan_id: str) -> dict[str, Any] | None:
    with _lock:
        c = _connect()
        try:
            row = c.execute("SELECT * FROM market_job_plans WHERE id = ?", (plan_id,)).fetchone()
            return _row_to_market_job_plan(row) if row else None
        finally:
            c.close()


def _row_to_market_job_assignment(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "job_id": row["job_id"],
        "agent_id": row["agent_id"],
        "specialist_id": row["specialist_id"] or "",
        "recommendation_id": row["recommendation_id"] or "",
        "plan_id": row["plan_id"] or "",
        "assigned_by": row["assigned_by"] or "",
        "mode": row["mode"] or "exclusive",
        "status": row["status"] or "active",
        "lease_expires_at": row["lease_expires_at"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def market_job_assignment_create(
    assignment_id: str,
    job_id: str,
    agent_id: str,
    specialist_id: str = "",
    recommendation_id: str = "",
    plan_id: str = "",
    assigned_by: str = "",
    mode: str = "exclusive",
    status: str = "active",
    lease_expires_at: float = 0,
) -> None:
    now = time.time()
    plan_fk = plan_id or None
    with _lock:
        c = _connect()
        try:
            c.execute(
                """
                INSERT INTO market_job_assignments (
                    id, job_id, agent_id, specialist_id, recommendation_id, plan_id, assigned_by, mode, status,
                    lease_expires_at, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    assignment_id,
                    job_id,
                    agent_id,
                    specialist_id,
                    recommendation_id,
                    plan_fk,
                    assigned_by,
                    mode,
                    status,
                    lease_expires_at,
                    now,
                    now,
                ),
            )
            c.commit()
        finally:
            c.close()


def market_job_assignments_list(job_id: str) -> list[dict[str, Any]]:
    with _lock:
        c = _connect()
        try:
            rows = c.execute(
                "SELECT * FROM market_job_assignments WHERE job_id = ? ORDER BY created_at DESC",
                (job_id,),
            ).fetchall()
            return [_row_to_market_job_assignment(row) for row in rows]
        finally:
            c.close()


def market_job_assignment_update_status(assignment_id: str, status: str) -> None:
    now = time.time()
    with _lock:
        c = _connect()
        try:
            c.execute(
                "UPDATE market_job_assignments SET status = ?, updated_at = ? WHERE id = ?",
                (status, now, assignment_id),
            )
            c.commit()
        finally:
            c.close()


def market_job_recommendations_replace(job_id: str, recommendations: list[dict[str, Any]]) -> None:
    now = time.time()
    with _lock:
        c = _connect()
        try:
            c.execute("DELETE FROM market_job_recommendations WHERE job_id = ?", (job_id,))
            for rec in recommendations:
                rec_id = rec.get("recommendation_id") or ""
                if not rec_id:
                    continue
                c.execute(
                    """
                    INSERT INTO market_job_recommendations (
                        id, job_id, specialist_id, score, recommended, policy_pass,
                        budget_compatible, reasons_json, policy_warnings_json,
                        payload_json, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        rec_id,
                        job_id,
                        rec.get("specialist_id", ""),
                        int(rec.get("score") or 0),
                        1 if rec.get("recommended") else 0,
                        1 if rec.get("policy_pass") else 0,
                        1 if rec.get("budget_compatible") else 0,
                        json.dumps(rec.get("reasons") or []),
                        json.dumps(rec.get("policy_warnings") or []),
                        json.dumps(rec),
                        now,
                    ),
                )
            c.commit()
        finally:
            c.close()


def market_job_recommendation_get(recommendation_id: str) -> dict[str, Any] | None:
    with _lock:
        c = _connect()
        try:
            row = c.execute(
                "SELECT * FROM market_job_recommendations WHERE id = ?",
                (recommendation_id,),
            ).fetchone()
            if not row:
                return None
            payload = _json_loads(row["payload_json"], {})
            payload["recommendation_id"] = row["id"]
            payload["job_id"] = row["job_id"]
            payload["specialist_id"] = row["specialist_id"]
            return payload
        finally:
            c.close()


def market_job_recommendations_list(job_id: str) -> list[dict[str, Any]]:
    with _lock:
        c = _connect()
        try:
            rows = c.execute(
                "SELECT * FROM market_job_recommendations WHERE job_id = ? ORDER BY score DESC, created_at DESC",
                (job_id,),
            ).fetchall()
            out: list[dict[str, Any]] = []
            for row in rows:
                payload = _json_loads(row["payload_json"], {})
                payload["recommendation_id"] = row["id"]
                payload["job_id"] = row["job_id"]
                payload["specialist_id"] = row["specialist_id"]
                out.append(payload)
            return out
        finally:
            c.close()


def _row_to_market_offer(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "job_id": row["job_id"],
        "agent_id": row["agent_id"],
        "operator_id": row["operator_id"] or "",
        "amount": row["amount"] or 0,
        "currency": row["currency"] or "credits",
        "eta_seconds": row["eta_seconds"] or 0,
        "sla_summary": row["sla_summary"] or "",
        "notes": row["notes"] or "",
        "status": row["status"] or "open",
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def market_offer_create(
    offer_id: str,
    job_id: str,
    agent_id: str,
    operator_id: str = "",
    amount: int = 0,
    currency: str = "credits",
    eta_seconds: int = 0,
    sla_summary: str = "",
    notes: str = "",
    status: str = "open",
) -> None:
    now = time.time()
    with _lock:
        c = _connect()
        try:
            c.execute(
                """
                INSERT INTO market_offers (
                    id, job_id, agent_id, operator_id, amount, currency, eta_seconds,
                    sla_summary, notes, status, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    offer_id,
                    job_id,
                    agent_id,
                    operator_id,
                    amount,
                    currency,
                    eta_seconds,
                    sla_summary,
                    notes,
                    status,
                    now,
                    now,
                ),
            )
            c.commit()
        finally:
            c.close()


def market_offer_get(offer_id: str) -> dict[str, Any] | None:
    with _lock:
        c = _connect()
        try:
            row = c.execute("SELECT * FROM market_offers WHERE id = ?", (offer_id,)).fetchone()
            return _row_to_market_offer(row) if row else None
        finally:
            c.close()


def market_offers_list(job_id: str) -> list[dict[str, Any]]:
    with _lock:
        c = _connect()
        try:
            rows = c.execute(
                "SELECT * FROM market_offers WHERE job_id = ? ORDER BY created_at DESC",
                (job_id,),
            ).fetchall()
            return [_row_to_market_offer(row) for row in rows]
        finally:
            c.close()


def market_offer_update_status(offer_id: str, status: str) -> None:
    now = time.time()
    with _lock:
        c = _connect()
        try:
            c.execute(
                "UPDATE market_offers SET status = ?, updated_at = ? WHERE id = ?",
                (status, now, offer_id),
            )
            c.commit()
        finally:
            c.close()


def _row_to_market_award(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "job_id": row["job_id"],
        "offer_id": row["offer_id"],
        "awarded_agent_id": row["awarded_agent_id"],
        "awarded_by": row["awarded_by"] or "",
        "decision_notes": row["decision_notes"] or "",
        "status": row["status"] or "awarded",
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def market_award_upsert(
    award_id: str,
    job_id: str,
    offer_id: str,
    awarded_agent_id: str,
    awarded_by: str = "",
    decision_notes: str = "",
    status: str = "awarded",
) -> None:
    now = time.time()
    with _lock:
        c = _connect()
        try:
            c.execute(
                """
                INSERT INTO market_awards (
                    id, job_id, offer_id, awarded_agent_id, awarded_by, decision_notes, status, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(job_id) DO UPDATE SET
                    offer_id = excluded.offer_id,
                    awarded_agent_id = excluded.awarded_agent_id,
                    awarded_by = excluded.awarded_by,
                    decision_notes = excluded.decision_notes,
                    status = excluded.status,
                    updated_at = excluded.updated_at
                """,
                (
                    award_id,
                    job_id,
                    offer_id,
                    awarded_agent_id,
                    awarded_by,
                    decision_notes,
                    status,
                    now,
                    now,
                ),
            )
            c.commit()
        finally:
            c.close()


def market_award_get_by_job(job_id: str) -> dict[str, Any] | None:
    with _lock:
        c = _connect()
        try:
            row = c.execute("SELECT * FROM market_awards WHERE job_id = ?", (job_id,)).fetchone()
            return _row_to_market_award(row) if row else None
        finally:
            c.close()


def _row_to_market_settlement(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "job_id": row["job_id"],
        "submission_id": row["submission_id"] or "",
        "award_id": row["award_id"] or "",
        "agent_id": row["agent_id"] or "",
        "operator_id": row["operator_id"] or "",
        "amount": row["amount"] or 0,
        "currency": row["currency"] or "credits",
        "funding_source": row["funding_source"] or "",
        "status": row["status"] or "reserved",
        "frozen": bool(row["frozen"]),
        "resolution_notes": row["resolution_notes"] or "",
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def market_settlement_create(
    settlement_id: str,
    job_id: str,
    submission_id: str = "",
    award_id: str = "",
    agent_id: str = "",
    operator_id: str = "",
    amount: int = 0,
    currency: str = "credits",
    funding_source: str = "",
    status: str = "reserved",
    frozen: bool = False,
    resolution_notes: str = "",
) -> None:
    now = time.time()
    with _lock:
        c = _connect()
        try:
            c.execute(
                """
                INSERT INTO market_settlements (
                    id, job_id, submission_id, award_id, agent_id, operator_id, amount, currency,
                    funding_source, status, frozen, resolution_notes, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    settlement_id,
                    job_id,
                    submission_id,
                    award_id,
                    agent_id,
                    operator_id,
                    amount,
                    currency,
                    funding_source,
                    status,
                    1 if frozen else 0,
                    resolution_notes,
                    now,
                    now,
                ),
            )
            c.commit()
        finally:
            c.close()


def market_settlement_get(settlement_id: str) -> dict[str, Any] | None:
    with _lock:
        c = _connect()
        try:
            row = c.execute("SELECT * FROM market_settlements WHERE id = ?", (settlement_id,)).fetchone()
            return _row_to_market_settlement(row) if row else None
        finally:
            c.close()


def market_settlement_get_by_submission(submission_id: str) -> dict[str, Any] | None:
    if not submission_id:
        return None
    with _lock:
        c = _connect()
        try:
            row = c.execute(
                "SELECT * FROM market_settlements WHERE submission_id = ? ORDER BY created_at DESC LIMIT 1",
                (submission_id,),
            ).fetchone()
            return _row_to_market_settlement(row) if row else None
        finally:
            c.close()


def market_settlements_list(job_id: str | None = None) -> list[dict[str, Any]]:
    with _lock:
        c = _connect()
        try:
            if job_id:
                rows = c.execute(
                    "SELECT * FROM market_settlements WHERE job_id = ? ORDER BY created_at DESC",
                    (job_id,),
                ).fetchall()
            else:
                rows = c.execute(
                    "SELECT * FROM market_settlements ORDER BY created_at DESC"
                ).fetchall()
            return [_row_to_market_settlement(row) for row in rows]
        finally:
            c.close()


def market_settlement_update(
    settlement_id: str,
    *,
    status: str | None = None,
    frozen: bool | None = None,
    resolution_notes: str | None = None,
) -> None:
    now = time.time()
    with _lock:
        c = _connect()
        try:
            current = c.execute(
                "SELECT * FROM market_settlements WHERE id = ?",
                (settlement_id,),
            ).fetchone()
            if not current:
                return
            c.execute(
                """
                UPDATE market_settlements
                SET status = ?, frozen = ?, resolution_notes = ?, updated_at = ?
                WHERE id = ?
                """,
                (
                    status if status is not None else (current["status"] or "reserved"),
                    (1 if frozen else 0) if frozen is not None else int(current["frozen"] or 0),
                    resolution_notes if resolution_notes is not None else (current["resolution_notes"] or ""),
                    now,
                    settlement_id,
                ),
            )
            c.commit()
        finally:
            c.close()


def _row_to_market_dispute(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "job_id": row["job_id"],
        "settlement_id": row["settlement_id"] or "",
        "submission_id": row["submission_id"] or "",
        "opened_by": row["opened_by"] or "",
        "reason_code": row["reason_code"] or "",
        "reason": row["reason"] or "",
        "status": row["status"] or "open",
        "ruling": row["ruling"] or "",
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
        "resolved_at": row["resolved_at"] or 0,
    }


def market_dispute_create(
    dispute_id: str,
    job_id: str,
    settlement_id: str = "",
    submission_id: str = "",
    opened_by: str = "",
    reason_code: str = "",
    reason: str = "",
    status: str = "open",
) -> None:
    now = time.time()
    with _lock:
        c = _connect()
        try:
            c.execute(
                """
                INSERT INTO market_disputes (
                    id, job_id, settlement_id, submission_id, opened_by, reason_code, reason,
                    status, ruling, created_at, updated_at, resolved_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, '', ?, ?, 0)
                """,
                (
                    dispute_id,
                    job_id,
                    settlement_id,
                    submission_id,
                    opened_by,
                    reason_code,
                    reason,
                    status,
                    now,
                    now,
                ),
            )
            c.commit()
        finally:
            c.close()


def market_dispute_get(dispute_id: str) -> dict[str, Any] | None:
    with _lock:
        c = _connect()
        try:
            row = c.execute("SELECT * FROM market_disputes WHERE id = ?", (dispute_id,)).fetchone()
            return _row_to_market_dispute(row) if row else None
        finally:
            c.close()


def market_disputes_list(job_id: str) -> list[dict[str, Any]]:
    with _lock:
        c = _connect()
        try:
            rows = c.execute(
                "SELECT * FROM market_disputes WHERE job_id = ? ORDER BY created_at DESC",
                (job_id,),
            ).fetchall()
            return [_row_to_market_dispute(row) for row in rows]
        finally:
            c.close()


def market_dispute_update(
    dispute_id: str,
    *,
    status: str | None = None,
    ruling: str | None = None,
) -> None:
    now = time.time()
    with _lock:
        c = _connect()
        try:
            current = c.execute("SELECT * FROM market_disputes WHERE id = ?", (dispute_id,)).fetchone()
            if not current:
                return
            next_status = status if status is not None else (current["status"] or "open")
            resolved_at = now if next_status == "resolved" else (current["resolved_at"] or 0)
            c.execute(
                """
                UPDATE market_disputes
                SET status = ?, ruling = ?, updated_at = ?, resolved_at = ?
                WHERE id = ?
                """,
                (
                    next_status,
                    ruling if ruling is not None else (current["ruling"] or ""),
                    now,
                    resolved_at,
                    dispute_id,
                ),
            )
            c.commit()
        finally:
            c.close()


def market_dispute_event_create(
    event_id: str,
    dispute_id: str,
    actor_id: str,
    event_type: str,
    detail: dict[str, Any] | None = None,
) -> None:
    now = time.time()
    with _lock:
        c = _connect()
        try:
            c.execute(
                """
                INSERT INTO market_dispute_events (
                    id, dispute_id, actor_id, event_type, detail_json, created_at
                ) VALUES (?, ?, ?, ?, ?, ?)
                """,
                (event_id, dispute_id, actor_id, event_type, json.dumps(detail or {}), now),
            )
            c.commit()
        finally:
            c.close()


def market_dispute_events_list(dispute_id: str) -> list[dict[str, Any]]:
    with _lock:
        c = _connect()
        try:
            rows = c.execute(
                "SELECT * FROM market_dispute_events WHERE dispute_id = ? ORDER BY created_at ASC",
                (dispute_id,),
            ).fetchall()
            return [
                {
                    "id": row["id"],
                    "dispute_id": row["dispute_id"],
                    "actor_id": row["actor_id"] or "",
                    "event_type": row["event_type"],
                    "detail": _json_loads(row["detail_json"], {}),
                    "created_at": row["created_at"],
                }
                for row in rows
            ]
        finally:
            c.close()


def _row_to_market_reputation(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "entity_type": row["entity_type"],
        "entity_id": row["entity_id"],
        "wins": row["wins"] or 0,
        "rejects": row["rejects"] or 0,
        "disputes_total": row["disputes_total"] or 0,
        "disputes_won": row["disputes_won"] or 0,
        "refunds": row["refunds"] or 0,
        "total_jobs": row["total_jobs"] or 0,
        "score": row["score"] or 0.0,
        "last_event_at": row["last_event_at"] or 0,
        "updated_at": row["updated_at"] or 0,
    }


def market_reputation_record(
    entity_type: str,
    entity_id: str,
    *,
    wins_delta: int = 0,
    rejects_delta: int = 0,
    disputes_delta: int = 0,
    disputes_won_delta: int = 0,
    refunds_delta: int = 0,
    jobs_delta: int = 0,
) -> None:
    now = time.time()
    record_id = f"rep:{entity_type}:{entity_id}"
    with _lock:
        c = _connect()
        try:
            current = c.execute(
                "SELECT * FROM market_reputation_snapshots WHERE entity_type = ? AND entity_id = ?",
                (entity_type, entity_id),
            ).fetchone()
            wins = int((current["wins"] if current else 0) or 0) + int(wins_delta)
            rejects = int((current["rejects"] if current else 0) or 0) + int(rejects_delta)
            disputes_total = int((current["disputes_total"] if current else 0) or 0) + int(disputes_delta)
            disputes_won = int((current["disputes_won"] if current else 0) or 0) + int(disputes_won_delta)
            refunds = int((current["refunds"] if current else 0) or 0) + int(refunds_delta)
            total_jobs = int((current["total_jobs"] if current else 0) or 0) + int(jobs_delta)
            score = float((wins * 2) - rejects - refunds - max(0, disputes_total - disputes_won))
            c.execute(
                """
                INSERT INTO market_reputation_snapshots (
                    id, entity_type, entity_id, wins, rejects, disputes_total, disputes_won,
                    refunds, total_jobs, score, last_event_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(entity_type, entity_id) DO UPDATE SET
                    wins = excluded.wins,
                    rejects = excluded.rejects,
                    disputes_total = excluded.disputes_total,
                    disputes_won = excluded.disputes_won,
                    refunds = excluded.refunds,
                    total_jobs = excluded.total_jobs,
                    score = excluded.score,
                    last_event_at = excluded.last_event_at,
                    updated_at = excluded.updated_at
                """,
                (
                    record_id,
                    entity_type,
                    entity_id,
                    max(0, wins),
                    max(0, rejects),
                    max(0, disputes_total),
                    max(0, disputes_won),
                    max(0, refunds),
                    max(0, total_jobs),
                    score,
                    now,
                    now,
                ),
            )
            c.commit()
        finally:
            c.close()


def market_reputation_get(entity_type: str, entity_id: str) -> dict[str, Any] | None:
    with _lock:
        c = _connect()
        try:
            row = c.execute(
                "SELECT * FROM market_reputation_snapshots WHERE entity_type = ? AND entity_id = ?",
                (entity_type, entity_id),
            ).fetchone()
            return _row_to_market_reputation(row) if row else None
        finally:
            c.close()


def market_reputation_list(entity_type: str) -> list[dict[str, Any]]:
    with _lock:
        c = _connect()
        try:
            rows = c.execute(
                "SELECT * FROM market_reputation_snapshots WHERE entity_type = ? ORDER BY score DESC, updated_at DESC",
                (entity_type,),
            ).fetchall()
            return [_row_to_market_reputation(row) for row in rows]
        finally:
            c.close()


def market_admin_action_create(
    action_id: str,
    action_type: str,
    target_type: str,
    target_id: str,
    actor: str = "",
    notes: str = "",
    status: str = "applied",
    metadata: dict[str, Any] | None = None,
) -> None:
    now = time.time()
    with _lock:
        c = _connect()
        try:
            c.execute(
                """
                INSERT INTO market_admin_actions (
                    id, action_type, target_type, target_id, actor, notes, status, metadata_json, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    action_id,
                    action_type,
                    target_type,
                    target_id,
                    actor,
                    notes,
                    status,
                    json.dumps(metadata or {}),
                    now,
                ),
            )
            c.commit()
        finally:
            c.close()


def market_admin_actions_list(limit: int = 100) -> list[dict[str, Any]]:
    with _lock:
        c = _connect()
        try:
            rows = c.execute(
                "SELECT * FROM market_admin_actions ORDER BY created_at DESC LIMIT ?",
                (max(1, int(limit or 100)),),
            ).fetchall()
            return [
                {
                    "id": row["id"],
                    "action_type": row["action_type"],
                    "target_type": row["target_type"],
                    "target_id": row["target_id"],
                    "actor": row["actor"] or "",
                    "notes": row["notes"] or "",
                    "status": row["status"] or "applied",
                    "metadata": _json_loads(row["metadata_json"], {}),
                    "created_at": row["created_at"],
                }
                for row in rows
            ]
        finally:
            c.close()


def _row_to_market_payout_ledger(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "job_id": row["job_id"],
        "submission_id": row["submission_id"] or "",
        "agent_id": row["agent_id"] or "",
        "operator_id": row["operator_id"] or "",
        "amount": row["amount"],
        "currency": row["currency"] or "credits",
        "funding_source": row["funding_source"] or "",
        "status": row["status"] or "pending",
        "notes": row["notes"] or "",
        "created_at": row["created_at"],
    }


def market_payout_ledger_create(
    payout_id: str,
    job_id: str,
    submission_id: str = "",
    agent_id: str = "",
    operator_id: str = "",
    amount: int = 0,
    currency: str = "credits",
    funding_source: str = "",
    status: str = "pending",
    notes: str = "",
) -> None:
    now = time.time()
    with _lock:
        c = _connect()
        try:
            c.execute(
                """
                INSERT INTO market_payout_ledger (
                    id, job_id, submission_id, agent_id, operator_id, amount, currency,
                    funding_source, status, notes, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    payout_id,
                    job_id,
                    submission_id,
                    agent_id,
                    operator_id,
                    amount,
                    currency,
                    funding_source,
                    status,
                    notes,
                    now,
                ),
            )
            c.commit()
        finally:
            c.close()


def market_payout_ledger_list(job_id: str) -> list[dict[str, Any]]:
    with _lock:
        c = _connect()
        try:
            rows = c.execute(
                "SELECT * FROM market_payout_ledger WHERE job_id = ? ORDER BY created_at DESC",
                (job_id,),
            ).fetchall()
            return [_row_to_market_payout_ledger(row) for row in rows]
        finally:
            c.close()


def _row_to_market_execution_run(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "job_id": row["job_id"],
        "agent_id": row["agent_id"],
        "repository_account_id": row["repository_account_id"],
        "assignment_id": row["assignment_id"] or "",
        "mode": row["mode"] or "apply",
        "status": row["status"] or "queued",
        "summary": row["summary"] or "",
        "logs": _json_loads(row["logs_json"], []),
        "changed_files": _json_loads(row["changed_files_json"], []),
        "evidence": _json_loads(row["evidence_json"], {}),
        "submission_id": row["submission_id"] or "",
        "started_at": row["started_at"],
        "finished_at": row["finished_at"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def market_execution_run_create(
    run_id: str,
    job_id: str,
    agent_id: str,
    repository_account_id: str,
    assignment_id: str = "",
    mode: str = "apply",
    status: str = "queued",
    summary: str = "",
    logs: list[str] | None = None,
    changed_files: list[str] | None = None,
    evidence: dict[str, Any] | None = None,
    submission_id: str = "",
    started_at: float = 0,
    finished_at: float = 0,
) -> None:
    now = time.time()
    logs = logs or []
    changed_files = changed_files or []
    evidence = evidence or {}
    with _lock:
        c = _connect()
        try:
            c.execute(
                """
                INSERT INTO market_execution_runs (
                    id, job_id, agent_id, repository_account_id, assignment_id, mode, status,
                    summary, logs_json, changed_files_json, evidence_json, submission_id,
                    started_at, finished_at, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    run_id,
                    job_id,
                    agent_id,
                    repository_account_id,
                    assignment_id,
                    mode,
                    status,
                    summary,
                    json.dumps(logs),
                    json.dumps(changed_files),
                    json.dumps(evidence),
                    submission_id,
                    started_at,
                    finished_at,
                    now,
                    now,
                ),
            )
            c.commit()
        finally:
            c.close()


def market_execution_run_update(
    run_id: str,
    *,
    status: str | None = None,
    summary: str | None = None,
    logs: list[str] | None = None,
    changed_files: list[str] | None = None,
    evidence: dict[str, Any] | None = None,
    submission_id: str | None = None,
    started_at: float | None = None,
    finished_at: float | None = None,
) -> None:
    now = time.time()
    with _lock:
        c = _connect()
        try:
            current = c.execute("SELECT * FROM market_execution_runs WHERE id = ?", (run_id,)).fetchone()
            if not current:
                return
            c.execute(
                """
                UPDATE market_execution_runs
                SET status = ?, summary = ?, logs_json = ?, changed_files_json = ?, evidence_json = ?,
                    submission_id = ?, started_at = ?, finished_at = ?, updated_at = ?
                WHERE id = ?
                """,
                (
                    status if status is not None else (current["status"] or "queued"),
                    summary if summary is not None else (current["summary"] or ""),
                    json.dumps(logs if logs is not None else _json_loads(current["logs_json"], [])),
                    json.dumps(changed_files if changed_files is not None else _json_loads(current["changed_files_json"], [])),
                    json.dumps(evidence if evidence is not None else _json_loads(current["evidence_json"], {})),
                    submission_id if submission_id is not None else (current["submission_id"] or ""),
                    started_at if started_at is not None else current["started_at"],
                    finished_at if finished_at is not None else current["finished_at"],
                    now,
                    run_id,
                ),
            )
            c.commit()
        finally:
            c.close()


def market_execution_run_get(run_id: str) -> dict[str, Any] | None:
    with _lock:
        c = _connect()
        try:
            row = c.execute("SELECT * FROM market_execution_runs WHERE id = ?", (run_id,)).fetchone()
            return _row_to_market_execution_run(row) if row else None
        finally:
            c.close()


def market_execution_runs_list(job_id: str) -> list[dict[str, Any]]:
    with _lock:
        c = _connect()
        try:
            rows = c.execute(
                "SELECT * FROM market_execution_runs WHERE job_id = ? ORDER BY created_at DESC",
                (job_id,),
            ).fetchall()
            return [_row_to_market_execution_run(row) for row in rows]
        finally:
            c.close()


def _row_to_market_opportunity(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "repository_account_id": row["repository_account_id"],
        "repo_full_name": row["repo_full_name"],
        "opportunity_type": row["opportunity_type"],
        "title": row["title"] or "",
        "summary": row["summary"] or "",
        "pod": row["pod"] or "",
        "lane": row["lane"] or "",
        "severity": row["severity"] or "medium",
        "confidence": row["confidence"] or 0.0,
        "files": _json_loads(row["files_json"], []),
        "evidence": _json_loads(row["evidence_json"], {}),
        "source_agent_id": row["source_agent_id"] or "",
        "status": row["status"] or "open",
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def market_opportunity_upsert(
    opportunity_id: str,
    repository_account_id: str,
    repo_full_name: str,
    opportunity_type: str,
    title: str,
    summary: str,
    pod: str = "",
    lane: str = "",
    severity: str = "medium",
    confidence: float = 0.0,
    files: list[str] | None = None,
    evidence: dict[str, Any] | None = None,
    source_agent_id: str = "",
    status: str = "open",
) -> None:
    now = time.time()
    files = files or []
    evidence = evidence or {}
    with _lock:
        c = _connect()
        try:
            c.execute(
                """
                INSERT INTO market_opportunities (
                    id, repository_account_id, repo_full_name, opportunity_type, title, summary,
                    pod, lane, severity, confidence, files_json, evidence_json, source_agent_id,
                    status, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    repository_account_id = excluded.repository_account_id,
                    repo_full_name = excluded.repo_full_name,
                    opportunity_type = excluded.opportunity_type,
                    title = excluded.title,
                    summary = excluded.summary,
                    pod = excluded.pod,
                    lane = excluded.lane,
                    severity = excluded.severity,
                    confidence = excluded.confidence,
                    files_json = excluded.files_json,
                    evidence_json = excluded.evidence_json,
                    source_agent_id = excluded.source_agent_id,
                    status = excluded.status,
                    updated_at = excluded.updated_at
                """,
                (
                    opportunity_id,
                    repository_account_id,
                    repo_full_name,
                    opportunity_type,
                    title,
                    summary,
                    pod,
                    lane,
                    severity,
                    confidence,
                    json.dumps(files),
                    json.dumps(evidence),
                    source_agent_id,
                    status,
                    now,
                    now,
                ),
            )
            c.commit()
        finally:
            c.close()


def market_opportunities_list(
    repo_full_name: str | None = None,
    status: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[dict[str, Any]]:
    with _lock:
        c = _connect()
        try:
            query = "SELECT * FROM market_opportunities"
            params: list[Any] = []
            where: list[str] = []
            if repo_full_name:
                where.append("repo_full_name = ?")
                params.append(repo_full_name)
            if status:
                where.append("status = ?")
                params.append(status)
            if where:
                query += " WHERE " + " AND ".join(where)
            query += " ORDER BY created_at DESC LIMIT ? OFFSET ?"
            params.append(limit)
            params.append(max(0, int(offset or 0)))
            rows = c.execute(query, params).fetchall()
            return [_row_to_market_opportunity(row) for row in rows]
        finally:
            c.close()


def market_opportunity_get(opportunity_id: str) -> dict[str, Any] | None:
    with _lock:
        c = _connect()
        try:
            row = c.execute("SELECT * FROM market_opportunities WHERE id = ?", (opportunity_id,)).fetchone()
            return _row_to_market_opportunity(row) if row else None
        finally:
            c.close()


def _row_to_market_agent_invocation(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "job_id": row["job_id"] or "",
        "agent_id": row["agent_id"],
        "repository_account_id": row["repository_account_id"] or "",
        "model": row["model"] or "",
        "provider": row["provider"] or "",
        "status": row["status"] or "pending",
        "request": _json_loads(row["request_json"], {}),
        "response": _json_loads(row["response_json"], {}),
        "tool_calls": _json_loads(row["tool_calls_json"], []),
        "validations": _json_loads(row["validations_json"], []),
        "tokens_in": row["tokens_in"] or 0,
        "tokens_out": row["tokens_out"] or 0,
        "started_at": row["started_at"],
        "finished_at": row["finished_at"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def market_agent_invocation_create(
    invocation_id: str,
    agent_id: str,
    job_id: str = "",
    repository_account_id: str = "",
    model: str = "",
    provider: str = "",
    status: str = "pending",
    request: dict[str, Any] | None = None,
    response: dict[str, Any] | None = None,
    tool_calls: list[dict[str, Any]] | None = None,
    validations: list[dict[str, Any]] | None = None,
    tokens_in: int = 0,
    tokens_out: int = 0,
    started_at: float = 0,
    finished_at: float = 0,
) -> None:
    now = time.time()
    request = request or {}
    response = response or {}
    tool_calls = tool_calls or []
    validations = validations or []
    with _lock:
        c = _connect()
        try:
            c.execute(
                """
                INSERT INTO market_agent_invocations (
                    id, job_id, agent_id, repository_account_id, model, provider, status,
                    request_json, response_json, tool_calls_json, validations_json,
                    tokens_in, tokens_out, started_at, finished_at, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    invocation_id,
                    job_id,
                    agent_id,
                    repository_account_id,
                    model,
                    provider,
                    status,
                    json.dumps(request),
                    json.dumps(response),
                    json.dumps(tool_calls),
                    json.dumps(validations),
                    tokens_in,
                    tokens_out,
                    started_at,
                    finished_at,
                    now,
                    now,
                ),
            )
            c.commit()
        finally:
            c.close()


def market_agent_invocation_update(
    invocation_id: str,
    *,
    status: str | None = None,
    response: dict[str, Any] | None = None,
    tool_calls: list[dict[str, Any]] | None = None,
    validations: list[dict[str, Any]] | None = None,
    tokens_in: int | None = None,
    tokens_out: int | None = None,
    finished_at: float | None = None,
) -> None:
    now = time.time()
    with _lock:
        c = _connect()
        try:
            current = c.execute("SELECT * FROM market_agent_invocations WHERE id = ?", (invocation_id,)).fetchone()
            if not current:
                return
            c.execute(
                """
                UPDATE market_agent_invocations
                SET status = ?, response_json = ?, tool_calls_json = ?, validations_json = ?,
                    tokens_in = ?, tokens_out = ?, finished_at = ?, updated_at = ?
                WHERE id = ?
                """,
                (
                    status if status is not None else (current["status"] or "pending"),
                    json.dumps(response if response is not None else _json_loads(current["response_json"], {})),
                    json.dumps(tool_calls if tool_calls is not None else _json_loads(current["tool_calls_json"], [])),
                    json.dumps(validations if validations is not None else _json_loads(current["validations_json"], [])),
                    tokens_in if tokens_in is not None else (current["tokens_in"] or 0),
                    tokens_out if tokens_out is not None else (current["tokens_out"] or 0),
                    finished_at if finished_at is not None else current["finished_at"],
                    now,
                    invocation_id,
                ),
            )
            c.commit()
        finally:
            c.close()


def market_agent_invocation_get(invocation_id: str) -> dict[str, Any] | None:
    with _lock:
        c = _connect()
        try:
            row = c.execute("SELECT * FROM market_agent_invocations WHERE id = ?", (invocation_id,)).fetchone()
            return _row_to_market_agent_invocation(row) if row else None
        finally:
            c.close()


def market_agent_invocations_list(job_id: str) -> list[dict[str, Any]]:
    with _lock:
        c = _connect()
        try:
            rows = c.execute(
                "SELECT * FROM market_agent_invocations WHERE job_id = ? ORDER BY created_at DESC",
                (job_id,),
            ).fetchall()
            return [_row_to_market_agent_invocation(row) for row in rows]
        finally:
            c.close()


def market_ops_traffic_state_set(
    us_percent: int,
    eu_percent: int,
    changed_by: str = "",
    notes: str = "",
    regional_weights: dict[str, int] | None = None,
) -> None:
    now = time.time()
    normalized_weights = {
        "na_west": 0,
        "na_east": 0,
        "eu": 0,
        "asia": 0,
        "australia": 0,
    }
    if isinstance(regional_weights, dict):
        for key in normalized_weights:
            if key in regional_weights:
                normalized_weights[key] = int(regional_weights.get(key) or 0)
    else:
        normalized_weights["na_west"] = int(us_percent or 0)
        normalized_weights["eu"] = int(eu_percent or 0)

    aggregated_us = int(normalized_weights["na_west"]) + int(normalized_weights["na_east"])
    aggregated_eu = int(normalized_weights["eu"])
    with _lock:
        c = _connect()
        try:
            c.execute(
                """
                INSERT INTO market_ops_traffic_state (
                    id, us_percent, eu_percent, regional_weights_json, changed_by, notes, updated_at
                )
                VALUES (1, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    us_percent = excluded.us_percent,
                    eu_percent = excluded.eu_percent,
                    regional_weights_json = excluded.regional_weights_json,
                    changed_by = excluded.changed_by,
                    notes = excluded.notes,
                    updated_at = excluded.updated_at
                """,
                (
                    aggregated_us,
                    aggregated_eu,
                    json.dumps(normalized_weights),
                    changed_by,
                    notes,
                    now,
                ),
            )
            c.commit()
        finally:
            c.close()


def market_ops_traffic_state_get() -> dict[str, Any]:
    with _lock:
        c = _connect()
        try:
            row = c.execute(
                """
                SELECT us_percent, eu_percent, regional_weights_json, changed_by, notes, updated_at
                FROM market_ops_traffic_state
                WHERE id = 1
                """
            ).fetchone()
            if not row:
                return {
                    "us_percent": 50,
                    "eu_percent": 50,
                    "regional_weights": {
                        "na_west": 20,
                        "na_east": 20,
                        "eu": 30,
                        "asia": 20,
                        "australia": 10,
                    },
                    "changed_by": "",
                    "notes": "",
                    "updated_at": 0,
                }
            regional_weights = _json_loads(row["regional_weights_json"], {})
            if not isinstance(regional_weights, dict) or not regional_weights:
                regional_weights = {
                    "na_west": int(row["us_percent"] or 0),
                    "na_east": 0,
                    "eu": int(row["eu_percent"] or 0),
                    "asia": 0,
                    "australia": 0,
                }
            return {
                "us_percent": int(row["us_percent"] or 0),
                "eu_percent": int(row["eu_percent"] or 0),
                "regional_weights": {
                    "na_west": int(regional_weights.get("na_west") or 0),
                    "na_east": int(regional_weights.get("na_east") or 0),
                    "eu": int(regional_weights.get("eu") or 0),
                    "asia": int(regional_weights.get("asia") or 0),
                    "australia": int(regional_weights.get("australia") or 0),
                },
                "changed_by": row["changed_by"] or "",
                "notes": row["notes"] or "",
                "updated_at": float(row["updated_at"] or 0),
            }
        finally:
            c.close()


def market_ops_model_rollout_create(
    rollout_id: str,
    target: str,
    revision: str,
    strategy: str = "canary",
    requested_by: str = "",
    status: str = "queued",
    metadata: dict[str, Any] | None = None,
) -> None:
    now = time.time()
    metadata = metadata or {}
    with _lock:
        c = _connect()
        try:
            c.execute(
                """
                INSERT INTO market_ops_model_rollouts (
                    id, target, revision, strategy, requested_by, status, metadata_json, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    rollout_id,
                    target,
                    revision,
                    strategy,
                    requested_by,
                    status,
                    json.dumps(metadata),
                    now,
                    now,
                ),
            )
            c.commit()
        finally:
            c.close()


def market_ops_model_rollouts_list(limit: int = 20) -> list[dict[str, Any]]:
    safe_limit = max(1, min(int(limit or 20), 100))
    with _lock:
        c = _connect()
        try:
            rows = c.execute(
                """
                SELECT id, target, revision, strategy, requested_by, status, metadata_json, created_at, updated_at
                FROM market_ops_model_rollouts
                ORDER BY created_at DESC
                LIMIT ?
                """,
                (safe_limit,),
            ).fetchall()
            return [
                {
                    "id": row["id"],
                    "target": row["target"] or "",
                    "revision": row["revision"] or "",
                    "strategy": row["strategy"] or "canary",
                    "requested_by": row["requested_by"] or "",
                    "status": row["status"] or "queued",
                    "metadata": _json_loads(row["metadata_json"], {}),
                    "created_at": float(row["created_at"] or 0),
                    "updated_at": float(row["updated_at"] or 0),
                }
                for row in rows
            ]
        finally:
            c.close()


def market_ops_model_rollout_latest() -> dict[str, Any] | None:
    items = market_ops_model_rollouts_list(limit=1)
    return items[0] if items else None


def market_ops_component_state_set(
    component_id: str,
    desired_state: str,
    last_action: str,
    updated_by: str = "",
    notes: str = "",
    metadata: dict[str, Any] | None = None,
) -> None:
    now = time.time()
    metadata = metadata or {}
    with _lock:
        c = _connect()
        try:
            c.execute(
                """
                INSERT INTO market_ops_component_state (
                    component_id, desired_state, last_action, updated_by, notes, metadata_json, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(component_id) DO UPDATE SET
                    desired_state = excluded.desired_state,
                    last_action = excluded.last_action,
                    updated_by = excluded.updated_by,
                    notes = excluded.notes,
                    metadata_json = excluded.metadata_json,
                    updated_at = excluded.updated_at
                """,
                (
                    component_id,
                    desired_state,
                    last_action,
                    updated_by,
                    notes,
                    json.dumps(metadata),
                    now,
                ),
            )
            c.commit()
        finally:
            c.close()


def market_ops_component_state_get(component_id: str) -> dict[str, Any] | None:
    with _lock:
        c = _connect()
        try:
            row = c.execute(
                """
                SELECT component_id, desired_state, last_action, updated_by, notes, metadata_json, updated_at
                FROM market_ops_component_state
                WHERE component_id = ?
                """,
                (component_id,),
            ).fetchone()
            if not row:
                return None
            return {
                "component_id": row["component_id"],
                "desired_state": row["desired_state"] or "running",
                "last_action": row["last_action"] or "",
                "updated_by": row["updated_by"] or "",
                "notes": row["notes"] or "",
                "metadata": _json_loads(row["metadata_json"], {}),
                "updated_at": float(row["updated_at"] or 0),
            }
        finally:
            c.close()


def market_ops_component_states_list() -> list[dict[str, Any]]:
    with _lock:
        c = _connect()
        try:
            rows = c.execute(
                """
                SELECT component_id, desired_state, last_action, updated_by, notes, metadata_json, updated_at
                FROM market_ops_component_state
                ORDER BY component_id ASC
                """
            ).fetchall()
            return [
                {
                    "component_id": row["component_id"],
                    "desired_state": row["desired_state"] or "running",
                    "last_action": row["last_action"] or "",
                    "updated_by": row["updated_by"] or "",
                    "notes": row["notes"] or "",
                    "metadata": _json_loads(row["metadata_json"], {}),
                    "updated_at": float(row["updated_at"] or 0),
                }
                for row in rows
            ]
        finally:
            c.close()


def market_ops_component_action_create(
    action_id: str,
    component_id: str,
    action: str,
    requested_by: str = "",
    status: str = "queued",
    execution_mode: str = "dry_run",
    notes: str = "",
    metadata: dict[str, Any] | None = None,
    approved_by: str = "",
    approved_at: float = 0.0,
    rollback_of_action_id: str = "",
) -> None:
    metadata = metadata or {}
    now = time.time()
    with _lock:
        c = _connect()
        try:
            c.execute(
                """
                INSERT INTO market_ops_component_actions (
                    id, component_id, action, requested_by, status, execution_mode, notes, metadata_json,
                    approved_by, approved_at, rollback_of_action_id, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    action_id,
                    component_id,
                    action,
                    requested_by,
                    status,
                    execution_mode,
                    notes,
                    json.dumps(metadata),
                    approved_by,
                    approved_at,
                    rollback_of_action_id,
                    now,
                ),
            )
            c.commit()
        finally:
            c.close()


def _market_ops_component_action_row(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "component_id": row["component_id"] or "",
        "action": row["action"] or "",
        "requested_by": row["requested_by"] or "",
        "status": row["status"] or "queued",
        "execution_mode": row["execution_mode"] or "dry_run",
        "notes": row["notes"] or "",
        "metadata": _json_loads(row["metadata_json"], {}),
        "approved_by": row["approved_by"] or "",
        "approved_at": float(row["approved_at"] or 0),
        "started_at": float(row["started_at"] or 0),
        "finished_at": float(row["finished_at"] or 0),
        "command_trace": row["command_trace"] or "",
        "error_trace": row["error_trace"] or "",
        "rollback_of_action_id": row["rollback_of_action_id"] or "",
        "created_at": float(row["created_at"] or 0),
    }


def market_ops_component_action_get(action_id: str) -> dict[str, Any] | None:
    with _lock:
        c = _connect()
        try:
            row = c.execute(
                """
                SELECT
                    id, component_id, action, requested_by, status, execution_mode, notes, metadata_json,
                    approved_by, approved_at, started_at, finished_at, command_trace, error_trace,
                    rollback_of_action_id, created_at
                FROM market_ops_component_actions
                WHERE id = ?
                """,
                (action_id,),
            ).fetchone()
            if not row:
                return None
            return _market_ops_component_action_row(row)
        finally:
            c.close()


def market_ops_component_action_update(
    action_id: str,
    *,
    status: str | None = None,
    approved_by: str | None = None,
    approved_at: float | None = None,
    started_at: float | None = None,
    finished_at: float | None = None,
    command_trace: str | None = None,
    error_trace: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any] | None:
    with _lock:
        c = _connect()
        try:
            current = c.execute(
                """
                SELECT
                    id, component_id, action, requested_by, status, execution_mode, notes, metadata_json,
                    approved_by, approved_at, started_at, finished_at, command_trace, error_trace,
                    rollback_of_action_id, created_at
                FROM market_ops_component_actions
                WHERE id = ?
                """,
                (action_id,),
            ).fetchone()
            if not current:
                return None
            c.execute(
                """
                UPDATE market_ops_component_actions
                SET status = ?, approved_by = ?, approved_at = ?, started_at = ?, finished_at = ?,
                    command_trace = ?, error_trace = ?, metadata_json = ?
                WHERE id = ?
                """,
                (
                    status if status is not None else (current["status"] or "queued"),
                    approved_by if approved_by is not None else (current["approved_by"] or ""),
                    float(approved_at if approved_at is not None else (current["approved_at"] or 0)),
                    float(started_at if started_at is not None else (current["started_at"] or 0)),
                    float(finished_at if finished_at is not None else (current["finished_at"] or 0)),
                    command_trace if command_trace is not None else (current["command_trace"] or ""),
                    error_trace if error_trace is not None else (current["error_trace"] or ""),
                    json.dumps(metadata if metadata is not None else _json_loads(current["metadata_json"], {})),
                    action_id,
                ),
            )
            c.commit()
            return market_ops_component_action_get(action_id)
        finally:
            c.close()


def market_ops_component_action_next_approved() -> dict[str, Any] | None:
    with _lock:
        c = _connect()
        try:
            row = c.execute(
                """
                SELECT
                    id, component_id, action, requested_by, status, execution_mode, notes, metadata_json,
                    approved_by, approved_at, started_at, finished_at, command_trace, error_trace,
                    rollback_of_action_id, created_at
                FROM market_ops_component_actions
                WHERE status IN ('approved', 'queued')
                ORDER BY created_at ASC
                LIMIT 1
                """
            ).fetchone()
            if not row:
                return None
            return _market_ops_component_action_row(row)
        finally:
            c.close()


def market_ops_component_actions_list(limit: int = 20) -> list[dict[str, Any]]:
    safe_limit = max(1, min(int(limit or 20), 100))
    with _lock:
        c = _connect()
        try:
            rows = c.execute(
                """
                SELECT
                    id, component_id, action, requested_by, status, execution_mode, notes, metadata_json,
                    approved_by, approved_at, started_at, finished_at, command_trace, error_trace,
                    rollback_of_action_id, created_at
                FROM market_ops_component_actions
                ORDER BY created_at DESC
                LIMIT ?
                """,
                (safe_limit,),
            ).fetchall()
            return [_market_ops_component_action_row(row) for row in rows]
        finally:
            c.close()


def market_ops_drift_run_create(
    run_id: str,
    module_key: str,
    module_path: str,
    trigger: str = "scheduled",
    status: str = "queued",
) -> None:
    now = time.time()
    with _lock:
        c = _connect()
        try:
            c.execute(
                """
                INSERT INTO market_ops_drift_runs (
                    id, module_key, module_path, trigger, status, created_at
                ) VALUES (?, ?, ?, ?, ?, ?)
                """,
                (run_id, module_key, module_path, trigger, status, now),
            )
            c.commit()
        finally:
            c.close()


def market_ops_drift_run_update(
    run_id: str,
    *,
    status: str | None = None,
    exit_code: int | None = None,
    drift_detected: bool | None = None,
    stdout_text: str | None = None,
    stderr_text: str | None = None,
    diff_summary: dict[str, Any] | None = None,
    started_at: float | None = None,
    finished_at: float | None = None,
) -> dict[str, Any] | None:
    with _lock:
        c = _connect()
        try:
            current = c.execute(
                """
                SELECT
                    id, module_key, module_path, trigger, status, exit_code, drift_detected, stdout_text,
                    stderr_text, diff_summary_json, created_at, started_at, finished_at
                FROM market_ops_drift_runs
                WHERE id = ?
                """,
                (run_id,),
            ).fetchone()
            if not current:
                return None
            c.execute(
                """
                UPDATE market_ops_drift_runs
                SET status = ?, exit_code = ?, drift_detected = ?, stdout_text = ?, stderr_text = ?,
                    diff_summary_json = ?, started_at = ?, finished_at = ?
                WHERE id = ?
                """,
                (
                    status if status is not None else (current["status"] or "queued"),
                    int(exit_code if exit_code is not None else (current["exit_code"] or 0)),
                    int(drift_detected if drift_detected is not None else bool(current["drift_detected"])),
                    stdout_text if stdout_text is not None else (current["stdout_text"] or ""),
                    stderr_text if stderr_text is not None else (current["stderr_text"] or ""),
                    json.dumps(diff_summary if diff_summary is not None else _json_loads(current["diff_summary_json"], {})),
                    float(started_at if started_at is not None else (current["started_at"] or 0)),
                    float(finished_at if finished_at is not None else (current["finished_at"] or 0)),
                    run_id,
                ),
            )
            c.commit()
            return market_ops_drift_run_get(run_id)
        finally:
            c.close()


def market_ops_drift_run_get(run_id: str) -> dict[str, Any] | None:
    with _lock:
        c = _connect()
        try:
            row = c.execute(
                """
                SELECT
                    id, module_key, module_path, trigger, status, exit_code, drift_detected, stdout_text,
                    stderr_text, diff_summary_json, created_at, started_at, finished_at
                FROM market_ops_drift_runs
                WHERE id = ?
                """,
                (run_id,),
            ).fetchone()
            if not row:
                return None
            return {
                "id": row["id"],
                "module_key": row["module_key"] or "",
                "module_path": row["module_path"] or "",
                "trigger": row["trigger"] or "scheduled",
                "status": row["status"] or "queued",
                "exit_code": int(row["exit_code"] or 0),
                "drift_detected": bool(row["drift_detected"]),
                "stdout_text": row["stdout_text"] or "",
                "stderr_text": row["stderr_text"] or "",
                "diff_summary": _json_loads(row["diff_summary_json"], {}),
                "created_at": float(row["created_at"] or 0),
                "started_at": float(row["started_at"] or 0),
                "finished_at": float(row["finished_at"] or 0),
            }
        finally:
            c.close()


def market_ops_drift_runs_list(limit: int = 20) -> list[dict[str, Any]]:
    safe_limit = max(1, min(int(limit or 20), 200))
    with _lock:
        c = _connect()
        try:
            rows = c.execute(
                """
                SELECT
                    id, module_key, module_path, trigger, status, exit_code, drift_detected, stdout_text,
                    stderr_text, diff_summary_json, created_at, started_at, finished_at
                FROM market_ops_drift_runs
                ORDER BY created_at DESC
                LIMIT ?
                """,
                (safe_limit,),
            ).fetchall()
            return [
                {
                    "id": row["id"],
                    "module_key": row["module_key"] or "",
                    "module_path": row["module_path"] or "",
                    "trigger": row["trigger"] or "scheduled",
                    "status": row["status"] or "queued",
                    "exit_code": int(row["exit_code"] or 0),
                    "drift_detected": bool(row["drift_detected"]),
                    "stdout_text": row["stdout_text"] or "",
                    "stderr_text": row["stderr_text"] or "",
                    "diff_summary": _json_loads(row["diff_summary_json"], {}),
                    "created_at": float(row["created_at"] or 0),
                    "started_at": float(row["started_at"] or 0),
                    "finished_at": float(row["finished_at"] or 0),
                }
                for row in rows
            ]
        finally:
            c.close()


def market_ops_alert_create(
    alert_id: str,
    alert_type: str,
    severity: str,
    source: str,
    message: str,
    metadata: dict[str, Any] | None = None,
) -> None:
    metadata = metadata or {}
    now = time.time()
    with _lock:
        c = _connect()
        try:
            c.execute(
                """
                INSERT INTO market_ops_alerts (
                    id, alert_type, severity, source, message, metadata_json, acknowledged, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, 0, ?)
                """,
                (alert_id, alert_type, severity, source, message, json.dumps(metadata), now),
            )
            c.commit()
        finally:
            c.close()


def market_ops_alerts_list(limit: int = 20, include_acknowledged: bool = False) -> list[dict[str, Any]]:
    safe_limit = max(1, min(int(limit or 20), 200))
    with _lock:
        c = _connect()
        try:
            if include_acknowledged:
                rows = c.execute(
                    """
                    SELECT id, alert_type, severity, source, message, metadata_json, acknowledged, created_at, acknowledged_at
                    FROM market_ops_alerts
                    ORDER BY created_at DESC
                    LIMIT ?
                    """,
                    (safe_limit,),
                ).fetchall()
            else:
                rows = c.execute(
                    """
                    SELECT id, alert_type, severity, source, message, metadata_json, acknowledged, created_at, acknowledged_at
                    FROM market_ops_alerts
                    WHERE acknowledged = 0
                    ORDER BY created_at DESC
                    LIMIT ?
                    """,
                    (safe_limit,),
                ).fetchall()
            return [
                {
                    "id": row["id"],
                    "alert_type": row["alert_type"] or "",
                    "severity": row["severity"] or "info",
                    "source": row["source"] or "",
                    "message": row["message"] or "",
                    "metadata": _json_loads(row["metadata_json"], {}),
                    "acknowledged": bool(row["acknowledged"]),
                    "created_at": float(row["created_at"] or 0),
                    "acknowledged_at": float(row["acknowledged_at"] or 0),
                }
                for row in rows
            ]
        finally:
            c.close()


def auth_principal_create(
    principal_id: str,
    status: str = "active",
    display_name: str = "",
) -> None:
    now = time.time()
    with _lock:
        c = _connect()
        try:
            c.execute(
                """
                INSERT INTO auth_principals (id, status, display_name, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    status = excluded.status,
                    display_name = excluded.display_name,
                    updated_at = excluded.updated_at
                """,
                (principal_id, status, display_name, now, now),
            )
            c.commit()
        finally:
            c.close()


def auth_principal_get(principal_id: str) -> dict[str, Any] | None:
    with _lock:
        c = _connect()
        try:
            row = c.execute(
                "SELECT id, status, display_name, created_at, updated_at FROM auth_principals WHERE id = ?",
                (principal_id,),
            ).fetchone()
            if not row:
                return None
            return {
                "id": row["id"],
                "status": row["status"] or "active",
                "display_name": row["display_name"] or "",
                "created_at": float(row["created_at"] or 0),
                "updated_at": float(row["updated_at"] or 0),
            }
        finally:
            c.close()


def auth_identifier_upsert(
    identifier_id: str,
    principal_id: str,
    kind: str,
    value_norm: str,
    verified_at: float = 0.0,
    metadata: dict[str, Any] | None = None,
) -> None:
    now = time.time()
    metadata = metadata or {}
    with _lock:
        c = _connect()
        try:
            c.execute(
                """
                INSERT INTO auth_identifiers (
                    id, principal_id, kind, value_norm, verified_at, metadata_json, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(kind, value_norm) DO UPDATE SET
                    principal_id = excluded.principal_id,
                    verified_at = excluded.verified_at,
                    metadata_json = excluded.metadata_json,
                    updated_at = excluded.updated_at
                """,
                (
                    identifier_id,
                    principal_id,
                    kind,
                    value_norm,
                    verified_at,
                    json.dumps(metadata),
                    now,
                    now,
                ),
            )
            c.commit()
        finally:
            c.close()


def auth_identifier_get(kind: str, value_norm: str) -> dict[str, Any] | None:
    with _lock:
        c = _connect()
        try:
            row = c.execute(
                """
                SELECT id, principal_id, kind, value_norm, verified_at, metadata_json, created_at, updated_at
                FROM auth_identifiers
                WHERE kind = ? AND value_norm = ?
                """,
                (kind, value_norm),
            ).fetchone()
            if not row:
                return None
            return {
                "id": row["id"],
                "principal_id": row["principal_id"],
                "kind": row["kind"] or "",
                "value_norm": row["value_norm"] or "",
                "verified_at": float(row["verified_at"] or 0),
                "metadata": _json_loads(row["metadata_json"], {}),
                "created_at": float(row["created_at"] or 0),
                "updated_at": float(row["updated_at"] or 0),
            }
        finally:
            c.close()


def auth_challenge_create(
    challenge_id: str,
    factor_type: str,
    purpose: str,
    nonce: str,
    principal_hint: str = "",
    payload: dict[str, Any] | None = None,
    ip_hash: str = "",
    ua_hash: str = "",
    expires_at: float = 0.0,
) -> None:
    now = time.time()
    payload = payload or {}
    with _lock:
        c = _connect()
        try:
            c.execute(
                """
                INSERT INTO auth_challenges (
                    id, principal_hint, factor_type, purpose, nonce, payload_json,
                    ip_hash, ua_hash, expires_at, consumed_at, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
                """,
                (
                    challenge_id,
                    principal_hint,
                    factor_type,
                    purpose,
                    nonce,
                    json.dumps(payload),
                    ip_hash,
                    ua_hash,
                    expires_at,
                    now,
                ),
            )
            c.commit()
        finally:
            c.close()


def auth_challenge_get(challenge_id: str) -> dict[str, Any] | None:
    with _lock:
        c = _connect()
        try:
            row = c.execute(
                """
                SELECT id, principal_hint, factor_type, purpose, nonce, payload_json,
                       ip_hash, ua_hash, expires_at, consumed_at, created_at
                FROM auth_challenges WHERE id = ?
                """,
                (challenge_id,),
            ).fetchone()
            if not row:
                return None
            return {
                "id": row["id"],
                "principal_hint": row["principal_hint"] or "",
                "factor_type": row["factor_type"] or "",
                "purpose": row["purpose"] or "",
                "nonce": row["nonce"] or "",
                "payload": _json_loads(row["payload_json"], {}),
                "ip_hash": row["ip_hash"] or "",
                "ua_hash": row["ua_hash"] or "",
                "expires_at": float(row["expires_at"] or 0),
                "consumed_at": float(row["consumed_at"] or 0),
                "created_at": float(row["created_at"] or 0),
            }
        finally:
            c.close()


def auth_challenge_consume(challenge_id: str) -> bool:
    now = time.time()
    with _lock:
        c = _connect()
        try:
            updated = c.execute(
                """
                UPDATE auth_challenges
                SET consumed_at = ?
                WHERE id = ? AND consumed_at = 0
                """,
                (now, challenge_id),
            ).rowcount
            c.commit()
            return bool(updated)
        finally:
            c.close()


def auth_magic_link_create(
    magic_id: str,
    principal_id: str,
    email_norm: str,
    token_hash: str,
    ip_hash: str = "",
    expires_at: float = 0.0,
) -> None:
    now = time.time()
    with _lock:
        c = _connect()
        try:
            c.execute(
                """
                INSERT INTO auth_magic_links (id, principal_id, email_norm, token_hash, ip_hash, expires_at, used_at, created_at)
                VALUES (?, ?, ?, ?, ?, ?, 0, ?)
                """,
                (magic_id, principal_id, email_norm, token_hash, ip_hash, expires_at, now),
            )
            c.commit()
        finally:
            c.close()


def auth_magic_link_use(token_hash: str) -> dict[str, Any] | None:
    now = time.time()
    with _lock:
        c = _connect()
        try:
            row = c.execute(
                """
                SELECT id, principal_id, email_norm, token_hash, ip_hash, expires_at, used_at, created_at
                FROM auth_magic_links
                WHERE token_hash = ?
                ORDER BY created_at DESC
                LIMIT 1
                """,
                (token_hash,),
            ).fetchone()
            if not row:
                return None
            if float(row["used_at"] or 0) > 0:
                return None
            if float(row["expires_at"] or 0) <= now:
                return None
            c.execute("UPDATE auth_magic_links SET used_at = ? WHERE id = ?", (now, row["id"]))
            c.commit()
            return {
                "id": row["id"],
                "principal_id": row["principal_id"] or "",
                "email_norm": row["email_norm"] or "",
                "created_at": float(row["created_at"] or 0),
                "expires_at": float(row["expires_at"] or 0),
            }
        finally:
            c.close()


def auth_session_create(
    session_id: str,
    principal_id: str,
    session_secret_hash: str,
    device_fingerprint_hash: str = "",
    device_id: str = "",
    csrf_secret_hash: str = "",
    aal: int = 1,
    roles: list[str] | None = None,
    expires_at: float = 0.0,
    rotated_from: str = "",
) -> None:
    now = time.time()
    roles = roles or ["viewer"]
    with _lock:
        c = _connect()
        try:
            c.execute(
                """
                INSERT INTO auth_sessions (
                    id, principal_id, device_id, device_fingerprint_hash, session_secret_hash,
                    csrf_secret_hash, aal, roles_json, issued_at, expires_at, rotated_from,
                    revoked_at, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
                """,
                (
                    session_id,
                    principal_id,
                    device_id,
                    device_fingerprint_hash,
                    session_secret_hash,
                    csrf_secret_hash,
                    int(aal),
                    json.dumps(roles),
                    now,
                    expires_at,
                    rotated_from,
                    now,
                    now,
                ),
            )
            c.commit()
        finally:
            c.close()


def auth_session_get_by_secret_hash(session_secret_hash: str) -> dict[str, Any] | None:
    with _lock:
        c = _connect()
        try:
            row = c.execute(
                """
                SELECT id, principal_id, device_id, device_fingerprint_hash, session_secret_hash,
                       csrf_secret_hash, aal, roles_json, issued_at, expires_at, rotated_from,
                       revoked_at, created_at, updated_at
                FROM auth_sessions
                WHERE session_secret_hash = ?
                ORDER BY created_at DESC
                LIMIT 1
                """,
                (session_secret_hash,),
            ).fetchone()
            if not row:
                return None
            return {
                "id": row["id"],
                "principal_id": row["principal_id"],
                "device_id": row["device_id"] or "",
                "device_fingerprint_hash": row["device_fingerprint_hash"] or "",
                "session_secret_hash": row["session_secret_hash"] or "",
                "csrf_secret_hash": row["csrf_secret_hash"] or "",
                "aal": int(row["aal"] or 1),
                "roles": _json_loads(row["roles_json"], ["viewer"]),
                "issued_at": float(row["issued_at"] or 0),
                "expires_at": float(row["expires_at"] or 0),
                "rotated_from": row["rotated_from"] or "",
                "revoked_at": float(row["revoked_at"] or 0),
                "created_at": float(row["created_at"] or 0),
                "updated_at": float(row["updated_at"] or 0),
            }
        finally:
            c.close()


def auth_session_revoke(session_id: str) -> None:
    now = time.time()
    with _lock:
        c = _connect()
        try:
            c.execute(
                """
                UPDATE auth_sessions
                SET revoked_at = ?, updated_at = ?
                WHERE id = ? AND revoked_at = 0
                """,
                (now, now, session_id),
            )
            c.commit()
        finally:
            c.close()


def auth_authorization_grant(
    authz_id: str,
    principal_id: str,
    role: str,
    scope: str = "*",
    granted_by: str = "",
    expires_at: float = 0.0,
    metadata: dict[str, Any] | None = None,
) -> None:
    now = time.time()
    metadata = metadata or {}
    with _lock:
        c = _connect()
        try:
            c.execute(
                """
                INSERT INTO auth_authorizations (
                    id, principal_id, role, scope, granted_by, granted_at, expires_at, metadata_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    authz_id,
                    principal_id,
                    role,
                    scope,
                    granted_by,
                    now,
                    expires_at,
                    json.dumps(metadata),
                ),
            )
            c.commit()
        finally:
            c.close()


def auth_authorizations_list(principal_id: str) -> list[dict[str, Any]]:
    now = time.time()
    with _lock:
        c = _connect()
        try:
            rows = c.execute(
                """
                SELECT id, principal_id, role, scope, granted_by, granted_at, expires_at, metadata_json
                FROM auth_authorizations
                WHERE principal_id = ? AND (expires_at = 0 OR expires_at > ?)
                ORDER BY granted_at DESC
                """,
                (principal_id, now),
            ).fetchall()
            return [
                {
                    "id": row["id"],
                    "principal_id": row["principal_id"],
                    "role": row["role"] or "",
                    "scope": row["scope"] or "*",
                    "granted_by": row["granted_by"] or "",
                    "granted_at": float(row["granted_at"] or 0),
                    "expires_at": float(row["expires_at"] or 0),
                    "metadata": _json_loads(row["metadata_json"], {}),
                }
                for row in rows
            ]
        finally:
            c.close()
