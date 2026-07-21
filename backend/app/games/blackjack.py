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
        game_state: Dict[str, Any] = {
            "round_id": round_id,
            "player_hands": [player_hand],
            "dealer_hand": dealer_hand,
            "hand_bets": [bet_amount],
            "active_hand": 0,
            "is_finished": False,
            "insurance_offered": dealer_hand.cards[0].rank == "A",
            "insurance_bet": Decimal("0"),
            "has_split": False,
        }

        self._games[round_id] = game_state

        # Check for natural blackjack
        if player_hand.is_blackjack and dealer_hand.is_blackjack:
            # Both blackjack — push
            dealer_hand.cards[1].face_up = True
            return self._end_hand(round_id)

        if player_hand.is_blackjack:
            # Player blackjack — reveal dealer hole card, pay 3:2
            dealer_hand.cards[1].face_up = True
            return self._end_hand(round_id)

        if dealer_hand.is_blackjack:
            # Dealer blackjack — reveal hole card
            dealer_hand.cards[1].face_up = True
            return self._end_hand(round_id)

        return self._build_result(round_id)

    # ── Actions ────────────────────────────────────────────────────────

    async def insurance(self, round_id: str) -> GameResult:
        """Take insurance (costs half the bet)."""
        game = self._get_game(round_id)
        if not game["insurance_offered"]:
            raise ValueError("Insurance not offered")
        if game["insurance_bet"] > 0:
            raise ValueError("Insurance already taken")

        insurance_cost = game["hand_bets"][0] / 2
        game["insurance_bet"] = insurance_cost
        game["insurance_offered"] = False

        # Reveal dealer hole card to check for blackjack
        dealer_hand: Hand = game["dealer_hand"]
        dealer_hand.cards[1].face_up = True

        if dealer_hand.is_blackjack:
            # Insurance pays 2:1 — also push on main bet
            ins_payout = insurance_cost * 3  # Stake back + 2:1 win
            # Main bet pushes
            self._games.pop(round_id, None)
            return GameResult(
                round_id=round_id,
                game_type="blackjack",
                bet_amount=game["hand_bets"][0] + insurance_cost,
                payout_amount=ins_payout,
                won=True,
                outcome_data={
                    "outcome": "insurance_win",
                    "player_cards": [game["player_hands"][0].to_dict()],
                    "dealer_cards": dealer_hand.to_dict(),
                    "player_score": game["player_hands"][0].best_value,
                    "dealer_score": dealer_hand.best_value,
                    "player_busted": False,
                    "dealer_busted": False,
                    "player_blackjack": game["player_hands"][0].is_blackjack,
                    "can_split": False,
                    "can_double": False,
                    "insurance_offered": False,
                    "insurance_active": False,
                    "insurance_result": "won",
                    "is_finished": True,
                },
            )
        else:
            # Insurance lost, round continues (hole card re-hidden in build_result)
            dealer_hand.cards[1].face_up = False
            return self._build_result(round_id)

    async def split(self, round_id: str) -> GameResult:
        """Split a pair into two hands."""
        game = self._get_game(round_id)
        hand = game["player_hands"][0]
        if not hand.can_split:
            raise ValueError("Cannot split")
        if game["has_split"]:
            raise ValueError("Already split")

        # Split into two hands
        hand1 = Hand()
        hand2 = Hand()
        hand1.add_card(hand.cards[0])
        hand2.add_card(hand.cards[1])
        del hand

        # Deal one additional card to each hand
        hand1.add_card(self.deck.draw())
        hand2.add_card(self.deck.draw())

        # If splitting aces, each hand gets only one card
        is_aces = hand1.cards[0].rank == "A"

        bet = game["hand_bets"][0]
        game["player_hands"] = [hand1, hand2]
        game["hand_bets"] = [bet, bet]
        game["has_split"] = True
        game["active_hand"] = 0

        # For split aces, hands are immediately resolved
        if is_aces:
            return self._end_hand(round_id)

        return self._build_result(round_id)

    async def hit(self, round_id: str) -> GameResult:
        """Player takes another card on the active hand."""
        game = self._get_game(round_id)
        if game["is_finished"]:
            raise ValueError("Hand is already finished")

        hand_idx = game["active_hand"]
        hand: Hand = game["player_hands"][hand_idx]
        hand.add_card(self.deck.draw())

        if hand.is_busted or hand.best_value == 21:
            # Move to next hand or end
            return self._advance_or_end(round_id)

        return self._build_result(round_id)

    async def stand(self, round_id: str) -> GameResult:
        """Player stands on the active hand."""
        game = self._get_game(round_id)
        if game["is_finished"]:
            raise ValueError("Hand is already finished")

        return self._advance_or_end(round_id)

    async def double_down(self, round_id: str) -> GameResult:
        """Double the bet on the active hand, take one card, and stand."""
        game = self._get_game(round_id)
        if game["is_finished"]:
            raise ValueError("Hand is already finished")

        hand_idx = game["active_hand"]
        hand: Hand = game["player_hands"][hand_idx]
        if not hand.can_double:
            raise ValueError("Cannot double down now")

        # Double the bet for this hand
        game["hand_bets"][hand_idx] *= 2
        hand.add_card(self.deck.draw())

        return self._advance_or_end(round_id)

    # ── Internal ───────────────────────────────────────────────────────

    def _get_game(self, round_id: str) -> Dict[str, Any]:
        if round_id not in self._games:
            raise ValueError(f"Game round {round_id} not found")
        return self._games[round_id]

    def _advance_or_end(self, round_id: str) -> GameResult:
        """Move to the next active hand, or end the round if all hands done."""
        game = self._get_game(round_id)
        hand_idx = game["active_hand"]

        # Move to next hand
        next_hand = hand_idx + 1

        if next_hand < len(game["player_hands"]):
            game["active_hand"] = next_hand
            return self._build_result(round_id)
        else:
            return self._end_hand(round_id)

    def _dealer_play(self, dealer_hand: Hand) -> None:
        """Dealer draws to 17 (stand on soft 17)."""
        while dealer_hand.best_value < 17:
            dealer_hand.add_card(self.deck.draw())

    def _end_hand(self, round_id: str) -> GameResult:
        """Finish the hand — dealer plays, compare, determine payout."""
        game = self._get_game(round_id)
        player_hands: List[Hand] = game["player_hands"]
        dealer_hand: Hand = game["dealer_hand"]

        # Reveal dealer hole card
        dealer_hand.cards[1].face_up = True

        total_bet = sum(game["hand_bets"])
        total_payout = Decimal("0")
        outcomes: List[str] = []
        overall_won = False

        # Dealer plays if at least one player hand hasn't busted
        any_alive = any(not h.is_busted for h in player_hands)
        if any_alive:
            self._dealer_play(dealer_hand)

        # Evaluate each player hand
        for i, hand in enumerate(player_hands):
            bet = game["hand_bets"][i]

            if hand.is_busted:
                outcomes.append("bust")
            elif dealer_hand.is_busted:
                outcomes.append("win")
                total_payout += bet * 2  # Stake + 1:1 win
                overall_won = True
            elif hand.best_value > dealer_hand.best_value:
                # Check for natural blackjack (pays 3:2)
                if hand.is_blackjack and len(player_hands) == 1 and not game["has_split"]:
                    outcomes.append("blackjack")
                    total_payout += bet + (bet * BLACKJACK_PAYOUT)
                else:
                    outcomes.append("win")
                    total_payout += bet * 2  # 1:1 (split hands don't get 3:2)
                overall_won = True
            elif hand.best_value == dealer_hand.best_value:
                outcomes.append("push")
                total_payout += bet  # Push — return stake
            else:
                outcomes.append("lose")

        # Handle insurance
        insurance_bet = game["insurance_bet"]
        if insurance_bet > 0 and dealer_hand.is_blackjack:
            total_payout += insurance_bet * 3  # Stake back + 2:1
            overall_won = True
        elif insurance_bet > 0:
            # Insurance lost, stake kept by house
            pass

        game["is_finished"] = True
        self._games.pop(round_id, None)

        # Determine overall outcome
        if len(outcomes) == 1:
            overall_outcome = outcomes[0]
        else:
            # Multiple hands — summarize
            wins = outcomes.count("win")
            losses = outcomes.count("lose")
            busts = outcomes.count("bust")
            pushes = outcomes.count("push")
            if wins > 0:
                overall_outcome = "win"
            elif pushes > 0 and wins == 0:
                overall_outcome = "push"
            else:
                overall_outcome = "lose"

        # Net result = total_payout - total_bet - insurance_bet
        net_result = total_payout - total_bet - insurance_bet

        # Serialize all player hands
        all_player_cards = [h.to_dict() for h in player_hands]
        # For single hand, return flat list; for split, return list of lists
        if len(player_hands) == 1:
            serialized_cards = all_player_cards[0]
        else:
            serialized_cards = all_player_cards

        dealer_score = dealer_hand.best_value
        player_score = player_hands[0].best_value if player_hands else 0

        return GameResult(
            round_id=round_id,
            game_type="blackjack",
            bet_amount=total_bet + insurance_bet,
            payout_amount=net_result,
            won=overall_won,
            outcome_data={
                "outcome": overall_outcome,
                "outcomes": outcomes,
                "player_cards": serialized_cards,
                "dealer_cards": dealer_hand.to_dict(),
                "player_score": player_score,
                "dealer_score": dealer_score,
                "player_busted": any(h.is_busted for h in player_hands),
                "dealer_busted": dealer_hand.is_busted,
                "player_blackjack": any(h.is_blackjack for h in player_hands),
                "has_split": game["has_split"],
                "hand_count": len(player_hands),
                "active_hand": 0,
                "insurance_offered": False,
                "insurance_active": False,
                "insurance_bet": str(insurance_bet),
                "insurance_result": "won" if (insurance_bet > 0 and dealer_hand.is_blackjack) else ("lost" if insurance_bet > 0 else None),
                "can_split": False,
                "can_double": False,
                "is_finished": True,
            },
        )

    def _build_result(self, round_id: str) -> GameResult:
        """Build a mid-game result (hand still in progress)."""
        game = self._get_game(round_id)
        player_hands: List[Hand] = game["player_hands"]
        dealer_hand: Hand = game["dealer_hand"]
        hand_idx = game["active_hand"]
        active_hand = player_hands[hand_idx]

        # Serialize all player hands
        all_player_cards = [h.to_dict() for h in player_hands]
        if len(player_hands) == 1:
            serialized_cards = all_player_cards[0]
        else:
            serialized_cards = all_player_cards

        return GameResult(
            round_id=round_id,
            game_type="blackjack",
            bet_amount=sum(game["hand_bets"]) + game["insurance_bet"],
            payout_amount=Decimal("0"),
            won=False,
            outcome_data={
                "outcome": "playing",
                "player_cards": serialized_cards,
                "dealer_cards": dealer_hand.to_dict(hide_hole=True),
                "player_score": active_hand.best_value,
                "dealer_score": dealer_hand.visible_value(hide_hole=True),
                "player_busted": active_hand.is_busted,
                "dealer_busted": False,
                "player_blackjack": active_hand.is_blackjack,
                "has_split": game["has_split"],
                "hand_count": len(player_hands),
                "active_hand": hand_idx,
                "insurance_offered": game["insurance_offered"],
                "insurance_active": game["insurance_bet"] > 0,
                "insurance_bet": str(game["insurance_bet"]),
                "can_split": not game["has_split"] and active_hand.can_split and len(player_hands) == 1,
                "can_double": active_hand.can_double,
                "is_finished": game["is_finished"],
            },
        )
