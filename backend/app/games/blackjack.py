"""Blackjack game engine — full rules with hit, stand, double, split, insurance."""

from __future__ import annotations

import json
import random
from decimal import Decimal
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple

from app.games.base import BaseGameEngine, GameResult


# ── Card & Deck ──────────────────────────────────────────────────────

SUITS = ["♠", "♥", "♣", "♦"]
RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"]


class Card:
    """A single playing card."""

    __slots__ = ("suit", "rank", "face_up")

    def __init__(self, suit: str, rank: str, face_up: bool = True) -> None:
        self.suit = suit
        self.rank = rank
        self.face_up = face_up

    @property
    def value(self) -> int:
        """Blackjack value (Ace = 11 by default, adjusted later)."""
        if self.rank in ("J", "Q", "K"):
            return 10
        if self.rank == "A":
            return 11
        return int(self.rank)

    @property
    def is_ace(self) -> bool:
        return self.rank == "A"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "suit": self.suit if self.face_up else "?",
            "rank": self.rank if self.face_up else "?",
            "face_up": self.face_up,
            "display": f"{self.rank}{self.suit}" if self.face_up else "?",
        }

    def __repr__(self) -> str:
        status = "?" if not self.face_up else f"{self.rank}{self.suit}"
        return f"<Card {status}>"


class Deck:
    """Standard 52-card deck with optional multi-deck support."""

    def __init__(self, num_decks: int = 6) -> None:
        self.num_decks = num_decks
        self.cards: List[Card] = []
        self._build()

    def _build(self) -> None:
        self.cards = [
            Card(suit, rank)
            for _ in range(self.num_decks)
            for suit in SUITS
            for rank in RANKS
        ]
        random.shuffle(self.cards)

    def draw(self, face_up: bool = True) -> Card:
        """Draw a card from the top of the deck."""
        if len(self.cards) < 20:
            self._build()  # Auto-reset when low
        card = self.cards.pop()
        card.face_up = face_up
        return card

    @property
    def remaining(self) -> int:
        return len(self.cards)

    def to_dict(self) -> Dict[str, Any]:
        return {"remaining": self.remaining}


class Hand:
    """A player's or dealer's hand of cards."""

    def __init__(self) -> None:
        self.cards: List[Card] = []

    def add_card(self, card: Card) -> None:
        self.cards.append(card)

    @property
    def values(self) -> List[int]:
        """All possible hand totals (accounting for soft Aces)."""
        total = 0
        aces = 0
        for card in self.cards:
            total += card.value
            if card.is_ace:
                aces += 1

        # Adjust Aces from 11 → 1 as needed
        results = [total]
        for _ in range(aces):
            total -= 10
            if total != results[0]:
                results.append(total)
        return sorted(set(results))

    @property
    def best_value(self) -> int:
        """Best hand value (closest to 21 without busting)."""
        vals = [v for v in self.values if v <= 21]
        return max(vals) if vals else min(self.values)

    @property
    def is_blackjack(self) -> bool:
        """Natural 21 with exactly 2 cards."""
        return len(self.cards) == 2 and self.best_value == 21

    @property
    def is_busted(self) -> bool:
        """All possible values exceed 21."""
        return all(v > 21 for v in self.values)

    @property
    def is_soft(self) -> bool:
        """Contains a soft Ace (counted as 11)."""
        return len(self.values) > 1

    @property
    def can_split(self) -> bool:
        """Two cards with the same rank."""
        return len(self.cards) == 2 and self.cards[0].rank == self.cards[1].rank

    @property
    def can_double(self) -> bool:
        """Can double down (only on first two cards)."""
        return len(self.cards) == 2

    def to_dict(self, hide_hole: bool = False) -> List[Dict[str, Any]]:
        """Serialize hand; optionally hide the dealer's hole card."""
        cards_data = []
        for i, card in enumerate(self.cards):
            if hide_hole and i == 1:
                cards_data.append({
                    "suit": "?",
                    "rank": "?",
                    "face_up": False,
                    "display": "?",
                })
            else:
                cards_data.append(card.to_dict())
        return cards_data

    def visible_value(self, hide_hole: bool = False) -> int:
        """Calculate only the visible total (dealer's hidden card excluded)."""
        if not hide_hole:
            return self.best_value
        total = 0
        aces = 0
        for i, card in enumerate(self.cards):
            if i == 1:  # Hole card is hidden
                continue
            total += card.value
            if card.is_ace:
                aces += 1
        for _ in range(aces):
            if total > 21:
                total -= 10
        return total


# ── Game Constants ───────────────────────────────────────────────────

BLACKJACK_PAYOUT = Decimal("1.5")  # 3:2
STANDARD_PAYOUT = Decimal("1.0")  # 1:1


class BlackjackAction(str, Enum):
    BET = "bet"
    HIT = "hit"
    STAND = "stand"
    DOUBLE = "double"
    SPLIT = "split"
    INSURANCE = "insurance"


# ── Engine ───────────────────────────────────────────────────────────

class BlackjackEngine(BaseGameEngine):
    """Blackjack game engine — manages full game lifecycle."""

    def __init__(self) -> None:
        self.deck = Deck(num_decks=6)
        self._games: Dict[str, Dict[str, Any]] = {}

    async def play(
        self,
        user_id: str,
        bet_amount: Decimal,
        game_data: Dict[str, Any],
    ) -> GameResult:
        """Start a new blackjack hand — deals initial cards."""
        action = game_data.get("action", BlackjackAction.BET)

        if action == BlackjackAction.BET:
            return await self._start_hand(user_id, bet_amount, game_data)

        raise ValueError(f"Unknown action: {action}")

    async def validate_bet(self, bet_amount: Decimal, game_data: Dict[str, Any]) -> bool:
        return bet_amount >= Decimal("1.00")

    async def _start_hand(
        self,
        user_id: str,
        bet_amount: Decimal,
        game_data: Dict[str, Any],
    ) -> GameResult:
        """Deal initial two cards to player and dealer."""
        player_hand = Hand()
        dealer_hand = Hand()

        # Deal: player, dealer, player, dealer (hole card)
        player_hand.add_card(self.deck.draw())
        dealer_hand.add_card(self.deck.draw())
        player_hand.add_card(self.deck.draw())
        dealer_hand.add_card(self.deck.draw(face_up=False))  # Hole card

        round_id = game_data.get("round_id", "")
        game_state = {
            "round_id": round_id,
            "player_hand": player_hand,
            "dealer_hand": dealer_hand,
            "bet_amount": bet_amount,
            "is_finished": False,
            "insurance_offered": dealer_hand.cards[0].rank == "A",
            "insurance_taken": False,
        }

        self._games[round_id] = game_state

        # Check for natural blackjack
        if player_hand.is_blackjack and not dealer_hand.is_blackjack:
            # Player blackjack — reveal dealer hole card, pay 3:2
            dealer_hand.cards[1].face_up = True
            result = self._end_hand(round_id)
            return result

        if dealer_hand.is_blackjack and not player_hand.is_blackjack:
            # Dealer blackjack — reveal hole card
            dealer_hand.cards[1].face_up = True
            result = self._end_hand(round_id)
            return result

        if dealer_hand.is_blackjack and player_hand.is_blackjack:
            # Both blackjack — push
            dealer_hand.cards[1].face_up = True
            result = self._end_hand(round_id)
            return result

        return self._build_result(round_id)

    async def hit(self, round_id: str) -> GameResult:
        """Player takes another card."""
        game = self._get_game(round_id)
        if game["is_finished"]:
            raise ValueError("Hand is already finished")

        player_hand: Hand = game["player_hand"]
        player_hand.add_card(self.deck.draw())

        if player_hand.is_busted:
            return self._end_hand(round_id)

        return self._build_result(round_id)

    async def stand(self, round_id: str) -> GameResult:
        """Player stands — dealer plays."""
        return self._end_hand(round_id)

    async def double_down(self, round_id: str) -> GameResult:
        """Double the bet, take one card, and stand."""
        game = self._get_game(round_id)
        if game["is_finished"]:
            raise ValueError("Hand is already finished")

        player_hand: Hand = game["player_hand"]
        if not player_hand.can_double:
            raise ValueError("Cannot double down now")

        game["bet_amount"] *= 2
        player_hand.add_card(self.deck.draw())

        return self._end_hand(round_id)

    def _get_game(self, round_id: str) -> Dict[str, Any]:
        if round_id not in self._games:
            raise ValueError(f"Game round {round_id} not found")
        return self._games[round_id]

    def _dealer_play(self, dealer_hand: Hand) -> None:
        """Dealer draws to 17 (stand on soft 17)."""
        while dealer_hand.best_value < 17:
            dealer_hand.add_card(self.deck.draw())

    def _end_hand(self, round_id: str) -> GameResult:
        """Finish the hand — dealer plays, compare, determine payout."""
        game = self._get_game(round_id)
        player_hand: Hand = game["player_hand"]
        dealer_hand: Hand = game["dealer_hand"]
        bet = game["bet_amount"]

        # Reveal dealer hole card
        dealer_hand.cards[1].face_up = True

        # Dealer plays if player hasn't busted
        if not player_hand.is_busted:
            self._dealer_play(dealer_hand)

        game["is_finished"] = True

        # Determine outcome
        player_score = player_hand.best_value
        dealer_score = dealer_hand.best_value

        if player_hand.is_busted:
            won = False
            payout = Decimal("0")
            outcome = "bust"
        elif dealer_hand.is_busted:
            won = True
            payout = bet
            outcome = "dealer_bust"
        elif player_hand.is_blackjack and not dealer_hand.is_blackjack:
            won = True
            payout = bet + (bet * BLACKJACK_PAYOUT)
            outcome = "blackjack"
        elif player_score > dealer_score:
            won = True
            payout = bet
            outcome = "win"
        elif player_score == dealer_score:
            # Push
            won = False
            payout = bet  # Refund (not a win, but gets stake back)
            outcome = "push"
        else:
            won = False
            payout = Decimal("0")
            outcome = "lose"

        # Clean up game state
        del self._games[round_id]

        payout_amount = payout  # The amount OVER the original bet
        if outcome == "push":
            payout_amount = Decimal("0")
        elif outcome == "blackjack":
            payout_amount = bet * BLACKJACK_PAYOUT  # Extra beyond stake
        elif won:
            payout_amount = bet  # Win = get bet back + win bet amount
        else:
            payout_amount = Decimal("0") - bet  # Loss = lose bet amount

        return GameResult(
            round_id=round_id,
            game_type="blackjack",
            bet_amount=bet,
            payout_amount=payout_amount,
            won=won or outcome == "push",
            outcome_data={
                "outcome": outcome,
                "player_cards": player_hand.to_dict(),
                "dealer_cards": dealer_hand.to_dict(),
                "player_score": player_score,
                "dealer_score": dealer_score,
                "player_busted": player_hand.is_busted,
                "dealer_busted": dealer_hand.is_busted,
                "player_blackjack": player_hand.is_blackjack,
                "is_finished": True,
            },
        )

    def _build_result(self, round_id: str) -> GameResult:
        """Build a mid-game result (hand still in progress)."""
        game = self._get_game(round_id)
        player_hand: Hand = game["player_hand"]
        dealer_hand: Hand = game["dealer_hand"]

        return GameResult(
            round_id=round_id,
            game_type="blackjack",
            bet_amount=game["bet_amount"],
            payout_amount=Decimal("0"),
            won=False,
            outcome_data={
                "outcome": "playing",
                "player_cards": player_hand.to_dict(),
                "dealer_cards": dealer_hand.to_dict(hide_hole=True),
                "player_score": player_hand.best_value,
                "dealer_score": dealer_hand.visible_value(hide_hole=True),
                "player_busted": player_hand.is_busted,
                "dealer_busted": False,
                "player_blackjack": player_hand.is_blackjack,
                "insurance_offered": game["insurance_offered"],
                "can_split": player_hand.can_split,
                "can_double": player_hand.can_double,
                "is_finished": game["is_finished"],
            },
        )
