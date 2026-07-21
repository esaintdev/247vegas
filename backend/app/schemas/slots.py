"""Slots-specific Pydantic schemas."""

from __future__ import annotations

from decimal import Decimal
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class SlotsSpinRequest(BaseModel):
    """Spin the slot machine reels."""

    bet_amount: Decimal = Field(..., gt=0, decimal_places=2)
    lines: int = Field(default=10, ge=1, le=10, description="Number of paylines to activate (1-10)")


class PaylineResult(BaseModel):
    """Result of a single payline evaluation."""

    symbol: str
    count: int
    win_amount: str
    positions: List[List[int]]


class SlotsSpinResponse(BaseModel):
    """Full result of a slot machine spin."""

    round_id: str
    game_type: str = "slots"
    grid: List[List[str]]
    symbols: List[List[str]]
    paylines: List[Dict[str, Any]]
    scatter_count: int
    scatter_win: str
    total_win: str
    bet_amount: str
    lines: int
    bet_per_line: str
    won: bool
    message: Optional[str] = None
