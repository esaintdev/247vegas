"""Flutterwave payment gateway integration.

Uses Flutterwave v3 API for:
- Deposits: Initiate payment → user pays on Flutterwave → webhook confirms → wallet credited
- Withdrawals: Initiate transfer → webhook confirms → wallet debited
"""

from __future__ import annotations

import hashlib
import hmac
import json
from decimal import Decimal
from typing import Any, Dict, Optional

import httpx

from app.core.config import settings

FLW_BASE = "https://api.flutterwave.com/v3"


class FlutterwaveService:
    """Service for interacting with Flutterwave payment gateway."""

    def __init__(self) -> None:
        self.secret_key = settings.FLUTTERWAVE_SECRET_KEY
        self.webhook_hash = settings.FLUTTERWAVE_WEBHOOK_HASH
        self.headers = {
            "Authorization": f"Bearer {self.secret_key}",
            "Content-Type": "application/json",
        }

    async def initiate_deposit(
        self,
        amount: Decimal,
        currency: str,
        email: str,
        tx_ref: str,
        redirect_url: str,
        username: str = "",
    ) -> Dict[str, Any]:
        """Create a payment link for the user to pay via Flutterwave.

        Returns the Flutterwave payment response containing a redirect link.
        """
        payload = {
            "tx_ref": tx_ref,
            "amount": str(amount),
            "currency": currency,
            "redirect_url": redirect_url,
            "customer": {
                "email": email,
                "name": username or email,
            },
            "customizations": {
                "title": "Casino Platform Deposit",
                "description": f"Deposit of {currency} {amount}",
                "logo": "https://casino-platform.com/logo.png",
            },
            "meta": {
                "source": "casino_platform",
                "tx_ref": tx_ref,
            },
        }

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{FLW_BASE}/payments",
                json=payload,
                headers=self.headers,
                timeout=30,
            )
            response.raise_for_status()
            return response.json()

    async def verify_transaction(self, transaction_id: str) -> Dict[str, Any]:
        """Verify a transaction status from Flutterwave.

        Should be called on the redirect callback and NEVER trusted
        without verification.
        """
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{FLW_BASE}/transactions/{transaction_id}/verify",
                headers=self.headers,
                timeout=15,
            )
            response.raise_for_status()
            return response.json()

    async def initiate_withdrawal(
        self,
        amount: Decimal,
        currency: str,
        bank_code: str,
        account_number: str,
        account_name: str,
        narration: str,
        reference: str,
    ) -> Dict[str, Any]:
        """Initiate a bank transfer withdrawal via Flutterwave."""
        payload = {
            "account_bank": bank_code,
            "account_number": account_number,
            "amount": str(amount),
            "currency": currency,
            "narration": narration,
            "reference": reference,
            "debit_currency": currency,
        }

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{FLW_BASE}/transfers",
                json=payload,
                headers=self.headers,
                timeout=30,
            )
            response.raise_for_status()
            return response.json()

    async def get_banks(self, country: str = "NG") -> list[Dict[str, Any]]:
        """Get list of banks for a given country."""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{FLW_BASE}/banks/{country}",
                headers=self.headers,
                timeout=15,
            )
            response.raise_for_status()
            data = response.json()
            return data.get("data", [])

    @staticmethod
    def verify_webhook_signature(
        secret_hash: str, body: bytes, signature_header: str
    ) -> bool:
        """Verify that a webhook request originated from Flutterwave.

        Flutterwave sends X-Flutterwave-Signature header containing
        an HMAC-SHA256 of the raw request body using your webhook hash.
        """
        expected = hmac.new(
            secret_hash.encode(),
            body,
            hashlib.sha256,
        ).hexdigest()
        return hmac.compare_digest(expected, signature_header)

    @staticmethod
    def generate_tx_ref(prefix: str = "CSP") -> str:
        """Generate a unique transaction reference for Flutterwave."""
        import uuid
        return f"{prefix}-{uuid.uuid4().hex[:12].upper()}"
