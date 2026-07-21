"""Crash game API endpoint."""

from __future__ import annotations

from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, get_session
from app.games.crash import CrashEngine
from app.models.game import GameRound, GameType, RoundStatus
from app.models.user import User
from app.schemas.crash import CrashBetRequest, CrashRoundResponse
from app.services.wallet_service import WalletService

router = APIRouter(prefix="/crash", tags=["Crash"])
engine = CrashEngine()


@router.post("/bet", response_model=CrashRoundResponse)
async def crash_bet(
    payload: CrashBetRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Place a bet on a crash round."""
    wallet_service = WalletService(session)

    game_round = GameRound(
        user_id=user.id, game_type=GameType.CRASH,
        status=RoundStatus.INITIATED, bet_amount=payload.bet_amount,
    )
    session.add(game_round)
    await session.flush()

    try:
        await wallet_service.hold_bet(user_id=user.id, amount=payload.bet_amount, reference_id=game_round.id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    try:
        result = await engine.play(user.id, payload.bet_amount, {
            "round_id": game_round.id,
            "cash_out_at": payload.cash_out_at,
        })
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
    won = result.won
    total_payout = Decimal(str(data["payout"]))

    if won:
        await wallet_service.resolve_bet(user.id, payload.bet_amount, True, payout=total_payout, reference_id=game_round.id)
    else:
        await wallet_service.resolve_bet(user.id, payload.bet_amount, False, reference_id=game_round.id)

    game_round.status = RoundStatus.COMPLETED
    game_round.payout_amount = result.payout_amount
    game_round.outcome_data = str(data)
    game_round.is_completed = True
    await session.flush()

    msg = None
    if data["outcome"] == "crashed":
        msg = f"💥 Crashed at {data['crash_multiplier']}x!"
    elif data["outcome"] == "cashed_out":
        msg = f"✅ Cashed out at {data['cash_out_at']}x! Won ${float(total_payout):,.2f}!"
    else:
        msg = f"🏁 Round ended at {data['final_multiplier']}x."

    return CrashRoundResponse(
        round_id=game_round.id,
        outcome=data["outcome"],
        crash_multiplier=data["crash_multiplier"],
        cash_out_at=data["cash_out_at"],
        final_multiplier=data["final_multiplier"],
        elapsed_seconds=data["elapsed_seconds"],
        bet_amount=str(payload.bet_amount),
        payout=str(total_payout),
        won=won, message=msg,
    )
