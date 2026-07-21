"""Slot machine engine — 5-reel, 3-row, 10-payline classic slots."""

from __future__ import annotations

import random
from decimal import Decimal
from enum import Enum
from typing import Any, Dict, List, Tuple

from app.games.base import BaseGameEngine, GameResult


# ── Symbols ──────────────────────────────────────────────────────────

class Symbol(str, Enum):
    CHERRY = "cherry"         # ♥  Low value
    LEMON = "lemon"           # 🍋 Low value
    ORANGE = "orange"         # 🍊 Low value
    PLUM = "plum"             # 🫐 Low value
    GRAPES = "grapes"         # 🍇 Mid value
    WATERMELON = "watermelon" # 🍉 Mid value
    SEVEN = "seven"           # 7️⃣ High value
    BAR = "bar"               # 💠 High value
    BELL = "bell"             # 🔔 High value
    WILD = "wild"             # ⭐ Wild - substitutes all except scatter
    SCATTER = "scatter"       # 💎 Bonus trigger


SYMBOL_EMOJI: Dict[str, str] = {
    "cherry": "♥", "lemon": "🍋", "orange": "🍊", "plum": "🫐",
    "grapes": "🍇", "watermelon": "🍉", "seven": "7️⃣",
    "bar": "💠", "bell": "🔔", "wild": "⭐", "scatter": "💎",
}

SYMBOL_COLORS: Dict[str, str] = {
    "cherry": "text-red-400", "lemon": "text-yellow-400", "orange": "text-orange-400",
    "plum": "text-purple-400", "grapes": "text-violet-400", "watermelon": "text-green-400",
    "seven": "text-red-500", "bar": "text-blue-400", "bell": "text-yellow-300",
    "wild": "text-amber-300", "scatter": "text-cyan-300",
}

# Payouts: [3x, 4x, 5x] multiplier per line bet
SYMBOL_PAYOUTS: Dict[str, List[int]] = {
    "cherry":     [2, 5, 20],
    "lemon":      [2, 5, 20],
    "orange":     [3, 8, 30],
    "plum":       [3, 8, 30],
    "grapes":     [5, 15, 50],
    "watermelon": [5, 15, 50],
    "seven":      [10, 30, 100],
    "bar":        [15, 40, 150],
    "bell":       [20, 50, 200],
    "wild":       [25, 75, 300],
}

SCATTER_PAYOUTS: List[int] = [0, 0, 5, 20, 100, 500]  # 0,1,2,3,4,5 scatters


# ── Reel Strips (weighted) ──────────────────────────────────────────

REEL_STRIPS = [
    # Reel 1
    ["cherry", "lemon", "plum", "cherry", "orange", "grapes",
     "cherry", "seven", "lemon", "cherry", "plum", "watermelon",
     "orange", "cherry", "bell", "lemon", "bar", "cherry",
     "grapes", "lemon", "wild", "orange", "plum", "scatter"],
    # Reel 2
    ["lemon", "cherry", "orange", "plum", "cherry", "grapes",
     "lemon", "bell", "cherry", "plum", "orange", "watermelon",
     "cherry", "lemon", "seven", "plum", "cherry", "bar",
     "orange", "cherry", "wild", "grapes", "lemon", "scatter"],
    # Reel 3
    ["plum", "cherry", "lemon", "orange", "cherry", "watermelon",
     "plum", "bell", "cherry", "grapes", "lemon", "cherry",
     "orange", "seven", "plum", "cherry", "bar", "lemon",
     "grapes", "cherry", "wild", "orange", "plum", "scatter"],
    # Reel 4
    ["orange", "cherry", "lemon", "plum", "cherry", "grapes",
     "orange", "seven", "cherry", "lemon", "watermelon", "cherry",
     "plum", "cherry", "bell", "orange", "bar", "cherry",
     "lemon", "cherry", "wild", "plum", "orange", "scatter"],
    # Reel 5
    ["cherry", "lemon", "orange", "cherry", "plum", "grapes",
     "cherry", "bell", "lemon", "cherry", "orange", "watermelon",
     "plum", "cherry", "seven", "lemon", "bar", "cherry",
     "orange", "cherry", "wild", "plum", "lemon", "scatter"],
]


# ── Paylines ─────────────────────────────────────────────────────────

# Each payline is a list of 5 (row, col) positions, one per reel
PAYLINES: List[List[Tuple[int, int]]] = [
    # 3 horizontal lines
    [(1, 0), (1, 1), (1, 2), (1, 3), (1, 4)],  # Middle row
    [(0, 0), (0, 1), (0, 2), (0, 3), (0, 4)],  # Top row
    [(2, 0), (2, 1), (2, 2), (2, 3), (2, 4)],  # Bottom row
    # 4 V-shaped lines
    [(0, 0), (1, 1), (2, 2), (1, 3), (0, 4)],  # V down
    [(2, 0), (1, 1), (0, 2), (1, 3), (2, 4)],  # V up
    [(1, 0), (0, 1), (1, 2), (0, 3), (1, 4)],  # Zigzag
    [(1, 0), (2, 1), (1, 2), (2, 3), (1, 4)],  # Zigzag reverse
    # 3 more diagonal lines
    [(0, 0), (0, 1), (1, 2), (2, 3), (2, 4)],  # Diagonal
    [(2, 0), (2, 1), (1, 2), (0, 3), (0, 4)],  # Diagonal reverse
    [(0, 0), (1, 1), (1, 2), (1, 3), (2, 4)],  # Pattern
]


# ── Engine ───────────────────────────────────────────────────────────

class SlotsEngine(BaseGameEngine):
    """5-reel, 3-row slot machine with 10 fixed paylines."""

    def __init__(self) -> None:
        self._reel_positions: List[int] = [0, 0, 0, 0, 0]

    async def play(
        self,
        user_id: str,
        bet_amount: Decimal,
        game_data: Dict[str, Any],
    ) -> GameResult:
        """Spin the reels and calculate wins."""
        lines = game_data.get("lines", 10)
        bet_per_line = bet_amount / Decimal(str(lines))

        # Spin each reel
        grid = self._spin_reels()

        # Evaluate all paylines
        payline_results = []
        total_win = Decimal("0")

        for pl_idx in range(lines):
            pl = PAYLINES[pl_idx]
            result = self._evaluate_payline(grid, pl, bet_per_line)
            if result["win_amount"] > 0:
                payline_results.append(result)
                total_win += result["win_amount"]

        # Check scatter wins
        scatter_count = sum(
            1 for row in grid for sym in row if sym == Symbol.SCATTER.value
        )
        scatter_win = Decimal(str(SCATTER_PAYOUTS[scatter_count])) * bet_amount
        if scatter_win > 0:
            total_win += scatter_win

        won = total_win > 0

        outcome_data = {
            "grid": grid,
            "symbols": [[SYMBOL_EMOJI.get(s, s) for s in row] for row in grid],
            "paylines": payline_results,
            "scatter_count": scatter_count,
            "scatter_win": str(scatter_win),
            "total_win": str(total_win),
            "bet_amount": str(bet_amount),
            "lines": lines,
            "bet_per_line": str(bet_per_line),
        }

        return GameResult(
            round_id=game_data.get("round_id", ""),
            game_type="slots",
            bet_amount=bet_amount,
            payout_amount=total_win,
            won=won,
            outcome_data=outcome_data,
        )

    async def validate_bet(self, bet_amount: Decimal, game_data: Dict[str, Any]) -> bool:
        return bet_amount >= Decimal("0.25")

    def _spin_reels(self) -> List[List[str]]:
        """Spin all 5 reels and return a 3x5 grid of symbols."""
        grid: List[List[str]] = []
        for reel_idx, strip in enumerate(REEL_STRIPS):
            # Pick a random starting position
            pos = random.randint(0, len(strip) - 1)
            self._reel_positions[reel_idx] = pos

            # Get 3 consecutive symbols (with wrap-around)
            reel_symbols = []
            for row in range(3):
                idx = (pos + row) % len(strip)
                reel_symbols.append(strip[idx])
            grid.append(reel_symbols)

        # Transpose from 5x3 to 3x5 (rows x columns)
        return [
            [grid[col][row] for col in range(5)]
            for row in range(3)
        ]

    def _evaluate_payline(
        self, grid: List[List[str]], payline: List[Tuple[int, int]], bet_per_line: Decimal
    ) -> Dict[str, Any]:
        """Evaluate a single payline for matching symbols."""
        symbols = [grid[r][c] for r, c in payline]

        base_symbol: str | None = None
        consecutive = 0

        for sym in symbols:
            if base_symbol is None:
                # Haven't found a base symbol yet
                if sym == Symbol.WILD.value:
                    # Wild counts toward streak but doesn't set base yet
                    consecutive += 1
                    continue
                else:
                    # Found our base symbol
                    base_symbol = sym
                    consecutive += 1
            else:
                # Already have a base symbol
                if sym == base_symbol or sym == Symbol.WILD.value:
                    consecutive += 1
                else:
                    break

        # All wilds case
        if base_symbol is None and consecutive == len(symbols):
            base_symbol = Symbol.WILD.value

        # Need at least 3 consecutive
        if consecutive < 3 or base_symbol is None:
            return {
                "payline_index": payline,
                "symbol": base_symbol or "",
                "count": consecutive,
                "win_amount": Decimal("0"),
                "positions": [],
            }

        # Calculate payout
        payout_mult = SYMBOL_PAYOUTS.get(base_symbol, [0, 0, 0])
        payout_idx = min(consecutive, 5) - 3  # 3→0, 4→1, 5→2
        win_amount = bet_per_line * Decimal(str(payout_mult[payout_idx]))

        return {
            "payline_index": payline,
            "symbol": base_symbol,
            "count": consecutive,
            "win_amount": win_amount,
            "positions": [p for p in payline[:consecutive]],
        }
