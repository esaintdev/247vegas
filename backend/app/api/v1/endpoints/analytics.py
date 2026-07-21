"""Analytics API — extended platform monitoring and trends."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, extract
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_session, require_admin
from app.models.game import GameRound, GameType
from app.models.user import User
from app.models.wallet import Transaction
from pydantic import BaseModel

router = APIRouter(prefix="/analytics", tags=["Analytics"])


# ── Schemas ─────────────────────────────────────────────────────────

class DailyRevenuePoint(BaseModel):
    """Revenue for a single day."""
    date: str
    deposits: str
    withdrawals: str
    bets: str
    wins: str
    revenue: str
    games_played: int


class GamePopularity(BaseModel):
    """Play counts per game."""
    game_type: str
    total_rounds: int
    unique_players: int
    total_bet: str
    total_payout: str
    rtp: str


class UserGrowthPoint(BaseModel):
    """User registrations for a period."""
    date: str
    registrations: int
    total_users: int


class ActiveUsersResponse(BaseModel):
    """Active user counts."""
    last_hour: int
    last_24h: int
    last_7d: int
    last_30d: int


# ── Endpoints ──────────────────────────────────────────────────────

@router.get("/revenue-trends", response_model=List[DailyRevenuePoint])
async def get_revenue_trends(
    days: int = Query(default=30, ge=1, le=365),
    admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    """Get daily revenue trends for the last N days."""
    since = datetime.now(timezone.utc) - timedelta(days=days)
    results = []

    for day_offset in range(days, 0, -1):
        day = datetime.now(timezone.utc) - timedelta(days=day_offset)
        day_start = day.replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)

        # Deposits
        dep = await session.scalar(
            select(func.coalesce(func.sum(Transaction.amount), 0))
            .where(
                Transaction.type == "deposit",
                Transaction.status == "completed",
                Transaction.created_at >= day_start,
                Transaction.created_at < day_end,
            )
        ) or Decimal("0")

        # Withdrawals
        wth = await session.scalar(
            select(func.coalesce(func.sum(Transaction.amount), 0))
            .where(
                Transaction.type == "withdrawal",
                Transaction.status == "completed",
                Transaction.created_at >= day_start,
                Transaction.created_at < day_end,
            )
        ) or Decimal("0")

        # Bets
        bets = await session.scalar(
            select(func.coalesce(func.sum(Transaction.amount), 0))
            .where(
                Transaction.type == "bet",
                Transaction.created_at >= day_start,
                Transaction.created_at < day_end,
            )
        ) or Decimal("0")

        # Wins
        wins = await session.scalar(
            select(func.coalesce(func.sum(Transaction.amount), 0))
            .where(
                Transaction.type == "win",
                Transaction.created_at >= day_start,
                Transaction.created_at < day_end,
            )
        ) or Decimal("0")

        # Games played
        games = await session.scalar(
            select(func.count(GameRound.id))
            .where(
                GameRound.created_at >= day_start,
                GameRound.created_at < day_end,
            )
        ) or 0

        revenue = bets - wins

        results.append(DailyRevenuePoint(
            date=day_start.strftime("%Y-%m-%d"),
            deposits=str(dep),
            withdrawals=str(wth),
            bets=str(bets),
            wins=str(wins),
            revenue=str(revenue),
            games_played=games,
        ))

    return results


@router.get("/game-popularity", response_model=List[GamePopularity])
async def get_game_popularity(
    days: int = Query(default=30, ge=1, le=365),
    admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    """Get play counts per game for the last N days."""
    since = datetime.now(timezone.utc) - timedelta(days=days)
    results = []

    for game_type in GameType:
        result = await session.execute(
            select(
                func.count(GameRound.id),
                func.count(func.distinct(GameRound.user_id)),
                func.coalesce(func.sum(GameRound.bet_amount), 0),
                func.coalesce(func.sum(GameRound.payout_amount), 0),
            ).where(
                GameRound.game_type == game_type,
                GameRound.created_at >= since,
                GameRound.is_completed == True,
            )
        )
        row = result.one()
        total_rounds = row[0] or 0
        unique_players = row[1] or 0
        total_bet = row[2] or Decimal("0")
        total_payout = row[3] or Decimal("0")
        rtp = (total_payout / total_bet * 100) if total_bet > 0 else Decimal("0")

        results.append(GamePopularity(
            game_type=game_type.value,
            total_rounds=total_rounds,
            unique_players=unique_players,
            total_bet=str(total_bet),
            total_payout=str(total_payout),
            rtp=f"{float(rtp):.2f}%",
        ))

    return results


@router.get("/user-growth", response_model=List[UserGrowthPoint])
async def get_user_growth(
    days: int = Query(default=30, ge=1, le=365),
    admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    """Get user registration growth day by day."""
    total_result = await session.scalar(
        select(func.count(User.id))
    ) or 0

    results = []
    for day_offset in range(days, 0, -1):
        day = datetime.now(timezone.utc) - timedelta(days=day_offset)
        day_start = day.replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)

        registrations = await session.scalar(
            select(func.count(User.id))
            .where(
                User.created_at >= day_start,
                User.created_at < day_end,
            )
        ) or 0

        # Total users up to this day
        total = await session.scalar(
            select(func.count(User.id))
            .where(User.created_at < day_end)
        ) or 0

        results.append(UserGrowthPoint(
            date=day_start.strftime("%Y-%m-%d"),
            registrations=registrations,
            total_users=total,
        ))

    return results


@router.get("/active-users", response_model=ActiveUsersResponse)
async def get_active_users(
    admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    """Get active user counts across time windows."""
    now = datetime.now(timezone.utc)

    # Active users in the last hour (based on game rounds)
    hour_ago = now - timedelta(hours=1)
    last_hour = await session.scalar(
        select(func.count(func.distinct(GameRound.user_id)))
        .where(GameRound.created_at >= hour_ago)
    ) or 0

    # Last 24 hours
    day_ago = now - timedelta(days=1)
    last_24h = await session.scalar(
        select(func.count(func.distinct(GameRound.user_id)))
        .where(GameRound.created_at >= day_ago)
    ) or 0

    # Last 7 days
    week_ago = now - timedelta(days=7)
    last_7d = await session.scalar(
        select(func.count(func.distinct(GameRound.user_id)))
        .where(GameRound.created_at >= week_ago)
    ) or 0

    # Last 30 days
    month_ago = now - timedelta(days=30)
    last_30d = await session.scalar(
        select(func.count(func.distinct(GameRound.user_id)))
        .where(GameRound.created_at >= month_ago)
    ) or 0

    return ActiveUsersResponse(
        last_hour=last_hour,
        last_24h=last_24h,
        last_7d=last_7d,
        last_30d=last_30d,
    )
