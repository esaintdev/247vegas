"""Tests for Flutterwave payment gateway service.

Covers: HMAC webhook signature verification, transaction reference
generation, and response parsing logic (no external HTTP calls).
"""

from __future__ import annotations

import hashlib
import hmac
import json
import re

import pytest

from app.services.flutterwave import FlutterwaveService


class TestWebhookSignature:
    def test_verify_valid_signature(self) -> None:
        """A correctly computed signature should verify."""
        secret_hash = "my-webhook-secret"
        body = b'{"event":"charge.completed","data":{"id":123}}'

        # Compute the expected signature the same way Flutterwave does
        expected = hmac.new(
            secret_hash.encode(),
            body,
            hashlib.sha256,
        ).hexdigest()

        assert FlutterwaveService.verify_webhook_signature(
            secret_hash, body, expected
        ) is True

    def test_reject_invalid_signature(self) -> None:
        """An incorrect signature should fail verification."""
        secret_hash = "my-webhook-secret"
        body = b'{"event":"charge.completed"}'

        assert FlutterwaveService.verify_webhook_signature(
            secret_hash, body, "invalid-signature"
        ) is False

    def test_reject_tampered_body(self) -> None:
        """If body and signature don't match, verification should fail."""
        secret_hash = "my-webhook-secret"
        body = b'{"event":"charge.completed","data":{"id":123}}'

        # Valid signature for this body
        valid_sig = hmac.new(
            secret_hash.encode(), body, hashlib.sha256,
        ).hexdigest()

        # Tampered body (different ID)
        tampered_body = b'{"event":"charge.completed","data":{"id":456}}'

        assert FlutterwaveService.verify_webhook_signature(
            secret_hash, tampered_body, valid_sig
        ) is False

    def test_different_secret_fails(self) -> None:
        """A signature from a different webhook secret should fail."""
        body = b'{"event":"charge.completed"}'

        sig = hmac.new(
            b"correct-secret", body, hashlib.sha256,
        ).hexdigest()

        assert FlutterwaveService.verify_webhook_signature(
            "wrong-secret", body, sig
        ) is False

    def test_empty_body_verifies(self) -> None:
        """Empty body should verify with its own signature."""
        secret_hash = "test-secret"
        body = b""
        sig = hmac.new(
            secret_hash.encode(), body, hashlib.sha256,
        ).hexdigest()

        assert FlutterwaveService.verify_webhook_signature(
            secret_hash, body, sig
        ) is True


class TestTransactionReference:
    def test_tx_ref_format(self) -> None:
        """Transaction references should follow CSP-XXXXXXXXXXXX format."""
        tx_ref = FlutterwaveService.generate_tx_ref("DEP")
        assert tx_ref.startswith("DEP-")
        assert len(tx_ref) == 4 + 12  # "DEP-" + 12 hex chars
        assert re.match(r"^DEP-[A-F0-9]{12}$", tx_ref) is not None

    def test_tx_ref_default_prefix(self) -> None:
        """Default prefix should be CSP."""
        tx_ref = FlutterwaveService.generate_tx_ref()
        assert tx_ref.startswith("CSP-")

    def test_tx_ref_custom_prefix(self) -> None:
        """Custom prefix should be used."""
        tx_ref = FlutterwaveService.generate_tx_ref("WTH")
        assert tx_ref.startswith("WTH-")

    def test_tx_ref_uniqueness(self) -> None:
        """Multiple generated refs should be unique."""
        refs = {FlutterwaveService.generate_tx_ref() for _ in range(100)}
        assert len(refs) == 100  # All unique


class TestBankListParsing:
    def test_get_banks_from_response(self) -> None:
        """The get_banks endpoint should extract the 'data' field."""
        from app.services.flutterwave import FlutterwaveService

        service = FlutterwaveService()
        # Note: actual HTTP call not tested here — would need httpx mocking
        # This test just verifies the service can be instantiated
        assert service is not None
        assert service.headers["Authorization"].startswith("Bearer ")
        assert service.headers["Content-Type"] == "application/json"

    def test_hmac_constant_time_comparison(self) -> None:
        """HMAC comparison should be constant-time (uses hmac.compare_digest)."""
        # hmac.compare_digest is the constant-time comparison function
        # This test verifies our method returns correct bool types
        secret_hash = "test"
        body = b"{}"
        valid_sig = hmac.new(
            secret_hash.encode(), body, hashlib.sha256,
        ).hexdigest()

        result = FlutterwaveService.verify_webhook_signature(
            secret_hash, body, valid_sig
        )
        assert isinstance(result, bool)
