"""Baccarat game API endpoint."""

from __future__ import annotations

from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, get_session
from app.games.baccarat import BaccaratEngine
from app.models.game import GameRound, GameType, RoundStatus
from app.models.user import User
from app.schemas.baccarat import BaccaratBetRequest, BaccaratRoundResponse
from app.services.wallet_service import WalletService

router = APIRouter(prefix="/baccarat", tags=["Baccarat"])
engine = BaccaratEngine()


@router.post("/bet", response_model=BaccaratRoundResponse)
async def baccarat_bet(payload: BaccaratBetRequest, user: User = Depends(get_current_user), session: AsyncSession = Depends(get_session)):
    wallet = WalletService(session)
    game_round = GameRound(user_id=user.id, game_type=GameType.BACCARAT, status=RoundStatus.INITIATED, bet_amount=payload.bet_amount)
    session.add(game_round); await session.flush()

    try:
        await wallet.hold_bet(user.id, payload.bet_amount, game_round.id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    try:
        result = await engine.play(user.id, payload.bet_amount, {"round_id": game_round.id, "bet_type": payload.bet_type})
    except Exception:
        await wallet.push_bet(user.id, payload.bet_amount, game_round.id)
        game_round.status = RoundStatus.CANCELLED
        game_round.is_completed = True
        await session.flush()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Game error. Your bet has been refunded.",
        )
    data = result.outcome_data
    payout = Decimal(str(data["payout"]))
    won = result.won

    if data["outcome"] == "tie" and payload.bet_type in ("player", "banker"):
        await wallet.push_bet(user.id, payload.bet_amount, game_round.id)
    elif won:
        await wallet.resolve_bet(user.id, payload.bet_amount, True, payout=payout, reference_id=game_round.id)
    else:
        await wallet.resolve_bet(user.id, payload.bet_amount, False, reference_id=game_round.id)

    game_round.status = RoundStatus.COMPLETED
    game_round.payout_amount = result.payout_amount
    game_round.outcome_data = str(data)
    game_round.is_completed = True
    await session.flush()

    msg = f"{'🎉' if won else '😔'} {data['outcome'].title()} wins {data['player_score']}-{data['banker_score']}!"
    if data["outcome"] == "tie" and payload.bet_type in ("player", "banker"):
        msg = f"🤝 Tie — bet returned."
    if data["natural"]:
        msg += " (Natural)"

    return BaccaratRoundResponse(
        round_id=game_round.id, outcome=data["outcome"],
        player_cards=data["player_cards"], banker_cards=data["banker_cards"],
        player_score=data["player_score"], banker_score=data["banker_score"],
        player_third=data["player_third"], banker_third=data["banker_third"],
        natural=data["natural"], bet_type=data["bet_type"],
        payout=str(payout), won=won, message=msg,
    )
