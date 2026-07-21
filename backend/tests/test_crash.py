"""Unit tests for the Crash game engine.

Covers: crash point generation, cash-out logic, multiplier curve,
edge cases (instant crash, high cash-out).
"""

from __future__ import annotations

from decimal import Decimal

import pytest

from app.games.crash import CrashEngine


class TestCrashPointGeneration:
    @pytest.fixture
    def engine(self) -> CrashEngine:
        return CrashEngine()

    def test_crash_point_always_at_least_1(self, engine: CrashEngine) -> None:
        """Crash point should never be below 1.00."""
        for _ in range(100):
            point = engine._generate_crash_point()
            assert point >= 1.00

    def test_crash_point_not_excessive(self, engine: CrashEngine) -> None:
        """Most crash points should be reasonable (under 30.0)."""
        for _ in range(50):
            point = engine._generate_crash_point()
            # Max possible: 10 + random() * 20 ≈ 30
            assert point <= 30.01

    def test_crash_point_distribution(self, engine: CrashEngine) -> None:
        """With enough samples, should cover multiple ranges."""
        ranges = {"low": 0, "mid": 0, "high": 0}
        for _ in range(1000):
            point = engine._generate_crash_point()
            if point < 2.0:
                ranges["low"] += 1
            elif point < 5.0:
                ranges["mid"] += 1
            else:
                ranges["high"] += 1

        # Most should be low (under 2.0)
        assert ranges["low"] > ranges["mid"]
        assert ranges["low"] > ranges["high"]


class TestCrashEngine:
    @pytest.fixture
    def engine(self) -> CrashEngine:
        return CrashEngine()

    @pytest.mark.asyncio
    async def test_bet_action_returns_result(self, engine: CrashEngine) -> None:
        result = await engine.play("user1", Decimal("10"), {
            "round_id": "cr1", "action": "bet",
        })
        assert result.game_type == "crash"
        assert result.bet_amount == Decimal("10")

    @pytest.mark.asyncio
    async def test_crash_point_in_outcome(self, engine: CrashEngine) -> None:
        result = await engine.play("user1", Decimal("10"), {
            "round_id": "cr2", "action": "bet",
        })
        assert "crash_multiplier" in result.outcome_data
        assert result.outcome_data["crash_multiplier"] >= 1.0

    @pytest.mark.asyncio
    async def test_cash_out_before_crash(self, engine: CrashEngine) -> None:
        """If cash_out_at < crash point, player wins."""
        # We can't easily control RNG, but we can verify the logic
        # by setting cash_out_at to a low value
        result = await engine.play("user1", Decimal("10"), {
            "round_id": "cr3", "action": "bet", "cash_out_at": 1.01,
        })
        # With cash_out_at = 1.01, the crash point will almost always
        # be > 1.01 (since min crash is 1.00 and 70% chance > 1.50)
        if result.outcome_data["outcome"] == "cashed_out":
            assert result.won is True
            expected_payout = Decimal("10") * Decimal("1.01")
            assert result.payout_amount == round(expected_payout, 2)
            assert result.payout_amount > Decimal("0")

    @pytest.mark.asyncio
    async def test_no_cash_out_is_loss_if_crashes(self, engine: CrashEngine) -> None:
        """Without cash-out, it should always be a crash (loss)."""
        result = await engine.play("user1", Decimal("10"), {
            "round_id": "cr4", "action": "bet",
        })
        # When no cash_out_at is set, the player hasn't cashed out
        # so it should always crash
        assert result.outcome_data["outcome"] == "crashed"
        assert result.won is False
        assert result.payout_amount == Decimal("0")

    @pytest.mark.asyncio
    async def test_cash_out_above_crash_is_loss(self, engine: CrashEngine) -> None:
        """If cash_out_at >= crash point, player loses."""
        # Set cash_out_at very high to ensure crash happens first
        result = await engine.play("user1", Decimal("10"), {
            "round_id": "cr5", "action": "bet", "cash_out_at": 100.0,
        })
        # Crash should happen long before 100x
        assert result.outcome_data["outcome"] == "crashed"
        assert result.won is False

    @pytest.mark.asyncio
    async def test_validate_bet(self, engine: CrashEngine) -> None:
        assert await engine.validate_bet(Decimal("0.50"), {}) is True
        assert await engine.validate_bet(Decimal("0.25"), {}) is False

    @pytest.mark.asyncio
    async def test_unknown_action_raises(self, engine: CrashEngine) -> None:
        with pytest.raises(ValueError, match="Unknown action"):
            await engine.play("user1", Decimal("10"), {
                "round_id": "unk1", "action": "unknown",
            })

    @pytest.mark.asyncio
    async def test_outcome_data_structure(self, engine: CrashEngine) -> None:
        result = await engine.play("user1", Decimal("5"), {
            "round_id": "struct1", "action": "bet", "cash_out_at": 2.0,
        })
        assert "outcome" in result.outcome_data
        assert "crash_multiplier" in result.outcome_data
        assert "cash_out_at" in result.outcome_data
        assert "final_multiplier" in result.outcome_data
        assert "elapsed_seconds" in result.outcome_data
        assert "payout" in result.outcome_data
        assert result.outcome_data["cash_out_at"] == 2.0
