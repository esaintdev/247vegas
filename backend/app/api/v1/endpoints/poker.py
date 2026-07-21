"""Texas Hold'em API endpoint."""

from __future__ import annotations

from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, get_session
from app.games.poker import PokerEngine
from app.models.game import GameRound, GameType, RoundStatus
from app.models.user import User
from app.schemas.poker import PokerActionRequest, PokerRoundResponse
from app.services.wallet_service import WalletService

router = APIRouter(prefix="/poker", tags=["Poker"])
engine = PokerEngine()


@router.post("/bet", response_model=PokerRoundResponse)
async def poker_deal(
    payload: PokerActionRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Play a poker hand — deal, showdown, or fold."""
    wallet = WalletService(session)

    if payload.action == "deal":
        bet = payload.bet_amount
        # Create new round and hold bet
        game_round = GameRound(
            user_id=user.id, game_type=GameType.POKER,
            status=RoundStatus.INITIATED, bet_amount=bet,
        )
        session.add(game_round)
        await session.flush()

        try:
            await wallet.hold_bet(user.id, bet, game_round.id)
        except ValueError as e:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

        try:
            result = await engine.play(user.id, bet, {
                "round_id": game_round.id, "action": "deal",
            })
        except Exception:
            await wallet.push_bet(user.id, bet, game_round.id)
            game_round.status = RoundStatus.CANCELLED
            game_round.is_completed = True
            await session.flush()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Game error. Your bet has been refunded.",
            )

    elif payload.action in ("showdown", "fold"):
        # Find the latest active round for this user
        result = await session.execute(
            select(GameRound).where(
                GameRound.user_id == user.id,
                GameRound.game_type == GameType.POKER,
                GameRound.is_completed == False,
            ).order_by(GameRound.created_at.desc()).limit(1)
        )
        game_round = result.scalar_one_or_none()
        if not game_round:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No active hand")

        try:
            result = await engine.play(user.id, game_round.bet_amount, {
                "round_id": game_round.id, "action": payload.action,
            })
        except Exception:
            await wallet.push_bet(user.id, game_round.bet_amount, game_round.id)
            game_round.status = RoundStatus.CANCELLED
            game_round.is_completed = True
            await session.flush()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Game error. Your bet has been refunded.",
            )
    else:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid action")

    data = result.outcome_data
    game_round.outcome_data = str(data)

    if data.get("is_finished"):
        if data.get("outcome") == "tie":
            await wallet.push_bet(user.id, game_round.bet_amount, game_round.id)
        elif data.get("outcome") == "win":
            pot = Decimal(str(data.get("pot", "0")))
            await wallet.resolve_bet(
                user.id, game_round.bet_amount, True,
                payout=pot, reference_id=game_round.id,
            )
        else:
            await wallet.resolve_bet(
                user.id, game_round.bet_amount, False,
                reference_id=game_round.id,
            )
        game_round.status = RoundStatus.COMPLETED
        game_round.payout_amount = result.payout_amount
        game_round.is_completed = True

    await session.flush()

    msg = None
    if data.get("is_finished"):
        o = data.get("outcome", "")
        msg = ("🎉 You win!" if o == "win"
               else "🤝 Tie!" if o == "tie"
               else "😔 You folded." if o == "fold"
               else "😔 AI wins.")

    return PokerRoundResponse(
        round_id=game_round.id, stage=data.get("stage", ""),
        community=data.get("community", []),
        player_hand=data.get("player_hand", []),
        ai_hand=data.get("ai_hand"),
        player_rank=data.get("player_rank"),
        ai_rank=data.get("ai_rank"),
        player_score=data.get("player_score"),
        ai_score=data.get("ai_score"),
        outcome=data.get("outcome"),
        pot=data.get("pot"),
        is_finished=data.get("is_finished", False),
        message=msg,
    )
