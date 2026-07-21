"""Unit tests for the Slot Machine game engine.

Covers: reel spinning, payline evaluation, wild substitution,
scatter payouts, edge cases (all wilds, no matches).
"""

from __future__ import annotations

from decimal import Decimal

import pytest

from app.games.slots import (
    SlotsEngine,
    Symbol,
    SYMBOL_PAYOUTS,
    SCATTER_PAYOUTS,
    PAYLINES,
    REEL_STRIPS,
)


class TestSlotSymbols:
    def test_all_symbols_have_emoji(self) -> None:
        from app.games.slots import SYMBOL_EMOJI
        for symbol in Symbol:
            assert symbol.value in SYMBOL_EMOJI, f"Missing emoji for {symbol}"

    def test_symbol_payouts_have_3_values(self) -> None:
        for sym, payouts in SYMBOL_PAYOUTS.items():
            assert len(payouts) == 3, f"{sym} should have [3x, 4x, 5x]"

    def test_scatter_payouts_length(self) -> None:
        assert len(SCATTER_PAYOUTS) == 6  # 0 through 5 scatters

    def test_scatter_payout_structure(self) -> None:
        assert len(SCATTER_PAYOUTS) == 6
        assert SCATTER_PAYOUTS[0] == 0  # 0 scatters
        assert SCATTER_PAYOUTS[1] == 0  # 1 scatter
        assert SCATTER_PAYOUTS[2] == 5  # 2 scatters


class TestSlotReels:
    def test_5_reels(self) -> None:
        assert len(REEL_STRIPS) == 5

    def test_each_reel_has_24_positions(self) -> None:
        for i, strip in enumerate(REEL_STRIPS):
            assert len(strip) == 24, f"Reel {i} has {len(strip)} positions (need 24)"

    def test_each_reel_has_scatter(self) -> None:
        for i, strip in enumerate(REEL_STRIPS):
            assert Symbol.SCATTER.value in strip, f"Reel {i} missing scatter"

    def test_each_reel_has_wild(self) -> None:
        for i, strip in enumerate(REEL_STRIPS):
            assert Symbol.WILD.value in strip, f"Reel {i} missing wild"


class TestSlotPaylines:
    def test_10_paylines(self) -> None:
        assert len(PAYLINES) == 10

    def test_each_payline_has_5_positions(self) -> None:
        for i, pl in enumerate(PAYLINES):
            assert len(pl) == 5, f"Payline {i} has {len(pl)} positions"

    def test_payline_positions_are_valid(self) -> None:
        for i, pl in enumerate(PAYLINES):
            for row, col in pl:
                assert 0 <= row <= 2, f"Payline {i}: invalid row {row}"
                assert 0 <= col <= 4, f"Payline {i}: invalid col {col}"


class TestSlotsEngine:
    @pytest.fixture
    def engine(self) -> SlotsEngine:
        return SlotsEngine()

    @pytest.mark.asyncio
    async def test_spin_returns_3x5_grid(self, engine: SlotsEngine) -> None:
        result = await engine.play("user1", Decimal("10"), {
            "round_id": "spin1", "lines": 10,
        })
        grid = result.outcome_data["grid"]
        assert len(grid) == 3  # 3 rows
        assert all(len(row) == 5 for row in grid)  # 5 columns

    @pytest.mark.asyncio
    async def test_spin_all_symbols_are_valid(self, engine: SlotsEngine) -> None:
        valid_symbols = {s.value for s in Symbol}
        result = await engine.play("user1", Decimal("10"), {
            "round_id": "spin2", "lines": 10,
        })
        grid = result.outcome_data["grid"]
        for row in grid:
            for sym in row:
                assert sym in valid_symbols, f"Invalid symbol: {sym}"

    @pytest.mark.asyncio
    async def test_bet_per_line_calculation(self, engine: SlotsEngine) -> None:
        result = await engine.play("user1", Decimal("5"), {
            "round_id": "bet1", "lines": 5,
        })
        # bet_per_line = Decimal('5') / Decimal('5') = Decimal('1'), str is '1'
        assert Decimal(result.outcome_data["bet_per_line"]) == Decimal("1")

    @pytest.mark.asyncio
    async def test_reduced_lines_reduces_payout_opportunities(self, engine: SlotsEngine) -> None:
        # With 1 line, only the center row is evaluated
        result_1 = await engine.play("user1", Decimal("10"), {
            "round_id": "line1", "lines": 1,
        })
        result_10 = await engine.play("user1", Decimal("10"), {
            "round_id": "line10", "lines": 10,
        })
        assert len(result_1.outcome_data["paylines"]) <= len(
            result_10.outcome_data["paylines"]
        )

    @pytest.mark.asyncio
    async def test_validate_bet(self, engine: SlotsEngine) -> None:
        assert await engine.validate_bet(Decimal("0.25"), {}) is True
        assert await engine.validate_bet(Decimal("0.10"), {}) is False

    def test_evaluate_payline_no_match(self, engine: SlotsEngine) -> None:
        grid = [
            ["cherry", "lemon", "orange", "plum", "grapes"],
            ["seven", "bell", "bar", "wild", "watermelon"],
            ["cherry", "lemon", "orange", "plum", "grapes"],
        ]
        # Middle row: seven, bell, bar, wild, watermelon — no 3 matching
        result = engine._evaluate_payline(
            grid, [(1, 0), (1, 1), (1, 2), (1, 3), (1, 4)],
            Decimal("1.00")
        )
        assert result["win_amount"] == Decimal("0")

    def test_evaluate_payline_3_in_a_row(self, engine: SlotsEngine) -> None:
        grid = [
            ["cherry", "cherry", "cherry", "plum", "grapes"],
            ["lemon", "orange", "seven", "bell", "bar"],
            ["cherry", "lemon", "orange", "plum", "grapes"],
        ]
        # Top row: 3 cherries
        result = engine._evaluate_payline(
            grid, [(0, 0), (0, 1), (0, 2), (0, 3), (0, 4)],
            Decimal("1.00")
        )
        expected_payout = Decimal(str(SYMBOL_PAYOUTS["cherry"][0]))  # 2x for 3 cherries
        assert result["win_amount"] == expected_payout
        assert result["symbol"] == "cherry"
        assert result["count"] == 3

    def test_evaluate_payline_5_in_a_row(self, engine: SlotsEngine) -> None:
        grid = [
            ["seven", "seven", "seven", "seven", "seven"],
            ["lemon", "orange", "cherry", "bell", "bar"],
            ["cherry", "lemon", "orange", "plum", "grapes"],
        ]
        result = engine._evaluate_payline(
            grid, [(0, 0), (0, 1), (0, 2), (0, 3), (0, 4)],
            Decimal("2.00")
        )
        expected_payout = Decimal(str(SYMBOL_PAYOUTS["seven"][2])) * Decimal("2")  # 100x * 2 bet
        assert result["win_amount"] == expected_payout
        assert result["count"] == 5

    def test_wild_substitution(self, engine: SlotsEngine) -> None:
        """Wilds should substitute for any symbol except scatter."""
        grid = [
            ["cherry", "wild", "cherry", "plum", "grapes"],
            ["lemon", "orange", "seven", "bell", "bar"],
            ["cherry", "lemon", "orange", "plum", "grapes"],
        ]
        result = engine._evaluate_payline(
            grid, [(0, 0), (0, 1), (0, 2), (0, 3), (0, 4)],
            Decimal("1.00")
        )
        # cherry, wild, cherry = 3 cherries (wild substitutes)
        assert result["count"] >= 3
        assert result["symbol"] == "cherry"

    def test_leading_wilds_counted(self, engine: SlotsEngine) -> None:
        """Leading wilds should count toward the streak."""
        grid = [
            ["wild", "wild", "cherry", "cherry", "cherry"],
            ["lemon", "orange", "seven", "bell", "bar"],
            ["cherry", "lemon", "orange", "plum", "grapes"],
        ]
        result = engine._evaluate_payline(
            grid, [(0, 0), (0, 1), (0, 2), (0, 3), (0, 4)],
            Decimal("1.00")
        )
        # wild, wild, cherry, cherry, cherry = 5 consecutive cherries
        assert result["count"] == 5
        assert result["symbol"] == "cherry"

    def test_all_wilds(self, engine: SlotsEngine) -> None:
        """All 5 wilds should pay wild payout."""
        grid = [
            ["wild", "wild", "wild", "wild", "wild"],
            ["lemon", "orange", "seven", "bell", "bar"],
            ["cherry", "lemon", "orange", "plum", "grapes"],
        ]
        result = engine._evaluate_payline(
            grid, [(0, 0), (0, 1), (0, 2), (0, 3), (0, 4)],
            Decimal("1.00")
        )
        expected_payout = Decimal(str(SYMBOL_PAYOUTS["wild"][2]))  # 300x for 5 wilds
        assert result["win_amount"] == expected_payout
        assert result["symbol"] == "wild"

    def test_v_shape_payline_no_match(self, engine: SlotsEngine) -> None:
        """Test that V-shaped paylines don't match when symbols differ."""
        grid = [
            ["cherry", "lemon", "seven", "plum", "cherry"],
            ["lemon", "seven", "grapes", "lemon", "cherry"],
            ["seven", "grapes", "cherry", "plum", "seven"],
        ]
        # V-down: (0,0)=cherry, (1,1)=seven, (2,2)=cherry, (1,3)=lemon, (0,4)=cherry
        # All different → no match
        result = engine._evaluate_payline(
            grid, [(0, 0), (1, 1), (2, 2), (1, 3), (0, 4)],
            Decimal("1.00")
        )
        assert result["win_amount"] == Decimal("0")

    def test_diagonal_payline(self, engine: SlotsEngine) -> None:
        grid = [
            ["bell", "lemon", "lemon", "lemon", "lemon"],
            ["lemon", "bell", "lemon", "lemon", "lemon"],
            ["lemon", "lemon", "bell", "lemon", "lemon"],
        ]
        # Top-left to bottom-right diagonal
        result = engine._evaluate_payline(
            grid, [(0, 0), (1, 1), (2, 2), (1, 3), (0, 4)],
            Decimal("1.00")
        )
        assert result["count"] == 3
        assert result["symbol"] == "bell"

    @pytest.mark.asyncio
    async def test_scatter_payout(self, engine: SlotsEngine) -> None:
        """Scatter should pay regardless of position."""
        # We can't easily control the grid, but we can verify the structure
        result = await engine.play("user1", Decimal("10"), {
            "round_id": "scat1", "lines": 10,
        })
        scatter_count = result.outcome_data["scatter_count"]
        assert 0 <= scatter_count <= 5
        expected_scatter_win = Decimal(str(SCATTER_PAYOUTS[scatter_count])) * Decimal("10")
        assert result.outcome_data["scatter_win"] == str(expected_scatter_win)

    @pytest.mark.asyncio
    async def test_full_spin_output_structure(self, engine: SlotsEngine) -> None:
        result = await engine.play("user1", Decimal("10"), {
            "round_id": "full1", "lines": 10,
        })
        assert "grid" in result.outcome_data
        assert "symbols" in result.outcome_data
        assert "paylines" in result.outcome_data
        assert "scatter_count" in result.outcome_data
        assert "scatter_win" in result.outcome_data
        assert "total_win" in result.outcome_data
        assert "bet_per_line" in result.outcome_data
        assert result.game_type == "slots"
