# BountyNet Gateway Security Audit — 2026-07-18

Audit scope: gateway route handlers, auth, chain, ops, agent, MCP, and identity modules.
Only NEW findings are listed below (known issues excluded per audit brief).

---

## VULN-01: Non-Constant-Time Bearer Token Comparison in Log Ingest

| Field | Value |
|---|---|
| **Severity** | Medium |
| **Location** | `gateway/routes/log_ingest.py:25` |
| **CWE** | CWE-208 (Observable Timing Discrepancy) |

### Description

The `_auth_ok()` function compares the supplied bearer token against the expected
`BOUNTYNET_CLIENT_LOG_TOKEN` using Python's `==` operator, which short-circuits on
the first mismatched character.

### Evidence

```python
# gateway/routes/log_ingest.py, line 25
return auth == f"Bearer {token}"
```

### Attack Path

1. Attacker sends many requests to `POST /logs/android` with varying `Authorization` headers.
2. By measuring response-time differences (sub-millisecond), the attacker identifies which
   character position caused the first mismatch.
3. Iterating character-by-character, the attacker recovers the full `BOUNTYNET_CLIENT_LOG_TOKEN`.
4. With the valid token, the attacker submits arbitrary log data.

### Impact

Full recovery of the log ingestion bearer token, enabling arbitrary log injection
and potential log poisoning of downstream systems that consume these entries.

### Remediation

Replace `==` with `hmac.compare_digest()`:

```python
import hmac
return hmac.compare_digest(auth, f"Bearer {token}")
```

---

## VULN-02: Non-Constant-Time Proof Comparison in Auth Dev Factor Verification

| Field | Value |
|---|---|
| **Severity** | High |
| **Location** | `gateway/auth_stack.py:178` |
| **CWE** | CWE-208 (Observable Timing Discrepancy) |

### Description

When `BOUNTYNET_AUTH_DEV_FACTOR_SECRET` is configured, the `_verify_factor_generic`
function compares the submitted proof against the expected HMAC-like hash using `!=`
(non-constant-time). An attacker can use timing side-channels to recover the expected
proof value and forge valid authentication for any identity.

### Evidence

```python
# gateway/auth_stack.py, line 178
if proof != expected:
    return {"ok": False, "error": "invalid proof"}
```

The `expected` value is `SHA-256(secret:factor_type:challenge_id:nonce:identifier)`.

### Attack Path

1. Attacker creates an auth challenge via `POST /auth/challenge` (unauthenticated).
2. Attacker sends many `POST /auth/verify` requests with varying `proof` values.
3. By measuring timing differences, attacker recovers the expected SHA-256 hex digest
   one character at a time.
4. With the valid proof, attacker authenticates as any identity and receives a session token.

### Impact

Complete authentication bypass when `BOUNTYNET_AUTH_DEV_FACTOR_SECRET` is set.
Attacker gains authenticated sessions with arbitrary principal identities, including
admin-bootstrapped accounts.

### Remediation

Replace `!=` with `hmac.compare_digest()`:

```python
if not hmac.compare_digest(proof, expected):
    return {"ok": False, "error": "invalid proof"}
```

---

## VULN-03: Non-Constant-Time Device Fingerprint Hash Comparison

| Field | Value |
|---|---|
| **Severity** | Low |
| **Location** | `gateway/auth_stack.py:282` |
| **CWE** | CWE-208 (Observable Timing Discrepancy) |

### Description

Session validation in `resolve_request_session` compares the device fingerprint hash
using `!=`, which is vulnerable to timing attacks. An attacker who has obtained a
valid session token can bypass the device-binding check by recovering the expected
fingerprint hash.

### Evidence

```python
# gateway/auth_stack.py, line 282
if not supplied or _sha256(supplied) != expected_device_hash:
    return None
```

### Attack Path

1. Attacker obtains a valid session token (e.g., via XSS, log leak, or VULN-02).
2. Attacker iterates `X-BN-Device-Fingerprint` header values, measuring response
   timing to determine which SHA-256 hash prefix matches.
3. While recovering the full hash is harder (must match pre-image), the timing leak
   confirms when partial matches occur, weakening the device binding guarantee.

### Impact

Device-binding bypass for stolen session tokens, weakening defense-in-depth
against session hijacking from a different device.

### Remediation

Replace `!=` with `hmac.compare_digest()`:

```python
if not supplied or not hmac.compare_digest(_sha256(supplied), expected_device_hash):
    return None
```

---

## VULN-04: Non-Constant-Time MARKET_API_TOKEN Comparison

| Field | Value |
|---|---|
| **Severity** | Medium |
| **Location** | `gateway/routes/market.py:272` |
| **CWE** | CWE-208 (Observable Timing Discrepancy) |

### Description

The `_require_market_auth()` function compares the supplied market API token against
the expected `MARKET_API_TOKEN` using `!=` (non-constant-time). This is also repeated
in `_ops_authorized()` at line 151 with the same pattern.

### Evidence

```python
# gateway/routes/market.py, line 272
if supplied != expected_token:
```

```python
# gateway/routes/market.py, line 151
if expected_token and supplied == expected_token:
```

### Attack Path

1. Attacker sends many requests to any market POST endpoint with varying `Authorization`
   or `X-Market-Token` headers.
2. Timing side-channel reveals the token character-by-character.
3. With the valid `MARKET_API_TOKEN`, the attacker gains full write access to all
   marketplace and ops endpoints.

### Impact

Full marketplace and infrastructure ops control: create/modify jobs, execute terraform
apply/destroy, traffic-shift, model rollouts, operator/agent suspension.

### Remediation

Replace `!=` / `==` with `hmac.compare_digest()` in both `_require_market_auth()` and
`_ops_authorized()`.

---

## VULN-05: Transaction Nonce Race Condition in `send_tx`

| Field | Value |
|---|---|
| **Severity** | Medium |
| **Location** | `gateway/chain.py:74` |
| **CWE** | CWE-362 (Race Condition) |

### Description

`send_tx()` fetches the transaction nonce via `w3.eth.get_transaction_count(acct.address)`
without any locking. When multiple requests trigger `send_tx` concurrently (e.g.,
simultaneous webhook events), they obtain the same nonce, causing one transaction to
fail with a "nonce too low" error or to be silently replaced.

### Evidence

```python
# gateway/chain.py, line 74
nonce = w3.eth.get_transaction_count(acct.address)
```

No lock, no nonce manager, and the same key (`ORACLE_KEY` / `DEPLOYER_PRIVATE_KEY`) is
shared across bounty creation, claim_intent, validation_request, validation_response,
and resolve_bounty calls.

### Attack Path

1. Attacker sends many concurrent GitHub webhook events (check_run completed) to
   `/github/webhook` or `/oracle`.
2. Multiple calls to `send_tx` execute concurrently, each fetching the same nonce.
3. Only one transaction succeeds; others fail silently or are replaced.
4. Bounty resolution, validation, or claim transactions are dropped, preventing
   legitimate payouts.

### Impact

Denial-of-service against on-chain operations. Bounty payouts, validations, and claims
can be selectively blocked by inducing concurrent transaction submissions.

### Remediation

Implement a nonce manager with a threading lock:

```python
_nonce_lock = threading.Lock()

def send_tx(to: str, data: str, key: str = ORACLE_KEY) -> dict:
    with _nonce_lock:
        acct = Account.from_key(key)
        nonce = w3.eth.get_transaction_count(acct.address)
        tx = { ... "nonce": nonce, ... }
        signed = acct.sign_transaction(tx)
        tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
    return { ... }
```

---

## VULN-06: CCIP-Read Gateway Null Signature When Relayer Key Missing

| Field | Value |
|---|---|
| **Severity** | Medium |
| **Location** | `gateway/routes/ens.py:153-154` |
| **CWE** | CWE-347 (Improper Verification of Cryptographic Signature) |

### Description

When `RELAYER_PRIVATE_KEY` is not set, the CCIP-Read gateway returns responses with
a null signature (`b"\x00" * 65`) instead of failing. If on-chain resolver contracts
or client-side code do not strictly verify signatures, they will accept forged
name-resolution responses.

### Evidence

```python
# gateway/routes/ens.py, lines 153-154
else:
    signature = b"\x00" * 65
```

### Attack Path

1. Deployment is misconfigured with `RELAYER_PRIVATE_KEY` unset.
2. Attacker queries `GET /ens/<sender>/<data>.json` for an agent subdomain.
3. Gateway returns the correct address but signed with a null signature.
4. If the on-chain verifier (or any client library) does not reject null signatures,
   an attacker operating a separate gateway could return arbitrary addresses signed
   with the same null pattern.
5. Funds sent to the resolved address go to the attacker's wallet.

### Impact

ENS name resolution spoofing — agent wallet addresses can be redirected to
attacker-controlled addresses, enabling theft of bounty payouts and token transfers.

### Remediation

Return an error response instead of a null signature:

```python
if not GATEWAY_KEY:
    return jsonify({"error": "CCIP signing key not configured"}), 500
```

---

## VULN-07: GitHub App PEM Key Loaded from Relative CWD Path

| Field | Value |
|---|---|
| **Severity** | Medium |
| **Location** | `gateway/github/app_auth.py:18-19` |
| **CWE** | CWE-426 (Untrusted Search Path) |

### Description

The `_load_private_key()` function first attempts to read from the relative path
`github_app_key.pem` using the process's current working directory. If another
vulnerability allows writing a file to the CWD, an attacker can inject a malicious
PEM key, hijacking GitHub App JWT signing.

### Evidence

```python
# gateway/github/app_auth.py, lines 18-19
def _load_private_key() -> str:
    for path in ["github_app_key.pem"]:
        try:
            with open(path) as f:
                return f.read()
```

### Attack Path

1. Attacker exploits a file-write vulnerability (e.g., market autopilot with
   attacker-controlled `local_path`) to place a `github_app_key.pem` file in the
   gateway process CWD.
2. On next gateway restart (or if the key is lazily loaded), the attacker's PEM
   key is loaded instead.
3. Attacker generates valid GitHub App JWTs signed with their key.
4. Attacker uses forged JWTs to obtain installation tokens, gaining read/write
   access to all repositories where the GitHub App is installed.

### Impact

Full GitHub App permission hijacking — read/write access to source code, ability
to push malicious commits, modify CI workflows, and exfiltrate secrets from
connected repositories.

### Remediation

Use an absolute path or remove the file-based fallback, requiring the key via
environment variable only:

```python
def _load_private_key() -> str:
    raw = os.environ.get("GITHUB_APP_PRIVATE_KEY", "")
    return raw.replace("\\n", "\n") if raw else ""
```

---

## VULN-08: MCP Server DNS Rebinding Protection Disabled by Default

| Field | Value |
|---|---|
| **Severity** | Medium |
| **Location** | `gateway/mcp_server.py:36-37` |
| **CWE** | CWE-350 (Reliance on Reverse DNS Resolution for Security) |

### Description

The MCP server's `_mcp_transport_security()` function defaults to
`enable_dns_rebinding_protection=False`. When the gateway is exposed on the
network (as it is in production), a malicious website can use DNS rebinding to
issue cross-origin requests to the MCP endpoint from a victim's browser.

### Evidence

```python
# gateway/mcp_server.py, lines 36-37
if os.environ.get("MCP_DNS_REBINDING_PROTECTION", "").lower() not in ("1", "true", "yes"):
    return TransportSecuritySettings(enable_dns_rebinding_protection=False)
```

### Attack Path

1. Attacker hosts a malicious website that resolves to the target gateway IP via
   DNS rebinding (short TTL, alternate A records).
2. Victim visits the malicious page; JavaScript makes POST requests to `/mcp`
   which resolve to the gateway.
3. MCP tools (`bountynet_show_feed`) are called, returning structured bounty data.
4. Attacker exfiltrates bounty intelligence (open amounts, solver IDs, repo names).

### Impact

Cross-origin data exfiltration of bounty feed data through DNS rebinding. While
bounty data is also available via `GET /bounties`, the MCP endpoint provides
structured data that could be programmatically consumed at scale.

### Remediation

Auto-enable DNS rebinding protection when `MCP_ALLOWED_HOSTS` is configured, and
require explicit opt-out (`MCP_DNS_REBINDING_PROTECTION=0`) to disable it:

```python
explicit = os.environ.get("MCP_DNS_REBINDING_PROTECTION", "").lower()
if explicit in ("0", "false", "no"):
    return TransportSecuritySettings(enable_dns_rebinding_protection=False)
hosts = [h.strip() for h in os.environ.get("MCP_ALLOWED_HOSTS", "").split(",") if h.strip()]
if explicit in ("1", "true", "yes") or hosts:
    return TransportSecuritySettings(
        enable_dns_rebinding_protection=True,
        allowed_hosts=hosts,
        allowed_origins=origins,
    )
return TransportSecuritySettings(enable_dns_rebinding_protection=False)
```

---

## VULN-09: Health Endpoint Leaks Internal Filesystem Path

| Field | Value |
|---|---|
| **Severity** | Low |
| **Location** | `gateway/chain.py:137` |
| **CWE** | CWE-200 (Information Exposure) |

### Description

The unauthenticated `GET /health` endpoint returns the SQLite database file path
(`storage_db`) in its response, disclosing the internal filesystem layout of the
deployment.

### Evidence

```python
# gateway/chain.py, line 137
"storage_db": db_path(),
```

Returns values like `/home/ubuntu/.bountynet/gateway.db` or
`/app/.bountynet/gateway.db`.

### Attack Path

1. Attacker queries `GET /health` (unauthenticated).
2. Response reveals the filesystem path (e.g., `/home/ubuntu/.bountynet/gateway.db`).
3. Attacker uses this path information to target file-read/write vulnerabilities,
   SQLite injection, or to identify the deployment environment and user context.

### Impact

Information disclosure aiding reconnaissance for further attacks.

### Remediation

Remove `storage_db` from the health response or replace with a boolean indicator:

```python
"storage_ok": Path(db_path()).is_file(),
```

---

## Summary

| ID | Severity | Component | Title |
|---|---|---|---|
| VULN-01 | Medium | log_ingest.py | Non-constant-time bearer token comparison |
| VULN-02 | High | auth_stack.py | Non-constant-time dev factor proof comparison |
| VULN-03 | Low | auth_stack.py | Non-constant-time device fingerprint hash comparison |
| VULN-04 | Medium | market.py | Non-constant-time MARKET_API_TOKEN comparison |
| VULN-05 | Medium | chain.py | Transaction nonce race condition |
| VULN-06 | Medium | ens.py | CCIP-Read null signature fallback |
| VULN-07 | Medium | app_auth.py | GitHub App key from relative CWD path |
| VULN-08 | Medium | mcp_server.py | DNS rebinding protection off by default |
| VULN-09 | Low | chain.py | Health endpoint filesystem path leak |
