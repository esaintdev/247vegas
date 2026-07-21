"""Wallet schemas for balance and transaction history."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field


class WalletResponse(BaseModel):
    """Wallet summary returned to the client."""

    id: str
    balance: Decimal
    bonus_balance: Decimal
    locked_amount: Decimal
    available_balance: Decimal
    currency: str
    created_at: datetime

    model_config = {"from_attributes": True}


class TransactionResponse(BaseModel):
    """A single transaction log entry."""

    id: str
    type: str
    status: str
    amount: Decimal
    balance_before: Decimal
    balance_after: Decimal
    reference_id: Optional[str]
    description: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class DepositRequest(BaseModel):
    """Initiate a deposit (payment gateway redirect)."""

    amount: Decimal = Field(..., gt=0, decimal_places=2)
    currency: str = Field(default="USD", max_length=3)


class DepositResponse(BaseModel):
    """Response after initiating a deposit."""

    transaction_id: str
    tx_ref: str
    amount: Decimal
    payment_link: str
    status: str


class WithdrawRequest(BaseModel):
    """Request a withdrawal."""

    amount: Decimal = Field(..., gt=0, decimal_places=2)
    payment_method: str = Field(..., min_length=1)
    bank_code: str = Field(default="", max_length=10)
    account_number: str = Field(default="", max_length=10)
    account_name: str = Field(default="", max_length=200)
