"""Slots game API endpoint."""

from __future__ import annotations

from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, get_session
from app.games.slots import SlotsEngine, SYMBOL_EMOJI
from app.models.game import GameRound, GameType, RoundStatus
from app.models.user import User
from app.schemas.slots import SlotsSpinRequest, SlotsSpinResponse
from app.services.wallet_service import WalletService

router = APIRouter(prefix="/slots", tags=["Slots"])

# Singleton engine instance
engine = SlotsEngine()


@router.post("/spin", response_model=SlotsSpinResponse)
async def slots_spin(
    payload: SlotsSpinRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Spin the slot machine reels."""
    wallet_service = WalletService(session)

    # Create game round
    game_round = GameRound(
        user_id=user.id,
        game_type=GameType.SLOTS,
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

    # Spin — with error recovery
    try:
        result = await engine.play(
            user_id=user.id,
            bet_amount=payload.bet_amount,
            game_data={
                "round_id": game_round.id,
                "lines": payload.lines,
            },
        )
    except Exception:
        # Release held bet and cancel round on engine failure
        await wallet_service.resolve_bet(
            user_id=user.id,
            amount=payload.bet_amount,
            won=False,
            reference_id=game_round.id,
        )
        game_round.status = RoundStatus.CANCELLED
        game_round.is_completed = True
        await session.flush()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Spin failed. Your bet has been refunded.",
        )

    data = result.outcome_data
    total_win = Decimal(str(data["total_win"]))
    won = total_win > 0

    # Resolve bet
    if won:
        await wallet_service.resolve_bet(
            user_id=user.id,
            amount=payload.bet_amount,
            won=True,
            payout=total_win,
            reference_id=game_round.id,
        )
    else:
        await wallet_service.resolve_bet(
            user_id=user.id,
            amount=payload.bet_amount,
            won=False,
            reference_id=game_round.id,
        )

    # Update game round
    game_round.status = RoundStatus.COMPLETED
    game_round.payout_amount = result.payout_amount
    game_round.outcome_data = str(data)
    game_round.is_completed = True
    await session.flush()

    # Message
    msg = None
    if won:
        msg = f"🎉 You won ${float(total_win):,.2f}!"
    else:
        msg = "😔 No win this spin. Try again!"

    return SlotsSpinResponse(
        round_id=game_round.id,
        grid=data["grid"],
        symbols=data["symbols"],
        paylines=data["paylines"],
        scatter_count=data["scatter_count"],
        scatter_win=data["scatter_win"],
        total_win=data["total_win"],
        bet_amount=data["bet_amount"],
        lines=data["lines"],
        bet_per_line=data["bet_per_line"],
        won=won,
        message=msg,
    )
