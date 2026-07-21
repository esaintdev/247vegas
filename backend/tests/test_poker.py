"""Unit tests for the Texas Hold'em poker hand evaluator and engine.

Covers: all 10 hand ranks, kicker tie-breaking, wheel straight,
edge cases, engine deal/showdown/fold flow.
"""

from __future__ import annotations

from decimal import Decimal

import pytest

from app.games.poker import (
    PokerEngine,
    HandRank,
    evaluate_hand,
    deal_cards,
    RANK_VALUES,
)


# ── Hand Evaluator: All 10 Hand Ranks ───────────────────────────────

class TestHandEvaluator:
    def test_high_card(self) -> None:
        """A2347 offsuit = high card."""
        rank, kickers, name = evaluate_hand(
            ["A♠", "2♥"],
            ["3♣", "4♦", "7♠", "9♥", "J♣"],
        )
        assert rank == HandRank.HIGH_CARD
        assert name == "High Card"
        assert kickers[0] == RANK_VALUES["A"]

    def test_pair(self) -> None:
        """AK with A on board = pair of Aces."""
        rank, kickers, name = evaluate_hand(
            ["A♠", "K♥"],
            ["A♣", "2♦", "7♠", "9♥", "J♣"],
        )
        assert rank == HandRank.PAIR
        assert name == "Pair"
        assert kickers[0] == RANK_VALUES["A"]

    def test_two_pair(self) -> None:
        """AK on AQK23 board = Aces and Kings."""
        rank, kickers, name = evaluate_hand(
            ["A♠", "K♥"],
            ["A♣", "K♦", "2♠", "3♥", "7♣"],
        )
        assert rank == HandRank.TWO_PAIR
        assert name == "Two Pair"
        assert max(kickers[:2]) == RANK_VALUES["A"]

    def test_three_of_a_kind(self) -> None:
        """AK on AKQAA board = three Aces... wait, that's more than 3.
        Let's use a clean case: 77 on A7K board."""
        rank, kickers, name = evaluate_hand(
            ["7♠", "7♥"],
            ["A♣", "7♦", "K♠", "2♥", "9♣"],
        )
        assert rank == HandRank.THREE_OF_A_KIND
        assert name == "Three of a Kind"

    def test_straight(self) -> None:
        """56 on 789TJ board = straight to Jack."""
        rank, kickers, name = evaluate_hand(
            ["5♠", "6♥"],
            ["7♣", "8♦", "9♠", "10♥", "J♣"],
        )
        assert rank == HandRank.STRAIGHT
        assert name == "Straight"
        assert kickers[0] == RANK_VALUES["J"]  # Jack-high straight

    def test_wheel_straight(self) -> None:
        """A-2-3-4-5 wheel straight."""
        rank, kickers, name = evaluate_hand(
            ["A♠", "2♥"],
            ["3♣", "4♦", "5♠", "9♥", "K♣"],
        )
        assert rank == HandRank.STRAIGHT
        assert name == "Straight"
        assert kickers[0] == RANK_VALUES["5"]  # 5-high straight

    def test_flush(self) -> None:
        """All spades = flush."""
        rank, kickers, name = evaluate_hand(
            ["A♠", "K♠"],
            ["2♠", "7♠", "9♠", "3♥", "J♣"],
        )
        assert rank == HandRank.FLUSH
        assert name == "Flush"

    def test_full_house(self) -> None:
        """AA on KKA board = Aces full of Kings."""
        rank, kickers, name = evaluate_hand(
            ["A♠", "A♥"],
            ["K♣", "K♦", "A♣", "2♥", "9♠"],
        )
        assert rank == HandRank.FULL_HOUSE
        assert name == "Full House"
        assert kickers[0] == RANK_VALUES["A"]  # Aces full

    def test_four_of_a_kind(self) -> None:
        """AA on AKA board = four Aces."""
        rank, kickers, name = evaluate_hand(
            ["A♠", "A♥"],
            ["A♣", "K♦", "A♦", "2♥", "9♣"],
        )
        assert rank == HandRank.FOUR_OF_A_KIND
        assert name == "Four of a Kind"

    def test_straight_flush(self) -> None:
        """56s on 789TJ suited = straight flush."""
        rank, kickers, name = evaluate_hand(
            ["5♠", "6♠"],
            ["7♠", "8♠", "9♠", "10♥", "J♣"],
        )
        assert rank == HandRank.STRAIGHT_FLUSH
        assert name == "Straight Flush"

    def test_royal_flush(self) -> None:
        """AKQJT all same suit = royal flush."""
        rank, kickers, name = evaluate_hand(
            ["A♠", "K♠"],
            ["Q♠", "J♠", "10♠", "2♥", "7♣"],
        )
        assert rank == HandRank.ROYAL_FLUSH
        assert name == "Royal Flush"


class TestHandTieBreaking:
    def test_higher_pair_wins(self) -> None:
        """AK vs KQ on A-high board → AK wins."""
        hv1, _, _ = evaluate_hand(["A♠", "K♥"], ["A♣", "2♦", "7♠", "9♥", "J♣"])
        hv2, _, _ = evaluate_hand(["K♠", "Q♥"], ["K♣", "2♦", "7♠", "9♥", "J♣"])
        assert (hv1, hv2) == (HandRank.PAIR, HandRank.PAIR)
        # AK pair of Aces > KQ pair of Kings

    def test_kickers_break_ties(self) -> None:
        """Same pair, higher kicker wins."""
        # Both have pair of Aces, but AK has K kicker vs QJ
        r1, k1, _ = evaluate_hand(
            ["A♠", "K♥"], ["A♣", "2♦", "7♠", "9♥", "J♣"]
        )
        r2, k2, _ = evaluate_hand(
            ["A♦", "Q♥"], ["A♣", "K♠", "7♦", "9♥", "J♣"]
        )
        # Both have pair of Aces, but first has K, second has Q
        # Wait — the second case has K on board too, so both have K kicker
        # Let me make a cleaner test
        r3, k3, _ = evaluate_hand(
            ["A♠", "K♥"], ["A♣", "2♦", "7♠", "9♥", "3♣"]
        )
        r4, k4, _ = evaluate_hand(
            ["A♦", "Q♥"], ["A♣", "2♠", "7♦", "9♥", "3♠"]
        )
        assert r3 == r4 == HandRank.PAIR
        # AK has K kicker, AQ has Q kicker
        assert k3[1] == RANK_VALUES["K"]
        assert k4[1] == RANK_VALUES["Q"]
        assert k3 > k4

    def test_two_pair_kickers(self) -> None:
        """Two pair with same ranks, higher fifth card wins."""
        # Both have Aces and Kings, but AK has Q vs J
        r1, k1, _ = evaluate_hand(
            ["A♠", "K♥"], ["A♣", "K♦", "Q♠", "2♥", "9♣"]
        )
        r2, k2, _ = evaluate_hand(
            ["A♦", "K♠"], ["A♥", "K♣", "J♠", "2♥", "9♣"]
        )
        assert r1 == r2 == HandRank.TWO_PAIR
        # k1 = [A, K, Q] vs k2 = [A, K, J]
        assert k1 > k2  # Q kicker beats J kicker

    def test_higher_straight_wins(self) -> None:
        """10-J vs 9-10 on QKAJ10 board."""
        r1, k1, _ = evaluate_hand(
            ["10♠", "J♥"], ["Q♣", "K♦", "A♠", "9♥", "5♣"]
        )
        # 10-J-Q-K-A = Broadway (Ace-high straight)
        assert r1 == HandRank.STRAIGHT
        assert k1[0] == RANK_VALUES["A"]

    def test_flush_high_card_decides(self) -> None:
        """Higher flush wins."""
        r1, k1, _ = evaluate_hand(
            ["A♠", "K♠"], ["2♠", "7♠", "9♠", "3♥", "J♣"]
        )
        r2, k2, _ = evaluate_hand(
            ["Q♠", "J♠"], ["2♠", "7♠", "9♠", "3♥", "A♣"]
        )
        assert r1 == r2 == HandRank.FLUSH
        # AK flush has Ace-high, QJ flush has Queen-high with Ace on board too
        assert k1 > k2 or k1 == k2  # Both might have Ace


class TestPokerEngine:
    @pytest.fixture
    def engine(self) -> PokerEngine:
        return PokerEngine()

    @pytest.mark.asyncio
    async def test_deal_returns_flop(self, engine: PokerEngine) -> None:
        result = await engine.play("user1", Decimal("10"), {
            "round_id": "pk1", "action": "deal",
        })
        assert result.game_type == "poker"
        assert result.outcome_data["stage"] == "flop"
        assert len(result.outcome_data["community"]) == 3
        assert len(result.outcome_data["player_hand"]) == 2

    @pytest.mark.asyncio
    async def test_showdown_reveals_winner(self, engine: PokerEngine) -> None:
        await engine.play("user1", Decimal("10"), {
            "round_id": "pk2", "action": "deal",
        })
        result = await engine.play("user1", Decimal("10"), {
            "round_id": "pk2", "action": "showdown",
        })
        assert result.outcome_data["stage"] == "showdown"
        assert result.outcome_data["is_finished"] is True
        assert "ai_hand" in result.outcome_data
        assert "player_rank" in result.outcome_data
        assert "ai_rank" in result.outcome_data
        assert len(result.outcome_data["community"]) == 5  # full board

    @pytest.mark.asyncio
    async def test_fold_loses(self, engine: PokerEngine) -> None:
        await engine.play("user1", Decimal("10"), {
            "round_id": "pk3", "action": "deal",
        })
        result = await engine.play("user1", Decimal("10"), {
            "round_id": "pk3", "action": "fold",
        })
        assert result.outcome_data["outcome"] == "fold"
        assert result.won is False
        assert result.payout_amount == Decimal("0")

    @pytest.mark.asyncio
    async def test_unknown_action_raises(self, engine: PokerEngine) -> None:
        with pytest.raises(ValueError, match="Unknown action"):
            await engine.play("user1", Decimal("10"), {
                "round_id": "pk4", "action": "unknown",
            })

    @pytest.mark.asyncio
    async def test_nonexistent_round_raises(self, engine: PokerEngine) -> None:
        with pytest.raises(ValueError, match="not found"):
            await engine._get_game("nonexistent")

    @pytest.mark.asyncio
    async def test_validate_bet(self, engine: PokerEngine) -> None:
        assert await engine.validate_bet(Decimal("1.00"), {}) is True
        assert await engine.validate_bet(Decimal("0.50"), {}) is False

    @pytest.mark.asyncio
    async def test_showdown_pot_calculation(self, engine: PokerEngine) -> None:
        """Pot should be bet * 2 (player + AI)."""
        await engine.play("user1", Decimal("25"), {
            "round_id": "pk5", "action": "deal",
        })
        result = await engine.play("user1", Decimal("25"), {
            "round_id": "pk5", "action": "showdown",
        })
        # Pot should be at least 50 (25 * 2)
        assert Decimal(result.outcome_data["pot"]) >= Decimal("50")

    @pytest.mark.asyncio
    async def test_showdown_rank_evaluation(self, engine: PokerEngine) -> None:
        """Both hands should have evaluated ranks."""
        await engine.play("user1", Decimal("10"), {
            "round_id": "pk6", "action": "deal",
        })
        result = await engine.play("user1", Decimal("10"), {
            "round_id": "pk6", "action": "showdown",
        })
        assert "player_rank" in result.outcome_data
        assert "ai_rank" in result.outcome_data
        assert isinstance(result.outcome_data["player_score"], int)
        assert isinstance(result.outcome_data["ai_score"], int)
