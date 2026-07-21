"""Crash game Pydantic schemas."""

from __future__ import annotations

from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field


class CrashBetRequest(BaseModel):
    """Place a bet on a crash round."""
    bet_amount: Decimal = Field(..., gt=0, decimal_places=2)
    cash_out_at: Optional[float] = Field(None, gt=1.0, description="Auto cash-out at this multiplier")


class CrashRoundResponse(BaseModel):
    """Result of a crash round."""
    round_id: str
    game_type: str = "crash"
    outcome: str
    crash_multiplier: float
    cash_out_at: Optional[float] = None
    final_multiplier: float
    elapsed_seconds: float
    bet_amount: str
    payout: str
    won: bool
    message: Optional[str] = None
