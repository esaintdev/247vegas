"""Platform settings and game control API — maintenance, announcements, fees, live sessions."""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.dependencies import get_session, require_admin, require_permission
from app.models.game import GameRound, GameType, RoundStatus
from app.models.platform_settings import PlatformSettings
from app.models.user import User
from app.models.wallet import Wallet
from app.services.audit import log_admin_action
from pydantic import BaseModel, Field

router = APIRouter(prefix="/admin", tags=["Admin Settings"])

# Public endpoint (no auth needed) for fetching site announcements
public_router = APIRouter(tags=["Public"])


# ── Schemas ─────────────────────────────────────────────────────────

class SettingsResponse(BaseModel):
    maintenance_mode: bool = False
    maintenance_message: Optional[str] = None
    announcement_enabled: bool = False
    announcement_text: Optional[str] = None
    announcement_type: str = "info"
    min_withdrawal: str = "10.00"
    max_withdrawal: str = "5000.00"
    daily_withdrawal_limit: str = "10000.00"
    deposit_fee_percent: str = "0.00"
    withdrawal_fee_percent: str = "0.00"
    withdrawal_fee_fixed: str = "0.00"
    supported_currencies: str = "USD"
    default_currency: str = "USD"


class AnnouncementResponse(BaseModel):
    """Public announcement — no auth required."""
    enabled: bool = False
    text: Optional[str] = None
    type: str = "info"


class UpdateSettingsRequest(BaseModel):
    maintenance_mode: Optional[bool] = None
    maintenance_message: Optional[str] = None
    announcement_enabled: Optional[bool] = None
    announcement_text: Optional[str] = None
    announcement_type: Optional[str] = None
    min_withdrawal: Optional[Decimal] = None
    max_withdrawal: Optional[Decimal] = None
    daily_withdrawal_limit: Optional[Decimal] = None
    deposit_fee_percent: Optional[Decimal] = None
    withdrawal_fee_percent: Optional[Decimal] = None
    withdrawal_fee_fixed: Optional[Decimal] = None
    supported_currencies: Optional[str] = None
    default_currency: Optional[str] = None


class LiveSessionResponse(BaseModel):
    id: str
    user_id: str
    username: str
    game_type: str
    status: str
    bet_amount: str
    created_at: str
    elapsed_seconds: int = 0


class KillRoundRequest(BaseModel):
    round_id: str


# ── Public Endpoints ────────────────────────────────────────────────

@public_router.get("/settings/announcement", response_model=AnnouncementResponse)
async def get_announcement(
    session: AsyncSession = Depends(get_session),
):
    """Get the current site announcement (no auth required)."""
    result = await session.execute(select(PlatformSettings))
    rows = list(result.scalars().all())
    settings = rows[0] if rows else None
    if not settings:
        return AnnouncementResponse()
    return AnnouncementResponse(
        enabled=settings.announcement_enabled,
        text=settings.announcement_text,
        type=settings.announcement_type,
    )


# ── Helper ──────────────────────────────────────────────────────────

async def _fetch_settings(session: AsyncSession) -> PlatformSettings:
    """Fetch or create the single PlatformSettings row."""
    result = await session.execute(select(PlatformSettings))
    rows = list(result.scalars().all())
    if len(rows) > 1:
        for row in rows[1:]:
            await session.delete(row)
        await session.flush()
        rows = rows[:1]
    settings = rows[0] if rows else None
    if not settings:
        settings = PlatformSettings()
        session.add(settings)
        await session.flush()
    return settings


# ── Settings Endpoints ─────────────────────────────────────────────

@router.get("/settings", response_model=SettingsResponse)
async def get_settings(
    admin: User = Depends(require_admin),
    _: User = Depends(require_permission("read:settings")),
    session: AsyncSession = Depends(get_session),
):
    """Get platform settings. Creates default row if none exists."""
    settings = await _fetch_settings(session)
    return _settings_to_response(settings)


@router.put("/settings", response_model=SettingsResponse)
async def update_settings(
    payload: UpdateSettingsRequest,
    admin: User = Depends(require_admin),
    _: User = Depends(require_permission("write:settings")),
    session: AsyncSession = Depends(get_session),
):
    """Update platform settings."""
    settings = await _fetch_settings(session)
    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(settings, key, value)
    await log_admin_action(
        session, admin, "update_platform_settings",
        target_type="platform_settings",
        details=update_data,
    )
    await session.flush()
    return _settings_to_response(settings)


def _settings_to_response(s: PlatformSettings) -> SettingsResponse:
    return SettingsResponse(
        maintenance_mode=s.maintenance_mode,
        maintenance_message=s.maintenance_message,
        announcement_enabled=s.announcement_enabled,
        announcement_text=s.announcement_text,
        announcement_type=s.announcement_type,
        min_withdrawal=str(s.min_withdrawal),
        max_withdrawal=str(s.max_withdrawal),
        daily_withdrawal_limit=str(s.daily_withdrawal_limit),
        deposit_fee_percent=str(s.deposit_fee_percent),
        withdrawal_fee_percent=str(s.withdrawal_fee_percent),
        withdrawal_fee_fixed=str(s.withdrawal_fee_fixed),
        supported_currencies=s.supported_currencies,
        default_currency=s.default_currency,
    )


# ── Game Control Endpoints ─────────────────────────────────────────

@router.get("/live-sessions", response_model=List[LiveSessionResponse])
async def get_live_sessions(
    admin: User = Depends(require_admin),
    _: User = Depends(require_permission("read:stats")),
    session: AsyncSession = Depends(get_session),
):
    """Get all currently active (non-completed) game sessions."""
    result = await session.execute(
        select(GameRound, User.username)
        .join(User, GameRound.user_id == User.id)
        .where(GameRound.is_completed == False)
        .where(GameRound.status.in_([RoundStatus.INITIATED, RoundStatus.PLAYING]))
        .order_by(GameRound.created_at.desc())
    )
    rows = result.all()

    now = datetime.now(timezone.utc)
    sessions = []
    for row in rows:
        gr = row.GameRound
        elapsed = int((now - gr.created_at).total_seconds()) if gr.created_at else 0
        sessions.append(LiveSessionResponse(
            id=gr.id,
            user_id=gr.user_id,
            username=row.username,
            game_type=gr.game_type.value if hasattr(gr.game_type, "value") else str(gr.game_type),
            status=gr.status.value if hasattr(gr.status, "value") else str(gr.status),
            bet_amount=str(gr.bet_amount),
            created_at=gr.created_at.isoformat(),
            elapsed_seconds=elapsed,
        ))
    return sessions


@router.post("/kill-round")
async def kill_round(
    payload: KillRoundRequest,
    admin: User = Depends(require_admin),
    _: User = Depends(require_permission("gamecontrol:kill")),
    session: AsyncSession = Depends(get_session),
):
    """Force-cancel a stuck game round and refund the wallet."""
    result = await session.execute(
        select(GameRound).where(GameRound.id == payload.round_id)
    )
    game_round = result.scalar_one_or_none()
    if not game_round:
        raise HTTPException(status_code=404, detail="Game round not found")
    if game_round.is_completed:
        raise HTTPException(status_code=400, detail="Round is already completed")

    # If there's a locked bet, refund it
    if game_round.bet_amount and game_round.bet_amount > 0:
        wallet_result = await session.execute(
            select(Wallet).where(Wallet.user_id == game_round.user_id).with_for_update()
        )
        wallet = wallet_result.scalar_one_or_none()
        if wallet:
            wallet.locked_amount = max(Decimal("0"), wallet.locked_amount - game_round.bet_amount)

    game_round.status = RoundStatus.CANCELLED
    game_round.is_completed = True
    game_round.payout_amount = game_round.bet_amount  # Refund
    await log_admin_action(
        session, admin, "kill_round",
        target_type="game_round", target_id=payload.round_id,
        details={"game_type": str(game_round.game_type), "amount": str(game_round.bet_amount)},
    )
    await session.flush()

    return {
        "status": "ok",
        "message": f"Round {game_round.id[:8]} cancelled",
        "refunded_amount": str(game_round.bet_amount),
    }
