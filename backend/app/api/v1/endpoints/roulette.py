"""Roulette game API endpoint."""

from __future__ import annotations

from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, get_session
from app.games.roulette import RouletteEngine
from app.models.game import GameRound, GameType, RoundStatus
from app.models.user import User
from app.schemas.roulette import RouletteSpinRequest, RouletteSpinResponse
from app.services.wallet_service import WalletService

router = APIRouter(prefix="/roulette", tags=["Roulette"])

# Singleton engine instance
engine = RouletteEngine()


@router.post("/spin", response_model=RouletteSpinResponse)
async def roulette_spin(
    payload: RouletteSpinRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Place one or more bets and spin the roulette wheel."""
    wallet_service = WalletService(session)

    # Calculate total bet amount
    total_bet = sum(
        Decimal(str(b.amount)) for b in payload.bets
    )

    # Validate minimum bet per individual bet
    for b in payload.bets:
        if b.amount < Decimal("1.00"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Minimum bet is $1.00 per wager",
            )

    # Create game round in DB
    game_round = GameRound(
        user_id=user.id,
        game_type=GameType.ROULETTE,
        status=RoundStatus.INITIATED,
        bet_amount=total_bet,
    )
    session.add(game_round)
    await session.flush()

    # Hold total bet in wallet
    try:
        await wallet_service.hold_bet(
            user_id=user.id,
            amount=total_bet,
            reference_id=game_round.id,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    # Prepare bets for engine
    bets_data = [
        {
            "type": b.type,
            "amount": str(b.amount),
            "numbers": b.numbers,
        }
        for b in payload.bets
    ]

    # Spin the wheel
    try:
        result = await engine.play(
            user_id=user.id,
            bet_amount=total_bet,
            game_data={
                "round_id": game_round.id,
                "bets": bets_data,
            },
        )
    except Exception:
        await wallet_service.push_bet(user.id, total_bet, game_round.id)
        game_round.status = RoundStatus.CANCELLED
        game_round.is_completed = True
        await session.flush()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Game error. Your bet has been refunded.",
        )

    data = result.outcome_data
    total_payout = Decimal(str(data.get("total_payout", "0")))
    won = result.won

    # Resolve bet via wallet
    # For roulette: if net_result > 0 or total_payout > 0, the player won something
    if total_payout > 0:
        # Player won at least something — release hold and add payout
        await wallet_service.resolve_bet(
            user_id=user.id,
            amount=total_bet,
            won=True,
            payout=total_payout,
            reference_id=game_round.id,
        )
    else:
        # All bets lost
        await wallet_service.resolve_bet(
            user_id=user.id,
            amount=total_bet,
            won=False,
            reference_id=game_round.id,
        )

    # Update game round
    game_round.status = RoundStatus.COMPLETED
    game_round.payout_amount = result.payout_amount
    game_round.outcome_data = str(data)
    game_round.is_completed = True
    await session.flush()

    # Build response message
    msg = None
    winning_number = data["winning_number"]
    winning_color = data["winning_color"]
    net = Decimal(str(data["net_result"]))

    if won and net > 0:
        msg = f"🎉 Number {winning_number} {winning_color}! You won ${float(net):,.2f}!"
    elif won and net == 0:
        msg = f"🤝 Number {winning_number} {winning_color} — push."
    else:
        msg = f"😔 Number {winning_number} {winning_color}. Better luck next spin!"

    # Build response
    return RouletteSpinResponse(
        round_id=game_round.id,
        winning_number=winning_number,
        winning_color=winning_color,
        results=[
            {
                "type": r["type"],
                "amount": r["amount"],
                "numbers": r["numbers"],
                "won": r["won"],
                "payout_multiplier": r["payout_multiplier"],
                "payout": r["payout"],
            }
            for r in data["results"]
        ],
        total_bet=data["total_bet"],
        total_payout=data["total_payout"],
        net_result=data["net_result"],
        won=won,
        spin_history=data["spin_history"],
        message=msg,
    )
