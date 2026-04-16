# Auth Verifier Adapter (Local Dev)

Local verifier adapter service for BountyNet auth factors.

## Contract

`POST /verify`

Request JSON:

```json
{
  "factor_type": "wallet_eth|wallet_sol|wallet_btc|passkey|nfc_euid",
  "challenge_id": "chal_...",
  "nonce": "nonce-from-auth-challenge",
  "challenge_payload": {},
  "request_payload": {
    "identifier": "factor-specific identifier",
    "proof": "optional dev proof",
    "signature": "optional eth signature"
  }
}
```

Response JSON:

```json
{
  "ok": true,
  "identifier": "normalized-identifier",
  "aal": 2,
  "metadata": {
    "verification_mode": "adapter_dev_secret"
  }
}
```

## Modes

- **ETH native sample**: if `signature` is present and `eth_account` is available, attempts Ethereum message recovery.
- **Generic sample for all factors**: verifies deterministic dev proof:
  - `sha256(<dev_secret>:<factor_type>:<challenge_id>:<nonce>:<identifier>)`

## Run locally

```bash
python services/auth-verifier/adapter_service.py
```

Optional environment:

- `BOUNTYNET_AUTH_ADAPTER_DEV_SECRET` (default: `adapter-dev-secret`)
- `BOUNTYNET_AUTH_ADAPTER_HOST` (default: `127.0.0.1`)
- `BOUNTYNET_AUTH_ADAPTER_PORT` (default: `8099`)

## Wire gateway to adapter

Set one or more in gateway env:

- `BOUNTYNET_AUTH_PASSKEY_VERIFY_URL`
- `BOUNTYNET_AUTH_SOL_VERIFY_URL`
- `BOUNTYNET_AUTH_BTC_VERIFY_URL`
- `BOUNTYNET_AUTH_NFC_VERIFY_URL`
- `BOUNTYNET_AUTH_ETH_VERIFY_URL`

Example:

```bash
export BOUNTYNET_AUTH_SOL_VERIFY_URL=http://127.0.0.1:8099/verify
```
