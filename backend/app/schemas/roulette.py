"""Roulette-specific Pydantic schemas."""

from __future__ import annotations

from decimal import Decimal
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class RouletteBet(BaseModel):
    """A single bet placed on the roulette table."""

    type: str = Field(..., description="Bet type: straight, split, street, corner, six_line, dozen, column, red, black, odd, even, low, high")
    amount: Decimal = Field(..., gt=0, decimal_places=2)
    numbers: List[int] = Field(
        default_factory=list,
        description="Selected numbers for inside bets (straight=[n], split=[a,b], street=[a,b,c], etc.)",
    )


class RouletteSpinRequest(BaseModel):
    """Place bets and spin the wheel."""

    bets: List[RouletteBet] = Field(..., min_length=1, description="One or more bets to place")


class BetResult(BaseModel):
    """Result of a single bet."""

    type: str
    amount: str
    numbers: List[int]
    won: bool
    payout_multiplier: float
    payout: str


class RouletteSpinResponse(BaseModel):
    """Full result of a roulette spin."""

    round_id: str
    game_type: str = "roulette"
    winning_number: int
    winning_color: str
    results: List[BetResult]
    total_bet: str
    total_payout: str
    net_result: str
    won: bool
    spin_history: List[int]
    message: Optional[str] = None
