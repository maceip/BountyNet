"""Contract tests: Android key attestation HTTP surface on the ASGI stack."""

from __future__ import annotations

import base64
from unittest.mock import MagicMock, patch

import pytest
from cryptography.hazmat.primitives.asymmetric import ec
from starlette.testclient import TestClient

import gateway.routes.android_key_attestation as aka


@pytest.fixture
def asgi_app():
    from gateway.factory import create_asgi_app

    return create_asgi_app()


def test_challenge_returns_nonce_and_challenge_b64(asgi_app):
    with TestClient(asgi_app) as client:
        r = client.post("/attest/android-key/challenge")
    assert r.status_code == 200
    body = r.json()
    assert body.get("nonce")
    assert body.get("challenge_b64")
    raw = base64.b64decode(body["challenge_b64"], validate=True)
    assert len(raw) == 32


def test_verify_requires_nonce_and_chain(asgi_app):
    with TestClient(asgi_app) as client:
        r = client.post("/attest/android-key/verify", json={})
    assert r.status_code == 400
    assert "required" in r.json().get("error", "").lower()


def test_verify_rejects_unknown_nonce(asgi_app):
    with TestClient(asgi_app) as client:
        r = client.post(
            "/attest/android-key/verify",
            json={
                "nonce": "totally-unknown-nonce-token-xyz",
                "cert_chain_b64": ["QUJDRA=="],
            },
        )
    assert r.status_code == 400
    err = r.json().get("error", "")
    assert "nonce" in err.lower() or "unknown" in err.lower() or "expired" in err.lower()


def test_verify_success_with_mocks(asgi_app):
    sk = ec.generate_private_key(ec.SECP256R1())
    leaf = MagicMock()
    leaf.public_key.return_value = sk.public_key()
    root = MagicMock()

    with TestClient(asgi_app) as client:
        ch = client.post("/attest/android-key/challenge")
        assert ch.status_code == 200
        nonce = ch.json()["nonce"]
        expected = base64.b64decode(ch.json()["challenge_b64"], validate=True)

        with (
            patch.object(aka, "_load_chain", return_value=[leaf, root]),
            patch.object(aka, "_google_roots", return_value=[]),
            patch.object(aka, "_verify_chain_signatures", return_value=True),
            patch.object(aka, "_extract_attestation_challenge", return_value=expected),
        ):
            r = client.post(
                "/attest/android-key/verify",
                json={"nonce": nonce, "cert_chain_b64": ["ZGVjYXk=", "ZGVjYW8="]},
            )

    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("verified") is True
    assert body.get("challenge_ok") is True
    assert body.get("leaf_spki_sha256_hex")
    assert len(body["leaf_spki_sha256_hex"]) == 64
    assert body.get("bind_token")
    assert body.get("bind_expires_in") == 600


def test_verify_challenge_mismatch(asgi_app):
    leaf = MagicMock()
    leaf.public_key.return_value = ec.generate_private_key(ec.SECP256R1()).public_key()
    root = MagicMock()

    with TestClient(asgi_app) as client:
        ch = client.post("/attest/android-key/challenge")
        nonce = ch.json()["nonce"]

        with (
            patch.object(aka, "_load_chain", return_value=[leaf, root]),
            patch.object(aka, "_google_roots", return_value=[]),
            patch.object(aka, "_verify_chain_signatures", return_value=True),
            patch.object(aka, "_extract_attestation_challenge", return_value=b"not-the-server-challenge"),
        ):
            r = client.post(
                "/attest/android-key/verify",
                json={"nonce": nonce, "cert_chain_b64": ["Wg==", "WQ=="]},
            )

    assert r.status_code == 400
    assert r.json().get("challenge_ok") is False or "mismatch" in r.json().get("error", "").lower()


def test_verify_nonce_is_single_use(asgi_app):
    sk = ec.generate_private_key(ec.SECP256R1())
    leaf = MagicMock()
    leaf.public_key.return_value = sk.public_key()
    root = MagicMock()

    with TestClient(asgi_app) as client:
        ch = client.post("/attest/android-key/challenge")
        nonce = ch.json()["nonce"]
        expected = base64.b64decode(ch.json()["challenge_b64"], validate=True)

        with (
            patch.object(aka, "_load_chain", return_value=[leaf, root]),
            patch.object(aka, "_google_roots", return_value=[]),
            patch.object(aka, "_verify_chain_signatures", return_value=True),
            patch.object(aka, "_extract_attestation_challenge", return_value=expected),
        ):
            first = client.post(
                "/attest/android-key/verify",
                json={"nonce": nonce, "cert_chain_b64": ["YQ==", "Yg=="]},
            )
            second = client.post(
                "/attest/android-key/verify",
                json={"nonce": nonce, "cert_chain_b64": ["YQ==", "Yg=="]},
            )

    assert first.status_code == 200
    assert second.status_code == 400


def test_bind_attestation_happy_path(asgi_app, monkeypatch):
    from gateway.routes import identity as idmod

    monkeypatch.setattr(
        idmod,
        "verify_dynamic_jwt",
        lambda _t: {"sub": "contract-test-user", "email": "t@example.com"},
    )
    monkeypatch.setattr(
        idmod,
        "resolve_wallet_and_agent",
        lambda _claims: ("0x1111111111111111111111111111111111111111", 99),
    )
    monkeypatch.setattr(
        idmod,
        "get_agent_wallet",
        lambda _aid: "0x1111111111111111111111111111111111111111",
    )
    monkeypatch.setattr(idmod, "eurc_balance", lambda _w: 0.0)
    monkeypatch.setattr(idmod, "native_balance", lambda _w: 0.0)

    from gateway.routes.android_key_attestation import issue_attest_bind_token

    spki = "aa" * 32
    bind_jwt = issue_attest_bind_token(spki)
    with TestClient(asgi_app) as client:
        r = client.post(
            "/identity/android-attestation/bind",
            json={"bind_token": bind_jwt},
            headers={"Authorization": "Bearer test-dynamic-jwt"},
        )
        assert r.status_code == 200, r.text
        out = r.json()
        assert out.get("bound") is True
        assert out.get("agent_id") == 99
        assert out.get("leaf_spki_sha256_hex") == spki

        st = client.get("/identity/99")
    assert st.status_code == 200
    attest = st.json().get("android_attestations") or []
    assert any(x.get("spki_sha256_hex") == spki for x in attest)


def test_bind_token_cannot_be_reused(asgi_app, monkeypatch):
    from gateway.routes import identity as idmod

    monkeypatch.setattr(
        idmod,
        "verify_dynamic_jwt",
        lambda _t: {"sub": "contract-test-user-2"},
    )
    monkeypatch.setattr(
        idmod,
        "resolve_wallet_and_agent",
        lambda _claims: ("0x2222222222222222222222222222222222222222", 42),
    )
    from gateway.routes.android_key_attestation import issue_attest_bind_token

    tok = issue_attest_bind_token("bb" * 32)
    with TestClient(asgi_app) as client:
        first = client.post(
            "/identity/android-attestation/bind",
            json={"bind_token": tok},
            headers={"Authorization": "Bearer a"},
        )
        second = client.post(
            "/identity/android-attestation/bind",
            json={"bind_token": tok},
            headers={"Authorization": "Bearer a"},
        )
    assert first.status_code == 200
    assert second.status_code == 400


def test_bind_rejects_bnet_token(asgi_app):
    with TestClient(asgi_app) as client:
        r = client.post(
            "/identity/android-attestation/bind",
            json={"bind_token": "x"},
            headers={"Authorization": "Bearer bnet_solver_dummy"},
        )
    assert r.status_code == 401
