"""Blackjack-specific Pydantic schemas."""

from __future__ import annotations

from decimal import Decimal
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class CardData(BaseModel):
    """Serialized playing card."""
    suit: str
    rank: str
    face_up: bool
    display: str


class BlackjackStartRequest(BaseModel):
    """Start a new Blackjack hand."""
    bet_amount: Decimal = Field(..., gt=0, decimal_places=2)


class BlackjackActionRequest(BaseModel):
    """Hit, stand, or double down."""
    pass


class BlackjackRoundResponse(BaseModel):
    """Full state of a Blackjack round."""
    round_id: str
    game_type: str = "blackjack"
    player_cards: List[Dict[str, Any]]
    dealer_cards: List[Dict[str, Any]]
    player_score: int
    dealer_score: int
    bet_amount: Decimal
    is_finished: bool
    outcome: Optional[str] = None
    won: Optional[bool] = None
    payout_amount: Optional[Decimal] = None
    player_busted: bool = False
    dealer_busted: bool = False
    player_blackjack: bool = False
    can_split: bool = False
    can_double: bool = False
    insurance_offered: bool = False
    insurance_active: bool = False
    has_split: bool = False
    hand_count: int = 1
    active_hand: int = 0
    message: Optional[str] = None
