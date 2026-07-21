"""Crash game API endpoint.

Two-phase flow:
  1. POST /crash/bet — start a round (caches crash point, doesn't resolve)
  2. POST /crash/{round_id}/cashout — cash out at the current multiplier
  3. POST /crash/{round_id}/crash — round auto-crashed (no cashout)
"""

from __future__ import annotations

from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.dependencies import get_current_user, get_session
from app.games.crash import CrashEngine
from app.models.game import GameRound, GameType, RoundStatus
from app.models.user import User
from app.schemas.crash import CrashBetRequest, CrashCashoutRequest, CrashRoundResponse
from app.services.wallet_service import WalletService

router = APIRouter(prefix="/crash", tags=["Crash"])
engine = CrashEngine()

# ── Helper ──────────────────────────────────────────────────────────

def _build_response(game_round: GameRound, outcome: str, crash_mult: float | None,
                     cash_out_at: float | None, final_mult: float,
                     elapsed: float, payout: Decimal, won: bool,
                     message: str) -> CrashRoundResponse:
    return CrashRoundResponse(
        round_id=game_round.id,
        outcome=outcome,
        crash_multiplier=crash_mult,
        cash_out_at=cash_out_at,
        final_multiplier=final_mult,
        elapsed_seconds=elapsed,
        bet_amount=str(game_round.bet_amount),
        payout=str(payout),
        won=won,
        message=message,
    )

# ── Phase 1: Bet ────────────────────────────────────────────────────

@router.post("/bet", response_model=CrashRoundResponse)
async def crash_bet(
    payload: CrashBetRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Start a crash round. Generates crash point and holds bet."""
    wallet_service = WalletService(session)

    game_round = GameRound(
        user_id=user.id, game_type=GameType.CRASH,
        status=RoundStatus.INITIATED, bet_amount=payload.bet_amount,
    )
    session.add(game_round)
    await session.flush()

    try:
        await wallet_service.hold_bet(
            user_id=user.id, amount=payload.bet_amount,
            reference_id=game_round.id,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    try:
        result = await engine.play(user.id, payload.bet_amount, {
            "action": "start",
            "round_id": game_round.id,
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

    game_round.status = RoundStatus.PLAYING
    game_round.outcome_data = str(data)
    await session.flush()

    return _build_response(
        game_round, "pending", crash_mult=data["crash_multiplier"],
        cash_out_at=None, final_mult=1.0,
        elapsed=data["elapsed_seconds"], payout=Decimal("0"),
        won=False, message="🚀 Round started — cash out before it crashes!",
    )

# ── Phase 2: Cash Out ───────────────────────────────────────────────

@router.post("/{round_id}/cashout", response_model=CrashRoundResponse)
async def crash_cashout(
    round_id: str,
    payload: CrashCashoutRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Cash out at the current multiplier. Validates against cached crash point."""
    wallet_service = WalletService(session)

    # Fetch the game round
    result = await session.execute(select(GameRound).where(
        GameRound.id == round_id,
        GameRound.user_id == user.id,
    ))
    game_round = result.scalar_one_or_none()
    if not game_round:
        raise HTTPException(status_code=404, detail="Round not found")
    if game_round.is_completed:
        raise HTTPException(status_code=400, detail="Round already completed")

    bet_amount = game_round.bet_amount

    try:
        result = await engine.play(user.id, bet_amount, {
            "action": "cashout",
            "round_id": round_id,
            "cash_out_at": payload.multiplier,
        })
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    data = result.outcome_data
    won = result.won
    total_payout = Decimal(str(data["payout"]))

    # Resolve wallet
    await wallet_service.resolve_bet(
        user.id, bet_amount, won,
        payout=total_payout if won else None,
        reference_id=round_id,
    )

    # Update game round
    game_round.status = RoundStatus.COMPLETED
    game_round.payout_amount = result.payout_amount
    game_round.outcome_data = str(data)
    game_round.is_completed = True
    await session.flush()

    if data["outcome"] == "cashed_out":
        msg = f"✅ Cashed out at {payload.multiplier}x! Won ${float(total_payout):,.2f}!"
    else:
        msg = f"💥 Crashed at {data['crash_multiplier']}x!"

    return _build_response(
        game_round, data["outcome"],
        crash_mult=data.get("crash_multiplier"),
        cash_out_at=data.get("cash_out_at"),
        final_mult=data["final_multiplier"],
        elapsed=data["elapsed_seconds"],
        payout=total_payout,
        won=won,
        message=msg,
    )

# ── Phase 2b: Auto Crash ────────────────────────────────────────────

@router.post("/{round_id}/crash", response_model=CrashRoundResponse)
async def crash_auto_crash(
    round_id: str,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Trigger auto-crash when the multiplier reaches the crash point."""
    wallet_service = WalletService(session)

    result = await session.execute(select(GameRound).where(
        GameRound.id == round_id,
        GameRound.user_id == user.id,
    ))
    game_round = result.scalar_one_or_none()
    if not game_round:
        raise HTTPException(status_code=404, detail="Round not found")
    if game_round.is_completed:
        raise HTTPException(status_code=400, detail="Round already completed")

    bet_amount = game_round.bet_amount
    crash_mult = engine.get_crash_point(round_id)
    if crash_mult is None:
        raise HTTPException(status_code=400, detail="Round not found or already resolved")

    engine.forget_round(round_id)

    # Resolve as loss
    await wallet_service.resolve_bet(user.id, bet_amount, False, reference_id=round_id)

    game_round.status = RoundStatus.COMPLETED
    game_round.payout_amount = Decimal("0")
    game_round.outcome_data = str({
        "outcome": "crashed",
        "crash_multiplier": crash_mult,
        "final_multiplier": crash_mult,
        "payout": "0",
    })
    game_round.is_completed = True
    await session.flush()

    return _build_response(
        game_round, "crashed",
        crash_mult=crash_mult,
        cash_out_at=None,
        final_mult=crash_mult,
        elapsed=0.0,
        payout=Decimal("0"),
        won=False,
        message=f"💥 Crashed at {crash_mult}x!",
    )
