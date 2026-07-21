"""Blackjack game API endpoints."""

from __future__ import annotations

from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.endpoints.auth import get_current_user
from app.core.dependencies import get_session
from app.games.blackjack import (
    BlackjackEngine,
    BlackjackAction,
)
from app.models.game import GameRound, GameType, RoundStatus
from app.models.user import User
from app.schemas.blackjack import (
    BlackjackRoundResponse,
    BlackjackStartRequest,
)
from app.services.wallet_service import WalletService

router = APIRouter(prefix="/blackjack", tags=["Blackjack"])

# Singleton engine instance (in-memory game state)
engine = BlackjackEngine()


def _build_response(
    result,
    message: str | None = None,
) -> BlackjackRoundResponse:
    """Convert a GameResult to a BlackjackRoundResponse."""
    data = result.outcome_data
    return BlackjackRoundResponse(
        round_id=result.round_id,
        player_cards=data.get("player_cards", []),
        dealer_cards=data.get("dealer_cards", []),
        player_score=data.get("player_score", 0),
        dealer_score=data.get("dealer_score", 0),
        bet_amount=result.bet_amount,
        is_finished=data.get("is_finished", True),
        outcome=data.get("outcome"),
        won=result.won,
        payout_amount=result.payout_amount,
        player_busted=data.get("player_busted", False),
        dealer_busted=data.get("dealer_busted", False),
        player_blackjack=data.get("player_blackjack", False),
        can_split=data.get("can_split", False),
        can_double=data.get("can_double", False),
        insurance_offered=data.get("insurance_offered", False),
        insurance_active=data.get("insurance_active", False),
        has_split=data.get("has_split", False),
        hand_count=data.get("hand_count", 1),
        active_hand=data.get("active_hand", 0),
        message=message,
    )


@router.post("/bet", response_model=BlackjackRoundResponse)
async def blackjack_bet(
    payload: BlackjackStartRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Place a bet and start a new Blackjack hand."""
    wallet_service = WalletService(session)

    # Create game round in DB
    game_round = GameRound(
        user_id=user.id,
        game_type=GameType.BLACKJACK,
        status=RoundStatus.INITIATED,
        bet_amount=payload.bet_amount,
    )
    session.add(game_round)
    await session.flush()

    # Hold bet in wallet
    try:
        await wallet_service.hold_bet(
            user_id=user.id,
            amount=payload.bet_amount,
            reference_id=game_round.id,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    # Play the hand
    try:
        result = await engine.play(
            user_id=user.id,
            bet_amount=payload.bet_amount,
            game_data={
                "action": BlackjackAction.BET,
                "round_id": game_round.id,
            },
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception:
        await wallet_service.push_bet(user.id, payload.bet_amount, game_round.id)
        game_round.status = RoundStatus.CANCELLED
        game_round.is_completed = True
        await session.flush()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Game error. Your bet has been refunded.",
        )

    data = result.outcome_data
    is_finished = data.get("is_finished", False)
    outcome = data.get("outcome")

    if is_finished:
        if outcome == "push":
            await wallet_service.push_bet(
                user_id=user.id,
                amount=payload.bet_amount,
                reference_id=game_round.id,
            )
        else:
            # For blackjack: payout = bet * 1.5 (the extra over stake)
            # For other wins: payout = bet (1:1)
            # Blackjack pays 3:2 - use Decimal multiplication for exact results
            payout_amount = (
                payload.bet_amount * Decimal("1.5")
                if outcome == "blackjack"
                else (payload.bet_amount if result.won else 0)
            )
            await wallet_service.resolve_bet(
                user_id=user.id,
                amount=payload.bet_amount,
                won=result.won,
                payout=payout_amount,
                reference_id=game_round.id,
            )
        game_round.status = RoundStatus.COMPLETED
        game_round.payout_amount = result.payout_amount
        game_round.outcome_data = str(data)
        game_round.is_completed = True
    else:
        game_round.status = RoundStatus.PLAYING
        game_round.outcome_data = str(data)

    await session.flush()

    msg = None
    if outcome == "blackjack":
        msg = "🎉 Blackjack! You win 3:2!"
    elif outcome == "push":
        msg = "🤝 Push — your bet is returned."
    elif is_finished and not result.won:
        msg = "😔 Dealer has blackjack. Better luck next time."

    return _build_response(result, message=msg)


# ── Insurance ─────────────────────────────────────────────────────

@router.post("/{round_id}/insurance", response_model=BlackjackRoundResponse)
async def blackjack_insurance(
    round_id: str,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Take insurance when dealer shows an Ace."""
    wallet_service = WalletService(session)

    game_round = await session.get(GameRound, round_id)
    if not game_round or game_round.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Round not found")
    if game_round.is_completed:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Round already finished")

    # Hold insurance bet (half the original bet)
    ins_amount = game_round.bet_amount / 2
    try:
        await wallet_service.hold_bet(
            user_id=user.id,
            amount=ins_amount,
            reference_id=f"{round_id}_ins",
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    try:
        result = await engine.insurance(round_id)
    except ValueError as e:
        await wallet_service.push_bet(user.id, ins_amount, f"{round_id}_ins")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception:
        await wallet_service.push_bet(user.id, game_round.bet_amount, round_id)
        await wallet_service.push_bet(user.id, ins_amount, f"{round_id}_ins")
        game_round.status = RoundStatus.CANCELLED
        game_round.is_completed = True
        await session.flush()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Game error. Your bet has been refunded.",
        )

    data = result.outcome_data
    outcome = data.get("outcome")

    if outcome == "insurance_win":
        # Insurance won (dealer had blackjack) — pay 2:1
        ins_payout = ins_amount * 3  # Stake + 2:1
        # Main bet pushes
        await wallet_service.push_bet(user.id, game_round.bet_amount, round_id)
        await wallet_service.resolve_bet(
            user.id, ins_amount, True,
            payout=ins_payout, reference_id=f"{round_id}_ins",
        )
        game_round.status = RoundStatus.COMPLETED
        game_round.payout_amount = result.payout_amount
        game_round.outcome_data = str(data)
        game_round.is_completed = True
    else:
        # Insurance lost — house keeps it, main bet still in play
        await wallet_service.resolve_bet(
            user.id, ins_amount, False,
            payout=0, reference_id=f"{round_id}_ins",
        )
        game_round.outcome_data = str(data)

    await session.flush()

    msg = None
    if outcome == "insurance_win":
        msg = "🛡️ Insurance pays! Dealer had blackjack."
    elif outcome == "insurance_lost":
        msg = "😔 Insurance lost. Dealer has no blackjack."

    return _build_response(result, message=msg)


# ── Split ──────────────────────────────────────────────────────────

@router.post("/{round_id}/split", response_model=BlackjackRoundResponse)
async def blackjack_split(
    round_id: str,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Split a pair into two hands."""
    wallet_service = WalletService(session)

    game_round = await session.get(GameRound, round_id)
    if not game_round or game_round.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Round not found")
    if game_round.is_completed:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Round already finished")

    # Hold additional bet for the second hand
    try:
        await wallet_service.hold_bet(
            user_id=user.id,
            amount=game_round.bet_amount,
            reference_id=f"{round_id}_split",
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    try:
        result = await engine.split(round_id)
    except ValueError as e:
        await wallet_service.push_bet(user.id, game_round.bet_amount, f"{round_id}_split")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception:
        await wallet_service.push_bet(user.id, game_round.bet_amount, round_id)
        await wallet_service.push_bet(user.id, game_round.bet_amount, f"{round_id}_split")
        game_round.status = RoundStatus.CANCELLED
        game_round.is_completed = True
        await session.flush()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Game error. Your bet has been refunded.",
        )

    data = result.outcome_data
    game_round.outcome_data = str(data)

    # If split aces, round may be finished immediately
    if data.get("is_finished"):
        total_bet = game_round.bet_amount * 2
        game_round.bet_amount = total_bet
        outcome = data.get("outcome")
        if outcome == "push":
            await wallet_service.push_bet(user.id, total_bet, round_id)
            await wallet_service.push_bet(user.id, game_round.bet_amount, f"{round_id}_split")
        else:
            await wallet_service.resolve_bet(
                user.id, total_bet, result.won,
                payout=total_bet if result.won else 0,
                reference_id=round_id,
            )
        game_round.status = RoundStatus.COMPLETED
        game_round.payout_amount = result.payout_amount
        game_round.is_completed = True

    await session.flush()

    msg = "✂️ Hand split! Play each hand separately."
    if data.get("is_finished"):
        msg = None

    return _build_response(result, message=msg)


@router.post("/{round_id}/hit", response_model=BlackjackRoundResponse)
async def blackjack_hit(
    round_id: str,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Hit — take another card."""
    wallet_service = WalletService(session)

    # Verify the round belongs to this user
    game_round = await session.get(GameRound, round_id)
    if not game_round or game_round.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Round not found")
    if game_round.is_completed:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Round already finished")

    try:
        result = await engine.hit(round_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception:
        await wallet_service.push_bet(user.id, game_round.bet_amount, round_id)
        game_round.status = RoundStatus.CANCELLED
        game_round.is_completed = True
        await session.flush()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Game error. Your bet has been refunded.",
        )

    data = result.outcome_data
    outcome = data.get("outcome")
    has_split = data.get("has_split", False)

    if result.outcome_data.get("is_finished"):
        total_bet = game_round.bet_amount * (2 if has_split else 1)
        game_round.bet_amount = total_bet

        if outcome == "push":
            await wallet_service.push_bet(user.id, total_bet, round_id)
        else:
            await wallet_service.resolve_bet(
                user.id, total_bet, result.won,
                payout=total_bet if result.won else 0,
                reference_id=round_id,
            )

        # Release any split/secondary holds
        if has_split:
            await wallet_service.push_bet(user.id, game_round.bet_amount // 2, f"{round_id}_split")

        game_round.status = RoundStatus.COMPLETED
        game_round.payout_amount = result.payout_amount
        game_round.outcome_data = str(data)
        game_round.is_completed = True
    else:
        game_round.outcome_data = str(data)

    await session.flush()

    msg = None
    if outcome == "bust":
        msg = "💥 Bust! You went over 21."
    elif outcome == "win":
        msg = "🎉 You win!"
    elif outcome == "lose":
        msg = "😔 Dealer wins."
    elif outcome == "push":
        msg = "🤝 Push — your bet is returned."

    return _build_response(result, message=msg)


@router.post("/{round_id}/stand", response_model=BlackjackRoundResponse)
async def blackjack_stand(
    round_id: str,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Stand — end your turn and let the dealer play."""
    wallet_service = WalletService(session)

    game_round = await session.get(GameRound, round_id)
    if not game_round or game_round.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Round not found")
    if game_round.is_completed:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Round already finished")

    try:
        result = await engine.stand(round_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception:
        await wallet_service.push_bet(user.id, game_round.bet_amount, round_id)
        game_round.status = RoundStatus.CANCELLED
        game_round.is_completed = True
        await session.flush()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Game error. Your bet has been refunded.",
        )

    data = result.outcome_data
    outcome = data.get("outcome")
    has_split = data.get("has_split", False)

    total_bet = game_round.bet_amount * (2 if has_split else 1)
    game_round.bet_amount = total_bet

    if outcome == "push":
        await wallet_service.push_bet(user.id, total_bet, round_id)
    else:
        await wallet_service.resolve_bet(
            user.id, total_bet, result.won,
            payout=total_bet if result.won else 0,
            reference_id=round_id,
        )

    if has_split:
        await wallet_service.push_bet(user.id, game_round.bet_amount // 2, f"{round_id}_split")

    game_round.status = RoundStatus.COMPLETED
    game_round.payout_amount = result.payout_amount
    game_round.outcome_data = str(data)
    game_round.is_completed = True

    await session.flush()

    msg = None
    if outcome == "win":
        msg = "🎉 You win!"
    elif outcome == "lose":
        msg = "😔 Dealer wins."
    elif outcome == "push":
        msg = "🤝 Push — your bet is returned."

    return _build_response(result, message=msg)


@router.post("/{round_id}/double", response_model=BlackjackRoundResponse)
async def blackjack_double(
    round_id: str,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Double down — double your bet, take one card, and stand."""
    wallet_service = WalletService(session)

    game_round = await session.get(GameRound, round_id)
    if not game_round or game_round.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Round not found")
    if game_round.is_completed:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Round already finished")

    # Hold additional bet amount
    try:
        await wallet_service.hold_bet(
            user_id=user.id,
            amount=game_round.bet_amount,
            reference_id=f"{round_id}_double",
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    try:
        result = await engine.double_down(round_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception:
        await wallet_service.push_bet(user.id, game_round.bet_amount, round_id)
        await wallet_service.push_bet(user.id, game_round.bet_amount, f"{round_id}_double")
        game_round.status = RoundStatus.CANCELLED
        game_round.is_completed = True
        await session.flush()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Game error. Your bet has been refunded.",
        )

    data = result.outcome_data
    outcome = data.get("outcome")

    # Resolve both the original bet and the doubled amount
    total_bet = game_round.bet_amount * 2
    game_round.bet_amount = total_bet

    if outcome == "push":
        await wallet_service.push_bet(
            user_id=user.id,
            amount=total_bet,
            reference_id=round_id,
        )
    else:
        await wallet_service.resolve_bet(
            user_id=user.id,
            amount=total_bet,
            won=result.won,
            payout=total_bet if result.won else 0,
            reference_id=round_id,
        )
    game_round.status = RoundStatus.COMPLETED
    game_round.payout_amount = result.payout_amount
    game_round.outcome_data = str(data)
    game_round.is_completed = True

    await session.flush()

    msg = None
    if outcome == "win":
        msg = "🎉 Double down success! You win!"
    elif outcome == "bust":
        msg = "💥 Bust on the double down!"
    elif outcome == "lose":
        msg = "😔 Dealer wins."
    elif outcome == "push":
        msg = "🤝 Push."

    return _build_response(result, message=msg)
