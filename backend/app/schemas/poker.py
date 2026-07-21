"""Texas Hold'em Pydantic schemas."""

from __future__ import annotations

from decimal import Decimal
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class PokerActionRequest(BaseModel):
    action: str = Field(..., pattern="^(deal|showdown|fold)$")
    bet_amount: Decimal = Field(default=Decimal("10.00"), ge=1, decimal_places=2, description="Bet amount for new hands (default $10)")


class PokerRoundResponse(BaseModel):
    round_id: str
    game_type: str = "poker"
    stage: str
    community: List[str]
    player_hand: List[str]
    ai_hand: Optional[List[str]] = None
    player_rank: Optional[str] = None
    ai_rank: Optional[str] = None
    player_score: Optional[int] = None
    ai_score: Optional[int] = None
    outcome: Optional[str] = None
    pot: Optional[str] = None
    is_finished: bool = False
    message: Optional[str] = None
