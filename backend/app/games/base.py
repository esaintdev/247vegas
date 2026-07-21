"""Abstract base class for all casino game engines."""

from __future__ import annotations

from abc import ABC, abstractmethod
from decimal import Decimal
from typing import Any, Dict

from pydantic import BaseModel


class GameResult(BaseModel):
    """Standardised result returned by every game engine."""

    round_id: str
    game_type: str
    bet_amount: Decimal
    payout_amount: Decimal
    won: bool
    outcome_data: Dict[str, Any]


class BaseGameEngine(ABC):
    """Abstract game engine that every game must implement."""

    @abstractmethod
    async def play(
        self,
        user_id: str,
        bet_amount: Decimal,
        game_data: Dict[str, Any],
    ) -> GameResult:
        """Execute a single round of the game.

        Args:
            user_id: The player's ID.
            bet_amount: Amount wagered.
            game_data: Game-specific parameters (e.g. chosen numbers, card selection).

        Returns:
            GameResult with outcome and payout.
        """
        ...

    @abstractmethod
    async def validate_bet(self, bet_amount: Decimal, game_data: Dict[str, Any]) -> bool:
        """Validate that the bet and game data are acceptable."""
        ...
