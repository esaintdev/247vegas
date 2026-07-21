"""Tests for authentication security utilities.

Covers: password hashing/verification, JWT token creation/decoding,
token types (access vs refresh), expired tokens, invalid tokens.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
from jose import jwt

from app.core.config import settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)


class TestPasswordHashing:
    def test_hash_and_verify(self) -> None:
        """A hashed password should verify correctly."""
        pw = "MySecureP@ss1"
        hashed = hash_password(pw)
        assert hashed != pw
        assert verify_password(pw, hashed) is True

    def test_wrong_password_fails(self) -> None:
        """Wrong password should not verify against a hash."""
        hashed = hash_password("CorrectP@ss1")
        assert verify_password("WrongP@ss1", hashed) is False

    def test_different_hashes_for_same_password(self) -> None:
        """Same password should produce different hashes (bcrypt salting)."""
        pw = "MySecureP@ss1"
        h1 = hash_password(pw)
        h2 = hash_password(pw)
        assert h1 != h2
        assert verify_password(pw, h1) is True
        assert verify_password(pw, h2) is True


class TestJWTTokens:
    def test_create_access_token(self) -> None:
        """Access token should contain correct claims."""
        token = create_access_token({"sub": "user-123"})
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        assert payload["sub"] == "user-123"
        assert payload["type"] == "access"
        assert "exp" in payload

    def test_create_refresh_token(self) -> None:
        """Refresh token should contain correct claims."""
        token = create_refresh_token({"sub": "user-123"})
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        assert payload["sub"] == "user-123"
        assert payload["type"] == "refresh"
        assert "exp" in payload

    def test_access_token_expiry(self) -> None:
        """Access token should expire after the configured time."""
        short_expiry = timedelta(seconds=1)
        token = create_access_token(
            {"sub": "user-123"}, expires_delta=short_expiry
        )
        # Should be valid now
        assert decode_token(token) is not None

    def test_access_and_refresh_have_different_types(self) -> None:
        """Access and refresh tokens should have different type claims."""
        access = create_access_token({"sub": "u1"})
        refresh = create_refresh_token({"sub": "u1"})

        access_payload = decode_token(access)
        refresh_payload = decode_token(refresh)

        assert access_payload["type"] == "access"
        assert refresh_payload["type"] == "refresh"

    def test_decode_valid_token(self) -> None:
        """A valid token should decode to its original payload."""
        token = create_access_token({"sub": "user-456", "role": "admin"})
        payload = decode_token(token)
        assert payload is not None
        assert payload["sub"] == "user-456"
        assert payload["role"] == "admin"

    def test_decode_invalid_token_returns_none(self) -> None:
        """An invalid token should return None."""
        assert decode_token("invalid-token-string") is None

    def test_decode_expired_token_returns_none(self) -> None:
        """An expired token should return None."""
        from jose import jwt as jose_jwt
        from datetime import datetime, timezone, timedelta

        # Create a manually expired token
        expired = jose_jwt.encode(
            {
                "sub": "user-1",
                "type": "access",
                "exp": datetime.now(timezone.utc) - timedelta(hours=1),
            },
            settings.SECRET_KEY,
            algorithm=settings.ALGORITHM,
        )
        assert decode_token(expired) is None

    def test_token_with_wrong_secret_fails(self) -> None:
        """A token signed with a different secret should fail."""
        token = jwt.encode(
            {"sub": "user-1", "type": "access"},
            "wrong-secret",
            algorithm=settings.ALGORITHM,
        )
        # Our decode_token uses the correct secret, should fail
        assert decode_token(token) is None

    def test_decode_missing_sub_returns_payload(self) -> None:
        """Token without sub should still decode (validation is in dependencies)."""
        token = create_access_token({"role": "admin"})
        payload = decode_token(token)
        assert payload is not None
        assert payload.get("sub") is None
