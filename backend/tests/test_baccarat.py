"""Unit tests for the Baccarat game engine.

Covers: card values, hand values, third-card drawing rules,
natural detection, player/banker/tie bets, banker commission.
"""

from __future__ import annotations

from decimal import Decimal

import pytest

from app.games.baccarat import (
    BaccaratEngine,
    card_value,
    hand_value,
    should_player_draw,
    should_banker_draw,
)


class TestCardFunctions:
    def test_card_value_number(self) -> None:
        assert card_value("2") == 2
        assert card_value("7") == 7
        assert card_value("9") == 9

    def test_card_value_face(self) -> None:
        assert card_value("J") == 0
        assert card_value("Q") == 0
        assert card_value("K") == 0
        assert card_value("10") == 0

    def test_card_value_ace(self) -> None:
        assert card_value("A") == 1


class TestHandValue:
    def test_simple_sum(self) -> None:
        assert hand_value(["2", "3"]) == 5
        assert hand_value(["A", "2"]) == 3
        assert hand_value(["K", "Q"]) == 0

    def test_modulo_10(self) -> None:
        assert hand_value(["7", "8"]) == 5  # 15 → 5
        assert hand_value(["9", "9"]) == 8  # 18 → 8

    def test_baccarat_max(self) -> None:
        assert hand_value(["9", "9", "9"]) == 7  # 27 → 7

    def test_three_card_hand(self) -> None:
        assert hand_value(["A", "2", "3"]) == 6
        assert hand_value(["K", "7", "4"]) == 1  # 0+7+4=11 → 1


class TestPlayerDrawRules:
    def test_player_draws_on_0_to_5(self) -> None:
        for v in range(6):
            assert should_player_draw(v) is True, f"Player should draw on {v}"

    def test_player_stands_on_6_and_7(self) -> None:
        assert should_player_draw(6) is False
        assert should_player_draw(7) is False

    def test_player_natural_no_draw(self) -> None:
        assert should_player_draw(8) is False
        assert should_player_draw(9) is False


class TestBankerDrawRules:
    def test_banker_no_player_third_draws_on_0_to_5(self) -> None:
        for v in range(6):
            assert should_banker_draw(v, None) is True

    def test_banker_no_player_third_stands_on_6(self) -> None:
        assert should_banker_draw(6, None) is False

    # Banker draws when player's 3rd card is specific values
    def test_banker_3_draws_on_not_8(self) -> None:
        assert should_banker_draw(3, 7) is True
        assert should_banker_draw(3, 8) is False  # Player drew 8 → banker skips

    def test_banker_4_draws_on_2_7_excluding_8(self) -> None:
        for third in [2, 3, 4, 5, 6, 7]:
            assert should_banker_draw(4, third) is True
        assert should_banker_draw(4, 8) is False
        assert should_banker_draw(4, 0) is False

    def test_banker_5_draws_on_4_7(self) -> None:
        for third in [4, 5, 6, 7]:
            assert should_banker_draw(5, third) is True
        assert should_banker_draw(5, 3) is False
        assert should_banker_draw(5, 8) is False

    def test_banker_6_draws_on_6_7(self) -> None:
        assert should_banker_draw(6, 6) is True
        assert should_banker_draw(6, 7) is True
        assert should_banker_draw(6, 5) is False

    def test_banker_7_or_more_stands(self) -> None:
        assert should_banker_draw(7, None) is False
        assert should_banker_draw(8, None) is False
        assert should_banker_draw(9, None) is False

    def test_banker_0_to_2_always_draws(self) -> None:
        assert should_banker_draw(0, 5) is True
        assert should_banker_draw(1, 9) is True
        assert should_banker_draw(2, 0) is True


class TestBaccaratEngine:
    @pytest.fixture
    def engine(self) -> BaccaratEngine:
        return BaccaratEngine()

    @pytest.mark.asyncio
    async def test_player_bet_returns_result(self, engine: BaccaratEngine) -> None:
        result = await engine.play("user1", Decimal("10"), {
            "round_id": "ba1", "bet_type": "player",
        })
        assert result.game_type == "baccarat"
        assert result.bet_amount == Decimal("10")

    @pytest.mark.asyncio
    async def test_banker_bet_returns_result(self, engine: BaccaratEngine) -> None:
        result = await engine.play("user1", Decimal("10"), {
            "round_id": "ba2", "bet_type": "banker",
        })
        assert result.game_type == "baccarat"

    @pytest.mark.asyncio
    async def test_tie_bet_returns_result(self, engine: BaccaratEngine) -> None:
        result = await engine.play("user1", Decimal("10"), {
            "round_id": "ba3", "bet_type": "tie",
        })
        assert result.game_type == "baccarat"

    @pytest.mark.asyncio
    async def test_outcome_has_correct_fields(self, engine: BaccaratEngine) -> None:
        result = await engine.play("user1", Decimal("10"), {
            "round_id": "ba4", "bet_type": "player",
        })
        od = result.outcome_data
        assert "outcome" in od
        assert "player_cards" in od
        assert "banker_cards" in od
        assert "player_score" in od
        assert "banker_score" in od
        assert "natural" in od
        assert "bet_type" in od
        assert "payout" in od

    @pytest.mark.asyncio
    async def test_cards_dealt_count(self, engine: BaccaratEngine) -> None:
        result = await engine.play("user1", Decimal("10"), {
            "round_id": "ba5", "bet_type": "player",
        })
        # Player should have at least 2 cards
        assert len(result.outcome_data["player_cards"]) >= 2
        assert len(result.outcome_data["banker_cards"]) >= 2

    @pytest.mark.asyncio
    async def test_scores_are_0_to_9(self, engine: BaccaratEngine) -> None:
        result = await engine.play("user1", Decimal("10"), {
            "round_id": "ba6", "bet_type": "player",
        })
        assert 0 <= result.outcome_data["player_score"] <= 9
        assert 0 <= result.outcome_data["banker_score"] <= 9

    @pytest.mark.asyncio
    async def test_banker_commission(self, engine: BaccaratEngine) -> None:
        """Banker wins should pay 0.95:1 (5% commission)."""
        # We'll run several hands and check if any banker win
        # has the correct commission
        for i in range(20):
            result = await engine.play("user1", Decimal("100"), {
                "round_id": f"ba_comm{i}", "bet_type": "banker",
            })
            if result.outcome_data["outcome"] == "banker" and result.won:
                # Banker bet on banker win — should pay 0.95:1
                expected_payout = Decimal("100") * Decimal("0.95")
                assert result.payout_amount == expected_payout
                return

    @pytest.mark.asyncio
    async def test_tie_payout_8_to_1(self, engine: BaccaratEngine) -> None:
        """Tie bets should pay 8:1."""
        for i in range(30):
            result = await engine.play("user1", Decimal("10"), {
                "round_id": f"ba_tie{i}", "bet_type": "tie",
            })
            if result.outcome_data["outcome"] == "tie" and result.won:
                expected_payout = Decimal("10") * Decimal("8")
                assert result.payout_amount == expected_payout
                return

    @pytest.mark.asyncio
    async def test_player_bet_on_tie_is_push(self, engine: BaccaratEngine) -> None:
        """If tie occurs and player bet on player, it should be a push."""
        for i in range(30):
            result = await engine.play("user1", Decimal("10"), {
                "round_id": f"ba_push{i}", "bet_type": "player",
            })
            if result.outcome_data["outcome"] == "tie":
                # Player bet on player/tie → push, full stake returned
                assert result.won is True
                # Engine returns payout_amount = bet_amount for pushes
                # (the wallet reconciles held bet + payout_amount)
                assert result.payout_amount == Decimal("10")
                return

    @pytest.mark.asyncio
    async def test_validate_bet(self, engine: BaccaratEngine) -> None:
        assert await engine.validate_bet(Decimal("1.00"), {}) is True
        assert await engine.validate_bet(Decimal("0.50"), {}) is False

    @pytest.mark.asyncio
    async def test_natural_detection(self, engine: BaccaratEngine) -> None:
        """Natural (8 or 9 on first 2 cards) should be flagged."""
        for i in range(50):
            result = await engine.play("user1", Decimal("10"), {
                "round_id": f"ba_nat{i}", "bet_type": "player",
            })
            p_score = result.outcome_data["player_score"]
            b_score = result.outcome_data["banker_score"]
            nat = result.outcome_data["natural"]
            if len(result.outcome_data["player_cards"]) == 2 and p_score >= 8:
                assert nat is True
                return
            if len(result.outcome_data["banker_cards"]) == 2 and b_score >= 8:
                assert nat is True
                return

    @pytest.mark.asyncio
    async def test_player_third_card_drawn_correctly(self, engine: BaccaratEngine) -> None:
        """If player draws a third card, it should be recorded."""
        for i in range(30):
            result = await engine.play("user1", Decimal("10"), {
                "round_id": f"ba_third{i}", "bet_type": "player",
            })
            if len(result.outcome_data["player_cards"]) == 3:
                assert result.outcome_data["player_third"] is not None
                return
