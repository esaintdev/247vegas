"""Texas Hold'em poker — hand evaluator, AI opponent, single-player vs dealer."""

from __future__ import annotations

import random
from decimal import Decimal
from enum import IntEnum
from typing import Any, Dict, List, Tuple

from app.games.base import BaseGameEngine, GameResult

RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"]
SUITS = ["♠", "♥", "♣", "♦"]

RANK_VALUES = {r: i for i, r in enumerate(RANKS)}


class HandRank(IntEnum):
    HIGH_CARD = 0
    PAIR = 1
    TWO_PAIR = 2
    THREE_OF_A_KIND = 3
    STRAIGHT = 4
    FLUSH = 5
    FULL_HOUSE = 6
    FOUR_OF_A_KIND = 7
    STRAIGHT_FLUSH = 8
    ROYAL_FLUSH = 9


def evaluate_hand(hole: List[str], community: List[str]) -> Tuple[HandRank, List[int], str]:
    """Evaluate the best 5-card hand from 7 cards."""
    all_cards = hole + community
    best_rank = HandRank.HIGH_CARD
    best_kickers: List[int] = []
    best_name = ""

    from itertools import combinations
    for combo in combinations(all_cards, 5):
        rank, kickers, name = _evaluate_5(combo)
        if rank > best_rank or (rank == best_rank and kickers > best_kickers):
            best_rank, best_kickers, best_name = rank, kickers, name

    return best_rank, best_kickers, best_name


def _parse(card: str) -> Tuple[str, str]:
    if card.startswith("10"):
        return "10", card[2:]
    return card[0], card[1:]


def _evaluate_5(cards: Tuple[str, ...]) -> Tuple[HandRank, List[int], str]:
    ranks = sorted([RANK_VALUES[_parse(c)[0]] for c in cards], reverse=True)
    suits = [_parse(c)[1] for c in cards]
    is_flush = len(set(suits)) == 1

    # Check straight
    rank_set = sorted(set(ranks), reverse=True)
    is_straight = False
    straight_high = 0

    if len(rank_set) == 5:
        if rank_set[0] - rank_set[4] == 4:
            is_straight = True
            straight_high = rank_set[0]
        # Wheel: A-2-3-4-5
        if rank_set == [12, 3, 2, 1, 0]:
            is_straight = True
            straight_high = 3

    # Count duplicates
    counts: Dict[int, int] = {}
    for r in ranks:
        counts[r] = counts.get(r, 0) + 1

    groups = sorted(counts.items(), key=lambda x: (x[1], x[0]), reverse=True)

    if is_flush and is_straight:
        if straight_high == 12:
            return HandRank.ROYAL_FLUSH, [12], "Royal Flush"
        return HandRank.STRAIGHT_FLUSH, [straight_high], "Straight Flush"

    if groups[0][1] == 4:
        kickers = [groups[0][0], groups[1][0]]
        return HandRank.FOUR_OF_A_KIND, kickers, "Four of a Kind"

    if groups[0][1] == 3 and len(groups) > 1 and groups[1][1] == 2:
        kickers = [groups[0][0], groups[1][0]]
        return HandRank.FULL_HOUSE, kickers, "Full House"

    if is_flush:
        return HandRank.FLUSH, ranks, "Flush"

    if is_straight:
        return HandRank.STRAIGHT, [straight_high], "Straight"

    if groups[0][1] == 3:
        kickers = [groups[0][0]] + [r for r, c in groups[1:]]
        return HandRank.THREE_OF_A_KIND, kickers, "Three of a Kind"

    if groups[0][1] == 2 and len(groups) > 1 and groups[1][1] == 2:
        kickers = sorted([groups[0][0], groups[1][0]], reverse=True) + [groups[2][0]]
        return HandRank.TWO_PAIR, kickers, "Two Pair"

    if groups[0][1] == 2:
        kickers = [groups[0][0]] + [r for r, c in groups[1:]]
        return HandRank.PAIR, kickers, "Pair"

    return HandRank.HIGH_CARD, ranks, "High Card"


def deal_cards() -> Tuple[List[str], List[str], List[str]]:
    deck = [f"{r}{s}" for r in RANKS for s in SUITS]
    random.shuffle(deck)
    player = [deck.pop(), deck.pop()]
    ai = [deck.pop(), deck.pop()]
    community = [deck.pop(), deck.pop(), deck.pop()]
    return player, ai, community


def deal_turn_river(deck: List[str], community: List[str]) -> str:
    card = deck.pop()
    community.append(card)
    return card


class PokerEngine(BaseGameEngine):
    """Single-player Texas Hold'em vs AI dealer."""

    def __init__(self) -> None:
        self._games: Dict[str, Any] = {}

    async def play(self, user_id: str, bet_amount: Decimal, game_data: Dict[str, Any]) -> GameResult:
        return self._play_hand(game_data.get("round_id", ""), user_id, bet_amount, game_data)

    async def validate_bet(self, bet_amount: Decimal, game_data: Dict[str, Any]) -> bool:
        return bet_amount >= Decimal("1.00")

    def _play_hand(self, round_id: str, user_id: str, bet_amount: Decimal, game_data: Dict[str, Any]) -> GameResult:
        action = game_data.get("action", "deal")

        if action == "deal":
            return self._deal(round_id, bet_amount)
        elif action == "showdown":
            return self._showdown(round_id)
        elif action == "fold":
            return self._fold(round_id)
        raise ValueError(f"Unknown action: {action}")

    def _deal(self, round_id: str, bet_amount: Decimal) -> GameResult:
        player, ai_hand, community = deal_cards()
        pot = bet_amount * 2

        self._games[round_id] = {
            "player": player, "ai": ai_hand,
            "community": community, "pot": pot,
            "bet": bet_amount,
            "stage": "flop", "player_folded": False,
        }

        p_rank, p_kickers, p_name = evaluate_hand(player, community)

        return GameResult(
            round_id=round_id, game_type="poker",
            bet_amount=bet_amount, payout_amount=Decimal("0"),
            won=False,
            outcome_data={
                "stage": "flop", "community": community,
                "player_hand": player, "player_rank": p_name,
                "is_finished": False,
            },
        )

    def _showdown(self, round_id: str) -> GameResult:
        g = self._get_game(round_id)
        community = g["community"]
        deck = [f"{r}{s}" for r in RANKS for s in SUITS
                if f"{r}{s}" not in g["player"] + g["ai"] + community]
        random.shuffle(deck)

        community.append(deck.pop())
        community.append(deck.pop())

        p_rank, p_kickers, p_name = evaluate_hand(g["player"], community)
        a_rank, a_kickers, a_name = evaluate_hand(g["ai"], community)

        won = p_rank > a_rank or (p_rank == a_rank and p_kickers > a_kickers)
        tie = p_rank == a_rank and p_kickers == a_kickers
        pot = g["pot"]

        if tie:
            payout = pot / 2
            outcome_text = "tie"
            won = True
        elif won:
            payout = pot
            outcome_text = "win"
        else:
            payout = Decimal("0")
            outcome_text = "lose"

        del self._games[round_id]

        return GameResult(
            round_id=round_id, game_type="poker",
            bet_amount=g["bet"], payout_amount=payout,
            won=won,
            outcome_data={
                "stage": "showdown", "community": community,
                "player_hand": g["player"], "ai_hand": g["ai"],
                "player_rank": p_name, "ai_rank": a_name,
                "player_score": int(p_rank), "ai_score": int(a_rank),
                "outcome": outcome_text, "pot": str(pot),
                "is_finished": True,
            },
        )

    def _fold(self, round_id: str) -> GameResult:
        g = self._get_game(round_id)
        del self._games[round_id]
        return GameResult(
            round_id=round_id, game_type="poker",
            bet_amount=g["bet"], payout_amount=Decimal("0"),
            won=False,
            outcome_data={
                "stage": "fold", "community": g["community"],
                "player_hand": g["player"], "ai_hand": g["ai"],
                "outcome": "fold", "is_finished": True,
            },
        )

    def _get_game(self, round_id: str) -> Dict[str, Any]:
        if round_id not in self._games:
            raise ValueError(f"Round {round_id} not found")
        return self._games[round_id]
