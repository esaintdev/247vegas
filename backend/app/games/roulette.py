"""Roulette game engine — European wheel with full bet coverage."""

from __future__ import annotations

import random
from decimal import Decimal
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple

from app.games.base import BaseGameEngine, GameResult


# ── Wheel Layout ─────────────────────────────────────────────────────

EUROPEAN_NUMBERS = [
    0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36,
    11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9,
    22, 18, 29, 7, 28, 12, 35, 3, 26,
]

RED_NUMBERS = {
    1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21,
    23, 25, 27, 30, 32, 34, 36,
}

# Bet type identifiers
class BetType(str, Enum):
    STRAIGHT = "straight"       # Single number (35:1)
    SPLIT = "split"             # Two adjacent numbers (17:1)
    STREET = "street"           # Three in a row (11:1)
    CORNER = "corner"           # Four numbers (8:1)
    SIX_LINE = "six_line"       # Six numbers, two rows (5:1)
    DOZEN = "dozen"             # 1-12, 13-24, 25-36 (2:1)
    COLUMN = "column"           # 1st, 2nd, 3rd column (2:1)
    RED = "red"                 # Red numbers (1:1)
    BLACK = "black"             # Black numbers (1:1)
    ODD = "odd"                 # Odd numbers (1:1)
    EVEN = "even"               # Even numbers (1:1)
    LOW = "low"                 # 1-18 (1:1)
    HIGH = "high"               # 19-36 (1:1)


class RouletteEngine(BaseGameEngine):
    """European roulette engine — single zero, 37 numbers."""

    def __init__(self) -> None:
        self._spin_history: List[int] = []

    async def play(
        self,
        user_id: str,
        bet_amount: Decimal,
        game_data: Dict[str, Any],
    ) -> GameResult:
        """Spin the wheel and resolve all placed bets."""
        return self._spin(game_data.get("round_id", ""), game_data.get("bets", []))

    async def validate_bet(self, bet_amount: Decimal, game_data: Dict[str, Any]) -> bool:
        return bet_amount >= Decimal("1.00")

    def _spin(self, round_id: str, bets: List[Dict[str, Any]]) -> GameResult:
        """Spin the wheel and evaluate all bets."""
        # Determine winning number
        winning_number = random.choice(EUROPEAN_NUMBERS)
        self._spin_history.append(winning_number)
        if len(self._spin_history) > 100:
            self._spin_history = self._spin_history[-100:]

        # Calculate total bet amount placed
        total_bet = sum(
            Decimal(str(b.get("amount", 0)))
            for b in bets
        )

        # Evaluate each bet
        results = []
        total_payout = Decimal("0")
        won_any = False

        for bet in bets:
            bet_type = BetType(bet.get("type", ""))
            amount = Decimal(str(bet.get("amount", 0)))
            numbers = bet.get("numbers", [])
            payout_multiplier = self._get_payout_multiplier(bet_type)

            won = self._evaluate_bet(bet_type, winning_number, numbers)
            payout = amount * payout_multiplier if won else Decimal("0")

            results.append({
                "type": bet_type.value,
                "amount": str(amount),
                "numbers": numbers,
                "won": won,
                "payout_multiplier": float(payout_multiplier),
                "payout": str(payout),
            })

            if won:
                won_any = True
                total_payout += payout

        # Total payout is the sum of winning bets (stake is kept by house)
        # We pass the full payout and deduct losses through the wallet
        net_result = total_payout - total_bet
        is_win = net_result > 0 or (net_result == 0 and total_payout > 0)

        outcome_data = {
            "winning_number": winning_number,
            "winning_color": self._number_color(winning_number),
            "results": results,
            "total_bet": str(total_bet),
            "total_payout": str(total_payout),
            "net_result": str(net_result),
            "spin_history": self._spin_history[-10:],
        }

        # The payout_amount represents the NET win/loss for wallet resolution
        # For win: positive amount (extra gained beyond stake)
        # For loss: negative amount
        payout_amount = total_payout  # Total returned including stake
        if not is_win and total_payout == 0:
            payout_amount = Decimal("0") - total_bet  # All lost

        return GameResult(
            round_id=round_id,
            game_type="roulette",
            bet_amount=total_bet,
            payout_amount=payout_amount,
            won=is_win or total_payout > 0,
            outcome_data=outcome_data,
        )

    def _get_payout_multiplier(self, bet_type: BetType) -> Decimal:
        """Return the payout multiplier for a bet type."""
        multipliers = {
            BetType.STRAIGHT: Decimal("35"),
            BetType.SPLIT: Decimal("17"),
            BetType.STREET: Decimal("11"),
            BetType.CORNER: Decimal("8"),
            BetType.SIX_LINE: Decimal("5"),
            BetType.DOZEN: Decimal("2"),
            BetType.COLUMN: Decimal("2"),
            BetType.RED: Decimal("1"),
            BetType.BLACK: Decimal("1"),
            BetType.ODD: Decimal("1"),
            BetType.EVEN: Decimal("1"),
            BetType.LOW: Decimal("1"),
            BetType.HIGH: Decimal("1"),
        }
        return multipliers.get(bet_type, Decimal("0"))

    def _evaluate_bet(
        self, bet_type: BetType, winning_number: int, numbers: List[int]
    ) -> bool:
        """Check if a bet wins given the winning number."""
        if winning_number == 0:
            # Only straight-up bets on 0 win on zero
            return bet_type == BetType.STRAIGHT and 0 in numbers

        if bet_type == BetType.STRAIGHT:
            return winning_number in numbers
        elif bet_type == BetType.SPLIT:
            return winning_number in numbers
        elif bet_type == BetType.STREET:
            return winning_number in numbers
        elif bet_type == BetType.CORNER:
            return winning_number in numbers
        elif bet_type == BetType.SIX_LINE:
            return winning_number in numbers
        elif bet_type == BetType.DOZEN:
            return winning_number in numbers
        elif bet_type == BetType.COLUMN:
            return self.number_column(winning_number) in numbers
        elif bet_type == BetType.RED:
            return winning_number in RED_NUMBERS
        elif bet_type == BetType.BLACK:
            return winning_number not in RED_NUMBERS and winning_number != 0
        elif bet_type == BetType.ODD:
            return winning_number % 2 == 1
        elif bet_type == BetType.EVEN:
            return winning_number % 2 == 0 and winning_number != 0
        elif bet_type == BetType.LOW:
            return 1 <= winning_number <= 18
        elif bet_type == BetType.HIGH:
            return 19 <= winning_number <= 36

        return False

    @staticmethod
    def _number_color(number: int) -> str:
        """Return the color of a number."""
        if number == 0:
            return "green"
        return "red" if number in RED_NUMBERS else "black"

    @staticmethod
    def number_column(number: int) -> int:
        """Return which column a number belongs to (1, 2, or 3)."""
        if number == 0:
            return 0
        return ((number - 1) % 3) + 1

    @staticmethod
    def number_dozen(number: int) -> int:
        """Return which dozen a number belongs to (1, 2, or 3)."""
        if number == 0:
            return 0
        return ((number - 1) // 12) + 1

    @staticmethod
    def get_neighbor_numbers(number: int) -> List[int]:
        """Get adjacent numbers on the roulette table layout."""
        if number == 0:
            return []
        col = RouletteEngine.number_column(number)
        row = (number - 1) // 3
        neighbors = []

        # Left neighbor
        if col > 1:
            neighbors.append(number - 1)
        # Right neighbor
        if col < 3:
            neighbors.append(number + 1)
        # Bottom neighbor (higher number)
        if row < 11:
            neighbors.append(number + 3)
        # Top neighbor (lower number)
        if row > 0:
            neighbors.append(number - 3)

        return neighbors
