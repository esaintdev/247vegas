"""Crash game engine — multiplier game, cash out before it crashes.

Supports two-phase flow:
  1. start_round() — generates crash point, caches it, returns pending
  2. cash_out() or resolve_crash() — ends the round
"""

from __future__ import annotations

import random
from decimal import Decimal
from typing import Any, Dict, Optional

from app.games.base import BaseGameEngine, GameResult


class CrashEngine(BaseGameEngine):
    """Crash game — multiplier rises until it randomly crashes.

    Stores pre-generated crash points in memory keyed by round_id.
    """

    def __init__(self) -> None:
        self._crash_points: Dict[str, float] = {}

    async def play(
        self,
        user_id: str,
        bet_amount: Decimal,
        game_data: Dict[str, Any],
    ) -> GameResult:
        """Run a crash round: determine crash point, check cash-out."""
        action = game_data.get("action", "bet")

        if action == "bet" or action == "start":
            return self._start_round(user_id, bet_amount, game_data)
        elif action == "cashout":
            return self._cashout(user_id, bet_amount, game_data)
        raise ValueError(f"Unknown action: {action}")

    async def validate_bet(self, bet_amount: Decimal, game_data: Dict[str, Any]) -> bool:
        return bet_amount >= Decimal("0.50")

    # ── Public helpers ──────────────────────────────────────────────────

    def get_crash_point(self, round_id: str) -> Optional[float]:
        """Retrieve the cached crash point for a round."""
        return self._crash_points.get(round_id)

    def forget_round(self, round_id: str) -> None:
        """Remove a cached crash point."""
        self._crash_points.pop(round_id, None)

    # ── Internal ────────────────────────────────────────────────────────

    def _start_round(
        self, user_id: str, bet_amount: Decimal, game_data: Dict[str, Any]
    ) -> GameResult:
        """Generate a crash point and cache it. Don't resolve yet."""
        crash_multiplier = self._generate_crash_point()
        round_id = game_data.get("round_id", "")
        self._crash_points[round_id] = crash_multiplier

        # Compute elapsed time to reach crash point for animation
        elapsed = self._compute_elapsed(crash_multiplier)

        return GameResult(
            round_id=round_id,
            game_type="crash",
            bet_amount=bet_amount,
            payout_amount=Decimal("0"),
            won=False,  # Not resolved yet
            outcome_data={
                "outcome": "pending",
                "crash_multiplier": float(crash_multiplier),
                "cash_out_at": None,
                "final_multiplier": 1.0,
                "elapsed_seconds": round(elapsed, 1),
            },
        )

    def _cashout(
        self, user_id: str, bet_amount: Decimal, game_data: Dict[str, Any]
    ) -> GameResult:
        """Resolve a round by cashing out at the given multiplier."""
        round_id = game_data.get("round_id", "")
        cash_out_at = game_data.get("cash_out_at")
        crash_multiplier = self._crash_points.get(round_id)

        if crash_multiplier is None:
            raise ValueError("Round not found or already resolved")

        if cash_out_at is None:
            raise ValueError("cash_out_at is required for cashout action")

        # Clean up cached crash point
        self._crash_points.pop(round_id, None)

        if cash_out_at < crash_multiplier:
            # Cashed out before crash — WIN
            payout = bet_amount * Decimal(str(cash_out_at))
            payout = round(payout, 2)
            elapsed = self._compute_elapsed(cash_out_at)
            return GameResult(
                round_id=round_id,
                game_type="crash",
                bet_amount=bet_amount,
                payout_amount=payout,
                won=True,
                outcome_data={
                    "outcome": "cashed_out",
                    "crash_multiplier": float(crash_multiplier),
                    "cash_out_at": float(cash_out_at),
                    "final_multiplier": float(cash_out_at),
                    "elapsed_seconds": round(elapsed, 1),
                    "payout": str(payout),
                },
            )
        else:
            # Too late — crashed
            elapsed = self._compute_elapsed(crash_multiplier)
            return GameResult(
                round_id=round_id,
                game_type="crash",
                bet_amount=bet_amount,
                payout_amount=Decimal("0"),
                won=False,
                outcome_data={
                    "outcome": "crashed",
                    "crash_multiplier": float(crash_multiplier),
                    "cash_out_at": None,
                    "final_multiplier": float(crash_multiplier),
                    "elapsed_seconds": round(elapsed, 1),
                    "payout": "0",
                },
            )

    def _compute_elapsed(self, target_mult: float) -> float:
        """Compute how many seconds it takes to reach a given multiplier."""
        elapsed = 0.0
        while elapsed < 60.0:
            elapsed += 0.1
            current = 1.00 + (elapsed ** 1.4) * 0.15
            if current >= target_mult:
                break
        return elapsed

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
