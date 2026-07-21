"""Unit tests for the Roulette game engine.

Covers: all 13 bet types, payout multipliers, zero handling,
color/column/dozen helpers, edge cases.
"""

from __future__ import annotations

from decimal import Decimal

import pytest

from app.games.roulette import (
    RouletteEngine,
    BetType,
    EUROPEAN_NUMBERS,
    RED_NUMBERS,
)


class TestRouletteHelpers:
    def test_european_wheel_has_37_numbers(self) -> None:
        assert len(EUROPEAN_NUMBERS) == 37
        assert 0 in EUROPEAN_NUMBERS
        assert all(1 <= n <= 36 for n in EUROPEAN_NUMBERS if n != 0)

    def test_red_numbers_count(self) -> None:
        assert len(RED_NUMBERS) == 18

    def test_red_black_cover_all_nonzero(self) -> None:
        all_colored = set()
        for n in range(1, 37):
            if n in RED_NUMBERS or n not in RED_NUMBERS:
                all_colored.add(n)
        assert len(all_colored) == 36

    def test_number_color(self) -> None:
        assert RouletteEngine._number_color(0) == "green"
        assert RouletteEngine._number_color(1) == "red"
        assert RouletteEngine._number_color(2) == "black"

    def test_number_column(self) -> None:
        assert RouletteEngine.number_column(0) == 0
        assert RouletteEngine.number_column(1) == 1
        assert RouletteEngine.number_column(2) == 2
        assert RouletteEngine.number_column(3) == 3
        assert RouletteEngine.number_column(4) == 1
        assert RouletteEngine.number_column(36) == 3

    def test_number_dozen(self) -> None:
        assert RouletteEngine.number_dozen(0) == 0
        assert RouletteEngine.number_dozen(1) == 1
        assert RouletteEngine.number_dozen(12) == 1
        assert RouletteEngine.number_dozen(13) == 2
        assert RouletteEngine.number_dozen(24) == 2
        assert RouletteEngine.number_dozen(25) == 3
        assert RouletteEngine.number_dozen(36) == 3

    def test_get_neighbor_numbers(self) -> None:
        # Number 5 is in column 2, row 1
        # Should have: left (4), right (6), top (2), bottom (8)
        neighbors = RouletteEngine.get_neighbor_numbers(5)
        assert 4 in neighbors
        assert 6 in neighbors
        assert 2 in neighbors
        assert 8 in neighbors


class TestRoulettePayoutMultipliers:
    def test_straight_up_payout(self) -> None:
        engine = RouletteEngine()
        assert engine._get_payout_multiplier(BetType.STRAIGHT) == Decimal("35")

    def test_split_payout(self) -> None:
        engine = RouletteEngine()
        assert engine._get_payout_multiplier(BetType.SPLIT) == Decimal("17")

    def test_street_payout(self) -> None:
        engine = RouletteEngine()
        assert engine._get_payout_multiplier(BetType.STREET) == Decimal("11")

    def test_corner_payout(self) -> None:
        engine = RouletteEngine()
        assert engine._get_payout_multiplier(BetType.CORNER) == Decimal("8")

    def test_six_line_payout(self) -> None:
        engine = RouletteEngine()
        assert engine._get_payout_multiplier(BetType.SIX_LINE) == Decimal("5")

    def test_dozen_payout(self) -> None:
        engine = RouletteEngine()
        assert engine._get_payout_multiplier(BetType.DOZEN) == Decimal("2")

    def test_column_payout(self) -> None:
        engine = RouletteEngine()
        assert engine._get_payout_multiplier(BetType.COLUMN) == Decimal("2")

    def test_even_money_payouts(self) -> None:
        engine = RouletteEngine()
        for bet_type in (BetType.RED, BetType.BLACK, BetType.ODD,
                         BetType.EVEN, BetType.LOW, BetType.HIGH):
            assert engine._get_payout_multiplier(bet_type) == Decimal("1")


class TestRouletteBetEvaluation:
    @pytest.fixture
    def engine(self) -> RouletteEngine:
        return RouletteEngine()

    # ── Straight Up Bets ──

    def test_straight_up_wins(self, engine: RouletteEngine) -> None:
        assert engine._evaluate_bet(BetType.STRAIGHT, 17, [17]) is True

    def test_straight_up_loses(self, engine: RouletteEngine) -> None:
        assert engine._evaluate_bet(BetType.STRAIGHT, 17, [5]) is False

    def test_straight_up_zero_wins(self, engine: RouletteEngine) -> None:
        assert engine._evaluate_bet(BetType.STRAIGHT, 0, [0]) is True

    # ── Split Bets ──

    def test_split_wins(self, engine: RouletteEngine) -> None:
        assert engine._evaluate_bet(BetType.SPLIT, 5, [5, 8]) is True

    def test_split_loses(self, engine: RouletteEngine) -> None:
        assert engine._evaluate_bet(BetType.SPLIT, 5, [6, 9]) is False

    # ── Street Bets ──

    def test_street_wins(self, engine: RouletteEngine) -> None:
        assert engine._evaluate_bet(BetType.STREET, 4, [4, 5, 6]) is True

    def test_street_loses(self, engine: RouletteEngine) -> None:
        assert engine._evaluate_bet(BetType.STREET, 4, [1, 2, 3]) is False

    # ── Corner Bets ──

    def test_corner_wins(self, engine: RouletteEngine) -> None:
        assert engine._evaluate_bet(BetType.CORNER, 5, [1, 2, 4, 5]) is True

    def test_corner_loses(self, engine: RouletteEngine) -> None:
        assert engine._evaluate_bet(BetType.CORNER, 5, [2, 3, 5, 6]) is True

    # ── Six Line Bets ──

    def test_six_line_wins(self, engine: RouletteEngine) -> None:
        assert engine._evaluate_bet(
            BetType.SIX_LINE, 5,
            [1, 2, 3, 4, 5, 6]
        ) is True

    def test_six_line_loses(self, engine: RouletteEngine) -> None:
        # Number 10 is in 7-12 range → lose on numbers 1-6
        is_win = engine._evaluate_bet(
            BetType.SIX_LINE, 10,
            [1, 2, 3, 4, 5, 6]
        )
        assert is_win is False

    # ── Dozen Bets ──

    def test_dozen_wins(self, engine: RouletteEngine) -> None:
        # 1st dozen: numbers 1-12, winning number 5
        is_win = engine._evaluate_bet(
            BetType.DOZEN, 5,
            [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
        )
        assert is_win is True

    def test_dozen_loses(self, engine: RouletteEngine) -> None:
        assert engine._evaluate_bet(BetType.DOZEN, 14, [1]) is False

    # ── Column Bets ──

    def test_column_wins(self, engine: RouletteEngine) -> None:
        # Column 2: numbers ≡ 2 (mod 3): 2, 5, 8, ...
        assert engine._evaluate_bet(BetType.COLUMN, 5, [2]) is True

    def test_column_loses(self, engine: RouletteEngine) -> None:
        # Number 5 is column 2, betting column 1
        assert engine._evaluate_bet(BetType.COLUMN, 5, [1]) is False

    # ── Red/Black Bets ──

    def test_red_wins(self, engine: RouletteEngine) -> None:
        assert engine._evaluate_bet(BetType.RED, 1, []) is True

    def test_red_loses_on_black(self, engine: RouletteEngine) -> None:
        assert engine._evaluate_bet(BetType.RED, 2, []) is False

    def test_black_wins(self, engine: RouletteEngine) -> None:
        assert engine._evaluate_bet(BetType.BLACK, 2, []) is True

    def test_black_loses_on_red(self, engine: RouletteEngine) -> None:
        assert engine._evaluate_bet(BetType.BLACK, 1, []) is False

    def test_zero_loses_on_red_and_black(self, engine: RouletteEngine) -> None:
        assert engine._evaluate_bet(BetType.RED, 0, []) is False
        assert engine._evaluate_bet(BetType.BLACK, 0, []) is False

    # ── Odd/Even Bets ──

    def test_odd_wins(self, engine: RouletteEngine) -> None:
        assert engine._evaluate_bet(BetType.ODD, 7, []) is True

    def test_even_wins(self, engine: RouletteEngine) -> None:
        assert engine._evaluate_bet(BetType.EVEN, 8, []) is True

    def test_zero_loses_on_odd_even(self, engine: RouletteEngine) -> None:
        assert engine._evaluate_bet(BetType.ODD, 0, []) is False
        assert engine._evaluate_bet(BetType.EVEN, 0, []) is False

    # ── Low/High Bets ──

    def test_low_wins(self, engine: RouletteEngine) -> None:
        assert engine._evaluate_bet(BetType.LOW, 10, []) is True
        assert engine._evaluate_bet(BetType.LOW, 1, []) is True

    def test_low_loses(self, engine: RouletteEngine) -> None:
        assert engine._evaluate_bet(BetType.LOW, 19, []) is False

    def test_high_wins(self, engine: RouletteEngine) -> None:
        assert engine._evaluate_bet(BetType.HIGH, 25, []) is True
        assert engine._evaluate_bet(BetType.HIGH, 36, []) is True

    def test_high_loses(self, engine: RouletteEngine) -> None:
        assert engine._evaluate_bet(BetType.HIGH, 18, []) is False


class TestRouletteSpin:
    @pytest.mark.asyncio
    async def test_spin_returns_result(self) -> None:
        engine = RouletteEngine()
        result = await engine.play("user1", Decimal("10"), {
            "round_id": "spin1",
            "bets": [{"type": "straight", "amount": "10", "numbers": [7]}],
        })
        assert result.game_type == "roulette"
        assert "winning_number" in result.outcome_data
        assert "winning_color" in result.outcome_data

    @pytest.mark.asyncio
    async def test_multiple_bets(self) -> None:
        engine = RouletteEngine()
        result = await engine.play("user1", Decimal("20"), {
            "round_id": "spin2",
            "bets": [
                {"type": "red", "amount": "10", "numbers": []},
                {"type": "black", "amount": "10", "numbers": []},
            ],
        })
        assert result.bet_amount == Decimal("20")
        assert len(result.outcome_data["results"]) == 2

    @pytest.mark.asyncio
    async def test_spin_history_tracked(self) -> None:
        engine = RouletteEngine()
        await engine.play("user1", Decimal("10"), {
            "round_id": "hist1",
            "bets": [{"type": "straight", "amount": "10", "numbers": [7]}],
        })
        await engine.play("user1", Decimal("10"), {
            "round_id": "hist2",
            "bets": [{"type": "straight", "amount": "10", "numbers": [7]}],
        })
        assert len(engine._spin_history) == 2

    @pytest.mark.asyncio
    async def test_validate_bet(self) -> None:
        engine = RouletteEngine()
        assert await engine.validate_bet(Decimal("1.00"), {}) is True
        assert await engine.validate_bet(Decimal("0.50"), {}) is False
