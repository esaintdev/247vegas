"""Game schemas for rounds, bets, and results."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, Optional

from pydantic import BaseModel, Field


class GameRoundResponse(BaseModel):
    """Summary of a completed or active game round."""

    id: str
    game_type: str
    status: str
    bet_amount: Decimal
    payout_amount: Optional[Decimal]
    outcome_data: Optional[Dict[str, Any]]
    created_at: datetime

    model_config = {"from_attributes": True}


class PlaceBetRequest(BaseModel):
    """Payload to place a bet on a game."""

    game_type: str = Field(..., min_length=1, max_length=20)
    bet_amount: Decimal = Field(..., gt=0, decimal_places=2)
    game_data: Optional[Dict[str, Any]] = Field(
        None, description="Game-specific parameters (e.g. chosen numbers)"
    )


class BetResponse(BaseModel):
    """Response after placing a bet."""

    round_id: str
    game_type: str
    bet_amount: Decimal
    status: str
    created_at: datetime
