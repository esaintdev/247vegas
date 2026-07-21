"""Wallet and Transaction models for the financial ledger."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from decimal import Decimal
from enum import Enum as PyEnum
from typing import Optional

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, new_uuid


class TransactionType(str, PyEnum):
    """Categorisation of financial transactions."""

    DEPOSIT = "deposit"
    WITHDRAWAL = "withdrawal"
    BET = "bet"
    WIN = "win"
    REFUND = "refund"
    BONUS = "bonus"
    ADJUSTMENT = "adjustment"


class TransactionStatus(str, PyEnum):
    """Status of a financial transaction."""

    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    HOLD = "hold"  # Bet placed, awaiting resolution


class Wallet(Base, TimestampMixin):
    """Player wallet — holds the current available balance."""

    __tablename__ = "wallets"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=new_uuid
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), unique=True, nullable=False
    )
    balance: Mapped[Decimal] = mapped_column(
        Numeric(20, 2), default=Decimal("0.00"), nullable=False
    )
    bonus_balance: Mapped[Decimal] = mapped_column(
        Numeric(20, 2), default=Decimal("0.00"), nullable=False
    )
    locked_amount: Mapped[Decimal] = mapped_column(
        Numeric(20, 2), default=Decimal("0.00"), nullable=False
    )
    currency: Mapped[str] = mapped_column(
        String(3), default="USD", nullable=False
    )
    is_active: Mapped[bool] = mapped_column(default=True)

    # Relationships
    user = relationship("User", back_populates="wallet")
    transactions = relationship("Transaction", back_populates="wallet", lazy="dynamic")

    __table_args__ = (
        CheckConstraint("balance >= 0", name="wallet_balance_non_negative"),
    )

    @property
    def available_balance(self) -> Decimal:
        """Balance minus locked funds."""
        return self.balance - self.locked_amount

    def __repr__(self) -> str:
        return f"<Wallet {self.user_id}: {self.balance} {self.currency}>"


class Transaction(Base, TimestampMixin):
    """Immutable transaction log — event sourcing for the wallet."""

    __tablename__ = "transactions"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=new_uuid
    )
    wallet_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("wallets.id"), nullable=False, index=True
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=False, index=True
    )
    type: Mapped[TransactionType] = mapped_column(
        String(20), nullable=False
    )
    status: Mapped[TransactionStatus] = mapped_column(
        String(20), default=TransactionStatus.COMPLETED, nullable=False
    )
    amount: Mapped[Decimal] = mapped_column(
        Numeric(20, 2), nullable=False
    )
    balance_before: Mapped[Decimal] = mapped_column(
        Numeric(20, 2), nullable=False
    )
    balance_after: Mapped[Decimal] = mapped_column(
        Numeric(20, 2), nullable=False
    )
    reference_id: Mapped[Optional[str]] = mapped_column(
        String(255), nullable=True, index=True
    )  # External payment ref or game round ID
    description: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True
    )
    metadata_json: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True
    )  # JSON blob for extra context

    # Relationships
    wallet = relationship("Wallet", back_populates="transactions")
    user = relationship("User", back_populates="transactions")
