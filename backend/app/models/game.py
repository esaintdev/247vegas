"""Models for game rounds, bets, and game configuration."""

from __future__ import annotations

from decimal import Decimal
from enum import Enum as PyEnum
from typing import Optional

from sqlalchemy import (
    ForeignKey,
    Numeric,
    String,
    Text,
    Boolean,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, new_uuid


class GameType(str, PyEnum):
    """Available game categories."""

    BLACKJACK = "blackjack"
    ROULETTE = "roulette"
    SLOTS = "slots"
    POKER = "poker"
    BACCARAT = "baccarat"
    CRASH = "crash"


class GameConfig(Base, TimestampMixin):
    """Per-game configuration (min/max bets, RTP, etc.)."""

    __tablename__ = "game_configs"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=new_uuid
    )
    game_type: Mapped[GameType] = mapped_column(
        String(20), unique=True, nullable=False, index=True
    )
    min_bet: Mapped[Decimal] = mapped_column(
        Numeric(20, 2), default=Decimal("1.00"), nullable=False
    )
    max_bet: Mapped[Decimal] = mapped_column(
        Numeric(20, 2), default=Decimal("10000.00"), nullable=False
    )
    default_bet: Mapped[Decimal] = mapped_column(
        Numeric(20, 2), default=Decimal("10.00"), nullable=False
    )
    rtp_adjustment: Mapped[Decimal] = mapped_column(
        Numeric(5, 2), default=Decimal("0.00"), nullable=False
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False
    )

    def __repr__(self) -> str:
        return f"<GameConfig {self.game_type}>"


class RoundStatus(str, PyEnum):
    """Lifecycle of a game round."""

    INITIATED = "initiated"
    PLAYING = "playing"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class GameRound(Base, TimestampMixin):
    """A single round of a casino game."""

    __tablename__ = "game_rounds"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=new_uuid
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=False, index=True
    )
    game_type: Mapped[GameType] = mapped_column(
        String(20), nullable=False, index=True
    )
    status: Mapped[RoundStatus] = mapped_column(
        String(20), default=RoundStatus.INITIATED, nullable=False
    )
    bet_amount: Mapped[Decimal] = mapped_column(
        Numeric(20, 2), default=Decimal("0.00"), nullable=False
    )
    payout_amount: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(20, 2), nullable=True
    )
    outcome_data: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True
    )  # JSON: cards dealt, slot positions, etc.
    # Provably fair seed fields
    seed_hash: Mapped[Optional[str]] = mapped_column(
        String(128), nullable=True
    )  # SHA-256 commitment hash
    server_seed: Mapped[Optional[str]] = mapped_column(
        String(128), nullable=True
    )  # Revealed after round completes
    client_seed: Mapped[Optional[str]] = mapped_column(
        String(128), nullable=True, default=None
    )  # Optional player-provided seed
    nonce: Mapped[int] = mapped_column(
        default=0, nullable=False
    )  # Incrementing nonce
    is_completed: Mapped[bool] = mapped_column(Boolean, default=False)

    def __repr__(self) -> str:
        return f"<GameRound {self.game_type} {self.id[:8]}>"
