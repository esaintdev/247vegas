"""Models for bonus promotions and user bonus tracking."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from enum import Enum as PyEnum
from typing import Optional

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Numeric,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, new_uuid


class BonusType(str, PyEnum):
    """Types of bonus promotions."""

    DEPOSIT_MATCH = "deposit_match"       # e.g. 100% match up to $500
    FREE_SPINS = "free_spins"             # Free spins on slots
    NO_DEPOSIT = "no_deposit"             # Free credit on signup
    CASHBACK = "cashback"                 # % of losses back
    MANUAL = "manual"                     # Manually issued by admin


class BonusStatus(str, PyEnum):
    """Lifecycle of a bonus promotion."""

    DRAFT = "draft"
    ACTIVE = "active"
    EXPIRED = "expired"
    DISABLED = "disabled"


class Bonus(Base, TimestampMixin):
    """A bonus promotion template — defines the rules of a promo."""

    __tablename__ = "bonuses"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=new_uuid
    )
    name: Mapped[str] = mapped_column(
        String(255), nullable=False
    )
    description: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True
    )
    bonus_type: Mapped[BonusType] = mapped_column(
        String(20), nullable=False, index=True
    )
    status: Mapped[BonusStatus] = mapped_column(
        String(20), default=BonusStatus.DRAFT, nullable=False
    )

    # Reward configuration
    match_percent: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(5, 2), nullable=True
    )  # e.g. 100.00 for 100% match
    max_bonus_amount: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(20, 2), nullable=True
    )  # e.g. 500.00
    flat_amount: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(20, 2), nullable=True
    )  # For fixed-value bonuses (no_deposit, manual)
    free_spins_count: Mapped[Optional[int]] = mapped_column(
        nullable=True
    )  # Number of free spins

    # Wagering requirements
    wagering_multiplier: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(5, 2), default=Decimal("1.00"), nullable=True
    )  # e.g. 35x wagering requirement
    max_bet_with_bonus: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(20, 2), nullable=True
    )  # Max bet while bonus is active

    # Schedule
    starts_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    expires_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Targeting
    min_deposit_amount: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(20, 2), nullable=True
    )
    eligible_games: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True
    )  # JSON array of game types, or null for all

    is_repeatable: Mapped[bool] = mapped_column(Boolean, default=False)
    max_claims_per_user: Mapped[Optional[int]] = mapped_column(nullable=True)

    # Relationships
    user_claims = relationship("UserBonus", back_populates="bonus", lazy="dynamic")

    def __repr__(self) -> str:
        return f"<Bonus {self.name} ({self.bonus_type})>"


class UserBonus(Base, TimestampMixin):
    """Tracks a specific user's claim and usage of a bonus."""

    __tablename__ = "user_bonuses"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=new_uuid
    )
    bonus_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("bonuses.id"), nullable=False, index=True
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=False, index=True
    )

    # Award state
    awarded_amount: Mapped[Decimal] = mapped_column(
        Numeric(20, 2), default=Decimal("0.00"), nullable=False
    )
    wagered_amount: Mapped[Decimal] = mapped_column(
        Numeric(20, 2), default=Decimal("0.00"), nullable=False
    )
    required_wager: Mapped[Decimal] = mapped_column(
        Numeric(20, 2), default=Decimal("0.00"), nullable=False
    )
    is_completed: Mapped[bool] = mapped_column(Boolean, default=False)
    is_forfeited: Mapped[bool] = mapped_column(Boolean, default=False)
    completed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Relationships
    bonus = relationship("Bonus", back_populates="user_claims")
    user = relationship("User")

    def __repr__(self) -> str:
        return f"<UserBonus {self.user_id} -> {self.bonus_id}>"
