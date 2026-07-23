"""Provably fair service — seed generation, SHA-256 commitment, and result verification.

The protocol:
1. Before a round: generate a random server_seed, commit to it via SHA-256 hash
2. Player may optionally provide their own client_seed
3. Nonce auto-increments per round
4. After the round: reveal the server_seed
5. Anyone can verify: sha256(server_seed + client_seed + nonce) == committed_hash
"""

from __future__ import annotations

import hashlib
import hmac
import os
from typing import Optional

from pydantic import BaseModel


class FairnessVerificationResult(BaseModel):
    """Result of a provably fair verification."""

    round_id: str
    game_type: str
    server_seed: str
    server_seed_hash: str
    client_seed: str
    nonce: int
    is_verified: bool
    message: str


class ProvablyFairService:
    """Generates, commits, and verifies game seeds."""

    @staticmethod
    def generate_server_seed() -> str:
        """Generate a cryptographically random 64-char hex server seed."""
        return os.urandom(32).hex()

    @staticmethod
    def compute_hash(server_seed: str, client_seed: Optional[str] = None, nonce: int = 0) -> str:
        """Compute the SHA-256 commitment hash.

        Uses HMAC-SHA256 where:
        - key = server_seed + client_seed
        - message = str(nonce)
        """
        seed_string = server_seed + (client_seed or "")
        return hmac.new(
            key=seed_string.encode("utf-8"),
            msg=str(nonce).encode("utf-8"),
            digestmod=hashlib.sha256,
        ).hexdigest()

    @staticmethod
    def verify(
        server_seed: str,
        committed_hash: str,
        client_seed: Optional[str] = None,
        nonce: int = 0,
    ) -> bool:
        """Verify that a server_seed matches its committed hash."""
        computed = ProvablyFairService.compute_hash(server_seed, client_seed, nonce)
        return computed == committed_hash

    @staticmethod
    def verify_round(
        round_id: str,
        game_type: str,
        server_seed: str,
        server_seed_hash: str,
        client_seed: Optional[str] = None,
        nonce: int = 0,
    ) -> FairnessVerificationResult:
        """Verify a completed game round's seeds."""
        is_verified = ProvablyFairService.verify(
            server_seed=server_seed,
            committed_hash=server_seed_hash,
            client_seed=client_seed,
            nonce=nonce,
        )

        if is_verified:
            message = (
                "✅ Verified! The server seed matches the committed hash. "
                "The outcome was determined before the round started."
            )
        else:
            message = (
                "❌ Verification FAILED! The server seed does NOT match the committed hash. "
                "This may indicate tampering."
            )

        return FairnessVerificationResult(
            round_id=round_id,
            game_type=game_type,
            server_seed=server_seed,
            server_seed_hash=server_seed_hash,
            client_seed=client_seed or "",
            nonce=nonce,
            is_verified=is_verified,
            message=message,
        )
