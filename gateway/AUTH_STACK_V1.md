# BountyNet Auth Stack V1 (SQLite Core)

This document defines the Phase 1/2 authentication control plane with SQLite as core storage and minimal dependencies.

## Goals

- No OAuth dependency for user auth flows.
- Device-bound sessions.
- Factor-ready challenge/verification architecture supporting:
  - Passkeys
  - Ethereum wallet
  - Solana wallet
  - Bitcoin wallet
  - EU NFC ID cards
  - Email magic link
- Server-side admin authorization for ops endpoints.

## SQLite DDL

```sql
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
```

## Endpoint Contracts (Phase 1)

### `POST /auth/challenge`
- Request:
  - `factor_type`: one of `passkey | wallet_eth | wallet_sol | wallet_btc | nfc_euid | email_magic_link`
  - `purpose`: optional (`login` default)
  - `principal_hint`: optional
  - `payload`: optional object
- Response:
  - `challenge_id`, `nonce`, `expires_at`, `factor_type`
  - For `wallet_eth`, `message_template` is also returned.
  - For cryptographic factors, `verification_mode` is returned (`native | dev_secret | adapter | unconfigured`).

### `GET /auth/verifiers/status`
- Returns active verification mode for each factor and whether adapter URLs are configured.

### `POST /auth/verify`
- Current implementation:
  - `wallet_eth` supports native verification when `eth_account` is available.
  - `wallet_sol`, `wallet_btc`, `passkey`, `nfc_euid` support:
    - dev proof mode (`BOUNTYNET_AUTH_DEV_FACTOR_SECRET`) with no extra dependencies, or
    - HTTP verifier adapter mode via environment URLs.
- Request (generic):
  - `factor_type`
  - `challenge_id`
  - `device_fingerprint`
  - For ETH native mode: `address`, `signature`
  - For generic mode: `identifier`, `proof`
- Response:
  - `status=verified`
  - session fields: `token`, `session_id`, `principal_id`, `aal`, `roles`, `expires_at`

### `POST /auth/magic-link/request`
- Request: `email`
- Response: `status=queued`, `email`, `expires_at`
- Dev mode:
  - Returns `dev_magic_link_token` when `BOUNTYNET_DEV_MAGIC_LINK_ECHO=1`.

### `POST /auth/magic-link/consume`
- Request: `token`, `device_fingerprint`
- Response:
  - `status=verified`, `factor_type=email_magic_link`
  - session fields as above.

### `GET /auth/session/me`
- Auth:
  - `Authorization: Bearer bna_sess_...`
  - `X-BN-Device-Fingerprint` when session is bound.
- Response:
  - `session_id`, `principal`, `roles`, `aal`, `expires_at`

### `POST /auth/logout`
- Revokes current session if present.
- Always returns `{ "status": "ok" }`.

### `POST /auth/bootstrap/admin`
- Request:
  - `identifier_kind`: `email | eth | sol | btc | passkey_handle | euid`
  - `identifier_value`
  - optional `bootstrap_secret`
- Grants `admin` role to the principal associated with that identifier.
- If `BOUNTYNET_AUTH_BOOTSTRAP_SECRET` is set, request must provide a matching `bootstrap_secret`.

## Authorization Policy (Current)

- Ops endpoints (`/ops/*`) require either:
  - valid service token (`MARKET_API_TOKEN`), or
  - valid auth session with `role=admin` and `aal>=2`.

## Next Phase

- Replace dev proof mode with production verifiers for passkey, Solana, Bitcoin, and NFC eID.
- Add session rotation, revocation events, and hard rate-limit enforcement.
- Replace dev magic-link echo with real email delivery provider.

## Environment knobs (important)

- `BOUNTYNET_AUTH_DEV_FACTOR_SECRET` — enables no-dependency dev proof verification for `wallet_sol`, `wallet_btc`, `passkey`, `nfc_euid` (and ETH fallback mode).
- `BOUNTYNET_AUTH_PASSKEY_VERIFY_URL` — optional HTTP verifier adapter.
- `BOUNTYNET_AUTH_SOL_VERIFY_URL` — optional HTTP verifier adapter.
- `BOUNTYNET_AUTH_BTC_VERIFY_URL` — optional HTTP verifier adapter.
- `BOUNTYNET_AUTH_NFC_VERIFY_URL` — optional HTTP verifier adapter.
- `BOUNTYNET_AUTH_ETH_VERIFY_URL` — optional HTTP verifier adapter when native ETH verification is unavailable/undesired.
