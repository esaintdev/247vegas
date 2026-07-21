"""Baccarat Pydantic schemas."""

from __future__ import annotations

from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel, Field


class BaccaratBetRequest(BaseModel):
    bet_amount: Decimal = Field(..., gt=0, decimal_places=2)
    bet_type: str = Field(..., pattern="^(player|banker|tie)$")


class BaccaratRoundResponse(BaseModel):
    round_id: str
    game_type: str = "baccarat"
    outcome: str
    player_cards: List[str]
    banker_cards: List[str]
    player_score: int
    banker_score: int
    player_third: Optional[str] = None
    banker_third: Optional[str] = None
    natural: bool = False
    bet_type: str
    payout: str
    won: bool
    message: Optional[str] = None
