"""Baccarat game engine — standard punto banco rules."""

from __future__ import annotations

import random
from decimal import Decimal
from typing import Any, Dict, List, Tuple

from app.games.base import BaseGameEngine, GameResult

SUITS = ["♠", "♥", "♣", "♦"]
RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"]


def card_value(rank: str) -> int:
    if rank in ("J", "Q", "K", "10"):
        return 0
    if rank == "A":
        return 1
    return int(rank)


def hand_value(cards: List[str]) -> int:
    return sum(card_value(r) for r in cards) % 10


def should_player_draw(player_value: int) -> bool:
    return player_value <= 5


def should_banker_draw(banker_value: int, player_third: int | None) -> bool:
    if player_third is None:
        return banker_value <= 5
    if banker_value <= 2:
        return True
    if banker_value == 3:
        return player_third != 8
    if banker_value == 4:
        return player_third in (2, 3, 4, 5, 6, 7)
    if banker_value == 5:
        return player_third in (4, 5, 6, 7)
    if banker_value == 6:
        return player_third in (6, 7)
    return False


class BaccaratEngine(BaseGameEngine):
    """Standard punto banco baccarat."""

    async def play(self, user_id: str, bet_amount: Decimal, game_data: Dict[str, Any]) -> GameResult:
        bet_type = game_data.get("bet_type", "player")  # player, banker, tie
        return self._deal(user_id, bet_amount, bet_type, game_data.get("round_id", ""))

    async def validate_bet(self, bet_amount: Decimal, game_data: Dict[str, Any]) -> bool:
        return bet_amount >= Decimal("1.00")

    def _deal(self, user_id: str, bet_amount: Decimal, bet_type: str, round_id: str) -> GameResult:
        deck = [r for r in RANKS for _ in range(4 * len(SUITS))]
        for _ in range(4):
            random.shuffle(deck)

        def draw() -> str:
            return deck.pop()

        player = [draw(), draw()]
        banker = [draw(), draw()]

        p_val = hand_value(player)
        b_val = hand_value(banker)
        player_third_card: str | None = None
        banker_third_card: str | None = None

        # Natural — no draws
        if p_val >= 8 or b_val >= 8:
            pass
        else:
            if should_player_draw(p_val):
                player_third_card = draw()
                player.append(player_third_card)
                p_val = hand_value(player)

            if should_banker_draw(b_val, card_value(player_third_card) if player_third_card else None):
                banker_third_card = draw()
                banker.append(banker_third_card)
                b_val = hand_value(banker)

        # Determine outcome
        p_score = hand_value(player)
        b_score = hand_value(banker)
        natural = (len(player) == 2 and p_score >= 8) or (len(banker) == 2 and b_score >= 8)

        if p_score > b_score:
            outcome, won = "player", bet_type == "player"
            payout_mult = Decimal("1.0")
        elif b_score > p_score:
            outcome, won = "banker", bet_type == "banker"
            payout_mult = Decimal("0.95")  # 5% commission on banker
        else:
            outcome, won = "tie", bet_type == "tie"
            payout_mult = Decimal("8.0")  # 8:1 on tie

        if won:
            if outcome == "tie":
                payout = bet_amount * payout_mult
            elif outcome == "banker":
                payout = bet_amount * payout_mult  # 0.95:1
            else:
                payout = bet_amount  # 1:1
        else:
            # On tie, banker/player bets push
            if outcome == "tie" and bet_type in ("player", "banker"):
                payout = bet_amount  # Push
                won = True  # Treat as push
            else:
                payout = Decimal("0")

        return GameResult(
            round_id=round_id, game_type="baccarat",
            bet_amount=bet_amount, payout_amount=payout - bet_amount if won and outcome != "tie" and bet_type != "banker" else payout,
            won=won or (outcome == "tie" and bet_type in ("player", "banker")),
            outcome_data={
                "outcome": outcome,
                "player_cards": player,
                "banker_cards": banker,
                "player_score": p_score,
                "banker_score": b_score,
                "player_third": player_third_card,
                "banker_third": banker_third_card,
                "natural": natural,
                "bet_type": bet_type,
                "payout": str(payout),
            },
        )
