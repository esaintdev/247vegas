"""Crash game engine — multiplier game, cash out before it crashes."""

from __future__ import annotations

import random
from decimal import Decimal
from typing import Any, Dict

from app.games.base import BaseGameEngine, GameResult


class CrashEngine(BaseGameEngine):
    """Crash game — multiplier rises until it randomly crashes."""

    async def play(
        self,
        user_id: str,
        bet_amount: Decimal,
        game_data: Dict[str, Any],
    ) -> GameResult:
        """Run a crash round: determine crash point, check cash-out."""
        action = game_data.get("action", "bet")

        if action == "bet":
            return self._spin(user_id, bet_amount, game_data)
        raise ValueError(f"Unknown action: {action}")

    async def validate_bet(self, bet_amount: Decimal, game_data: Dict[str, Any]) -> bool:
        return bet_amount >= Decimal("0.50")

    def _spin(self, user_id: str, bet_amount: Decimal, game_data: Dict[str, Any]) -> GameResult:
        """Determine the crash point and whether player cashed out in time."""
        crash_multiplier = self._generate_crash_point()
        cash_out_at = game_data.get("cash_out_at")
        round_id = game_data.get("round_id", "")

        # The crash point is the target — the game ends when multiplier reaches it
        elapsed = 0.0
        current_mult = 1.00

        # Find the elapsed time when multiplier hits the crash point
        while elapsed < 30.0:
            elapsed += 0.1
            current_mult = 1.00 + (elapsed ** 1.4) * 0.15
            if current_mult >= crash_multiplier:
                break

        # Cash-out check
        if cash_out_at and cash_out_at < crash_multiplier:
            # Player cashed out before crash
            payout = bet_amount * Decimal(str(cash_out_at))
            outcome = "cashed_out"
            won = True
            final_mult = cash_out_at
        else:
            # Crashed
            payout = Decimal("0")
            outcome = "crashed"
            won = False
            final_mult = crash_multiplier

        payout = round(payout, 2)

        return GameResult(
            round_id=round_id,
            game_type="crash",
            bet_amount=bet_amount,
            payout_amount=payout,
            won=won,
            outcome_data={
                "outcome": outcome,
                "crash_multiplier": float(crash_multiplier),
                "cash_out_at": float(cash_out_at) if cash_out_at else None,
                "final_multiplier": float(final_mult),
                "elapsed_seconds": round(elapsed, 1),
                "payout": str(payout),
            },
        )

    def _generate_crash_point(self) -> float:
        """Generate a random crash multiplier using weighted distribution."""
        r = random.random()
        if r < 0.3:
            return round(1.00 + random.random() * 0.50, 2)
        elif r < 0.55:
            return round(1.50 + random.random() * 0.50, 2)
        elif r < 0.75:
            return round(2.00 + random.random() * 1.00, 2)
        elif r < 0.88:
            return round(3.00 + random.random() * 2.00, 2)
        elif r < 0.95:
            return round(5.00 + random.random() * 5.00, 2)
        else:
            return round(10.00 + random.random() * 20.00, 2)
