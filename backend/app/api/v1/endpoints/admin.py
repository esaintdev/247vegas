"""Admin dashboard API — player management, transactions, game stats."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.dependencies import get_session, require_admin, require_permission
from app.models.game import GameConfig, GameRound, GameType, RoundStatus
from app.models.notification import Notification
from app.models.user import User
from app.models.wallet import Transaction, TransactionStatus, Wallet as WalletModel
from app.schemas.user import UserResponse
from app.services.audit import AuditLogEntryResponse, get_audit_logs, log_admin_action
from app.services.provably_fair import ProvablyFairService
from app.services.withdrawal import WithdrawalService, WithdrawalError
from pydantic import BaseModel, Field, field_serializer

router = APIRouter(prefix="/admin", tags=["Admin"])


# ── Schemas ─────────────────────────────────────────────────────────

class AdminStats(BaseModel):
    total_users: int
    active_users: int
    total_deposits: str
    total_withdrawals: str
    total_bets: str
    total_wins: str
    platform_revenue: str
    games_played: int
    pending_withdrawals: int
    pending_withdrawal_amount: str


class UserDetailResponse(UserResponse):
    wallet_balance: str = "0.00"
    wallet_locked: str = "0.00"
    transaction_count: int = 0
    game_count: int = 0


class GameStats(BaseModel):
    game_type: str
    total_rounds: int
    total_bet: str
    total_payout: str
    rtp: str  # Return to Player percentage


class AdminTransactionResponse(BaseModel):
    id: str
    user_email: str
    user_username: str
    type: str
    status: str
    amount: str
    description: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Dependencies ────────────────────────────────────────────────────

# Uses require_admin from app.core.dependencies


# ── Endpoints ───────────────────────────────────────────────────────

@router.get("/stats", response_model=AdminStats)
async def get_admin_stats(
    admin: User = Depends(require_admin),
    _: User = Depends(require_permission("read:stats")),
    session: AsyncSession = Depends(get_session),
):
    """Get platform-wide statistics."""
    # Total users
    result = await session.execute(select(func.count(User.id)))
    total_users = result.scalar() or 0

    result = await session.execute(
        select(func.count(User.id)).where(User.is_active == True)
    )
    active_users = result.scalar() or 0

    # Deposits
    result = await session.execute(
        select(func.coalesce(func.sum(Transaction.amount), 0))
        .where(Transaction.type == "deposit", Transaction.status == "completed")
    )
    total_deposits = result.scalar() or Decimal("0")

    # Withdrawals
    result = await session.execute(
        select(func.coalesce(func.sum(Transaction.amount), 0))
        .where(Transaction.type == "withdrawal", Transaction.status == "completed")
    )
    total_withdrawals = result.scalar() or Decimal("0")

    # Total bets (losses)
    result = await session.execute(
        select(func.coalesce(func.sum(Transaction.amount), 0))
        .where(Transaction.type == "bet", Transaction.status.isnot(None))
    )
    total_bets = result.scalar() or Decimal("0")

    # Total wins
    result = await session.execute(
        select(func.coalesce(func.sum(Transaction.amount), 0))
        .where(Transaction.type == "win", Transaction.status.isnot(None))
    )
    total_wins = result.scalar() or Decimal("0")

    # Platform revenue = bets - wins
    revenue = total_bets - total_wins

    # Games played
    result = await session.execute(select(func.count(GameRound.id)))
    games_played = result.scalar() or 0

    # Pending withdrawals
    result = await session.execute(
        select(func.count(Transaction.id))
        .where(Transaction.type == "withdrawal", Transaction.status == "pending")
    )
    pending_count = result.scalar() or 0

    result = await session.execute(
        select(func.coalesce(func.sum(Transaction.amount), 0))
        .where(Transaction.type == "withdrawal", Transaction.status == "pending")
    )
    pending_amount = result.scalar() or Decimal("0")

    return AdminStats(
        total_users=total_users,
        active_users=active_users,
        total_deposits=str(total_deposits),
        total_withdrawals=str(total_withdrawals),
        total_bets=str(total_bets),
        total_wins=str(total_wins),
        platform_revenue=str(revenue),
        games_played=games_played,
        pending_withdrawals=pending_count,
        pending_withdrawal_amount=str(pending_amount),
    )


@router.get("/users", response_model=List[UserDetailResponse])
async def list_users(
    search: Optional[str] = Query(None, max_length=100),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    admin: User = Depends(require_admin),
    _: User = Depends(require_permission("read:users")),
    session: AsyncSession = Depends(get_session),
):
    """List all users with wallet info."""
    query = select(User).options(selectinload(User.wallet))

    if search:
        query = query.where(
            User.email.ilike(f"%{search}%") | User.username.ilike(f"%{search}%")
        )

    query = query.order_by(User.created_at.desc()).offset((page - 1) * limit).limit(limit)
    result = await session.execute(query)
    users = result.scalars().all()

    response = []
    for user in users:
        # Count transactions
        tx_count = await session.scalar(
            select(func.count(Transaction.id)).where(Transaction.user_id == user.id)
        )
        game_count = await session.scalar(
            select(func.count(GameRound.id)).where(GameRound.user_id == user.id)
        )
        balance = "0.00"
        locked = "0.00"
        if user.wallet:
            balance = str(user.wallet.balance)
            locked = str(user.wallet.locked_amount)

        response.append(UserDetailResponse(
            id=user.id, email=user.email, username=user.username,
            display_name=user.display_name, is_active=user.is_active,
            is_verified=user.is_verified, created_at=user.created_at,
            updated_at=user.updated_at,
            last_login_at=user.last_login_at, last_login_ip=user.last_login_ip,
            wallet_balance=balance, wallet_locked=locked,
            transaction_count=tx_count or 0, game_count=game_count or 0,
        ))
    return response


@router.get("/users/{user_id}", response_model=UserDetailResponse)
async def get_user_detail(
    user_id: str,
    admin: User = Depends(require_admin),
    _: User = Depends(require_permission("read:users")),
    session: AsyncSession = Depends(get_session),
):
    """Get detailed info about a specific user."""
    result = await session.execute(
        select(User).options(selectinload(User.wallet)).where(User.id == user_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    tx_count = await session.scalar(
        select(func.count(Transaction.id)).where(Transaction.user_id == user.id)
    ) or 0
    game_count = await session.scalar(
        select(func.count(GameRound.id)).where(GameRound.user_id == user.id)
    ) or 0
    balance = str(user.wallet.balance) if user.wallet else "0.00"
    locked = str(user.wallet.locked_amount) if user.wallet else "0.00"

    return UserDetailResponse(
        id=user.id, email=user.email, username=user.username,
        display_name=user.display_name, is_active=user.is_active,
        is_verified=user.is_verified, created_at=user.created_at,
        updated_at=user.updated_at,
        last_login_at=user.last_login_at, last_login_ip=user.last_login_ip,
        wallet_balance=balance, wallet_locked=locked,
        transaction_count=tx_count, game_count=game_count,
    )


@router.post("/users/{user_id}/toggle-active")
async def toggle_user_active(
    user_id: str,
    admin: User = Depends(require_admin),
    _: User = Depends(require_permission("write:users")),
    session: AsyncSession = Depends(get_session),
):
    """Suspend or reactivate a user account."""
    result = await session.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if user.is_admin:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot suspend admin")
    user.is_active = not user.is_active
    await log_admin_action(
        session, admin, "user_toggle_active",
        target_type="user", target_id=user_id,
        details={"is_active": user.is_active},
    )
    await session.flush()
    return {"status": "ok", "is_active": user.is_active}


@router.get("/transactions", response_model=List[AdminTransactionResponse])
async def list_transactions(
    type_filter: Optional[str] = Query(None, alias="type"),
    status_filter: Optional[str] = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    admin: User = Depends(require_admin),
    _: User = Depends(require_permission("read:transactions")),
    session: AsyncSession = Depends(get_session),
):
    """List all platform transactions with user details."""
    query = select(Transaction, User.email, User.username).join(
        User, Transaction.user_id == User.id
    )

    if type_filter:
        query = query.where(Transaction.type == type_filter)
    if status_filter:
        query = query.where(Transaction.status == status_filter)

    query = query.order_by(Transaction.created_at.desc()).offset((page - 1) * limit).limit(limit)
    result = await session.execute(query)
    rows = result.all()

    return [
        AdminTransactionResponse(
            id=row.Transaction.id,
            user_email=row.email,
            user_username=row.username,
            type=row.Transaction.type.value
                if hasattr(row.Transaction.type, "value") else str(row.Transaction.type),
            status=row.Transaction.status.value
                if hasattr(row.Transaction.status, "value") else str(row.Transaction.status),
            amount=str(row.Transaction.amount),
            description=row.Transaction.description,
            created_at=row.Transaction.created_at,
        )
        for row in rows
    ]


@router.get("/games", response_model=List[GameStats])
async def get_game_stats(
    admin: User = Depends(require_admin),
    _: User = Depends(require_permission("read:games")),
    session: AsyncSession = Depends(get_session),
):
    """Get per-game statistics including RTP."""
    results = []
    for game_type in GameType:
        result = await session.execute(
            select(
                func.count(GameRound.id),
                func.coalesce(func.sum(GameRound.bet_amount), 0),
                func.coalesce(func.sum(GameRound.payout_amount), 0),
            ).where(
                GameRound.game_type == game_type,
                GameRound.is_completed == True,
            )
        )
        row = result.one()
        total_rounds = row[0] or 0
        total_bet = row[1] or Decimal("0")
        total_payout = row[2] or Decimal("0")
        rtp = (total_payout / total_bet * 100) if total_bet > 0 else Decimal("0")

        results.append(GameStats(
            game_type=game_type.value,
            total_rounds=total_rounds,
            total_bet=str(total_bet),
            total_payout=str(total_payout),
            rtp=f"{float(rtp):.2f}%",
        ))
    return results


@router.post("/transactions/{tx_id}/approve")
async def approve_withdrawal(
    tx_id: str,
    admin: User = Depends(require_admin),
    _: User = Depends(require_permission("write:transactions")),
    session: AsyncSession = Depends(get_session),
):
    """Approve a pending withdrawal — initiates Flutterwave bank transfer."""
    service = WithdrawalService(session)
    try:
        result = await service.approve_withdrawal(tx_id, admin)
        await log_admin_action(
            session, admin, "approve_withdrawal",
            target_type="transaction", target_id=tx_id,
            details={"status": result.get("status")},
        )
        return result
    except WithdrawalError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/transactions/{tx_id}/cancel")
async def cancel_withdrawal(
    tx_id: str,
    admin: User = Depends(require_admin),
    _: User = Depends(require_permission("write:transactions")),
    session: AsyncSession = Depends(get_session),
):
    """Cancel a pending withdrawal and refund the wallet."""
    service = WithdrawalService(session)
    try:
        result = await service.cancel_withdrawal(tx_id, admin)
        await log_admin_action(
            session, admin, "cancel_withdrawal",
            target_type="transaction", target_id=tx_id,
        )
        return result
    except WithdrawalError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


class GameSettingsResponse(BaseModel):
    game_type: str
    min_bet: Decimal
    max_bet: Decimal
    default_bet: Decimal
    rtp_adjustment: Decimal
    is_active: bool

    model_config = {"from_attributes": True}

    @field_serializer("min_bet", "max_bet", "default_bet", "rtp_adjustment")
    @classmethod
    def serialize_decimal(cls, v: Decimal) -> str:
        return str(v)


class UpdateGameSettingsRequest(BaseModel):
    min_bet: Optional[Decimal] = None
    max_bet: Optional[Decimal] = None
    default_bet: Optional[Decimal] = None
    rtp_adjustment: Optional[Decimal] = None
    is_active: Optional[bool] = None


class WalletAdjustRequest(BaseModel):
    amount: Decimal = Field(..., gt=0, decimal_places=2, description="Positive amount to credit or debit")
    type: str = Field(..., pattern="^(credit|debit)$", description="credit or debit")
    reason: str = Field(..., min_length=1, max_length=500, description="Reason logged in transaction history")


class WalletFreezeRequest(BaseModel):
    is_frozen: bool


class UserFullDetailResponse(BaseModel):
    """Full user profile with wallet, recent games, recent transactions, and stats."""
    id: str
    email: str
    username: str
    display_name: str
    is_active: bool
    is_verified: bool
    is_admin: bool
    created_at: datetime
    updated_at: datetime
    last_login_at: Optional[datetime] = None
    last_login_ip: Optional[str] = None
    # Wallet
    wallet_balance: str = "0.00"
    wallet_locked: str = "0.00"
    wallet_bonus: str = "0.00"
    wallet_currency: str = "USD"
    wallet_is_active: bool = True
    # Stats
    total_deposits: str = "0.00"
    total_withdrawals: str = "0.00"
    total_bets: str = "0.00"
    total_wins: str = "0.00"
    net_pl: str = "0.00"  # Net profit/loss = wins - bets
    total_games_played: int = 0
    # Recent activity (last 50)
    recent_transactions: List[AdminTransactionResponse] = []
    recent_game_rounds: List[dict] = []


class BulkApproveRequest(BaseModel):
    tx_ids: List[str]


@router.get("/game-settings", response_model=List[GameSettingsResponse])
async def get_game_settings(
    admin: User = Depends(require_admin),
    _: User = Depends(require_permission("read:settings")),
    session: AsyncSession = Depends(get_session),
):
    """Get configuration for all games."""
    # Ensure a config row exists for every game type
    for gt in GameType:
        existing = await session.execute(
            select(GameConfig).where(GameConfig.game_type == gt)
        )
        if not existing.scalar_one_or_none():
            session.add(GameConfig(game_type=gt))
    await session.flush()

    result = await session.execute(select(GameConfig).order_by(GameConfig.game_type))
    configs = result.scalars().all()
    return configs


@router.put("/game-settings/{game_type}", response_model=GameSettingsResponse)
async def update_game_settings(
    game_type: str,
    payload: UpdateGameSettingsRequest,
    admin: User = Depends(require_admin),
    _: User = Depends(require_permission("write:settings")),
    session: AsyncSession = Depends(get_session),
):
    """Update configuration for a specific game."""
    result = await session.execute(
        select(GameConfig).where(GameConfig.game_type == game_type)
    )
    config = result.scalar_one_or_none()
    if not config:
        raise HTTPException(status_code=404, detail="Game not found")

    if payload.min_bet is not None:
        config.min_bet = payload.min_bet
    if payload.max_bet is not None:
        config.max_bet = payload.max_bet
    if payload.default_bet is not None:
        config.default_bet = payload.default_bet
    if payload.rtp_adjustment is not None:
        config.rtp_adjustment = payload.rtp_adjustment
    if payload.is_active is not None:
        config.is_active = payload.is_active

    await log_admin_action(
        session, admin, "update_game_settings",
        target_type="game_config", target_id=game_type,
        details=payload.model_dump(exclude_unset=True),
    )
    await session.flush()
    return config


# ── Wallet Management ──────────────────────────────────────────────

@router.post("/wallet/{user_id}/adjust")
async def adjust_wallet(
    user_id: str,
    payload: WalletAdjustRequest,
    admin: User = Depends(require_admin),
    _: User = Depends(require_permission("wallet:adjust")),
    session: AsyncSession = Depends(get_session),
):
    """Manually credit or debit a user's wallet (for bonuses, corrections, chargebacks)."""
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot adjust your own wallet")
    result = await session.execute(
        select(WalletModel).where(WalletModel.user_id == user_id).with_for_update()
    )
    wallet = result.scalar_one_or_none()
    if not wallet:
        raise HTTPException(status_code=404, detail="Wallet not found")

    balance_before = wallet.balance

    if payload.type == "credit":
        wallet.balance += payload.amount
        tx_type = TransactionType.ADJUSTMENT
        status = TransactionStatus.COMPLETED
        desc = f"Admin credit: {payload.reason}"
    else:  # debit
        if wallet.available_balance < payload.amount:
            raise HTTPException(status_code=400, detail="Insufficient available balance")
        wallet.balance -= payload.amount
        tx_type = TransactionType.ADJUSTMENT
        status = TransactionStatus.COMPLETED
        desc = f"Admin debit: {payload.reason}"

    tx = Transaction(
        wallet_id=wallet.id,
        user_id=user_id,
        type=tx_type,
        status=status,
        amount=payload.amount,
        balance_before=balance_before,
        balance_after=wallet.balance,
        description=desc,
        reference_id=f"admin_{admin.id[:8]}",
    )
    session.add(tx)
    await log_admin_action(
        session, admin, "wallet_adjust",
        target_type="wallet", target_id=user_id,
        details={"type": payload.type, "amount": str(payload.amount), "reason": payload.reason},
    )
    await session.flush()

    return {
        "status": "ok",
        "type": payload.type,
        "amount": str(payload.amount),
        "balance_before": str(balance_before),
        "balance_after": str(wallet.balance),
        "description": desc,
    }


@router.post("/wallet/{user_id}/freeze")
async def toggle_wallet_freeze(
    user_id: str,
    payload: WalletFreezeRequest,
    admin: User = Depends(require_admin),
    _: User = Depends(require_permission("wallet:freeze")),
    session: AsyncSession = Depends(get_session),
):
    """Freeze or unfreeze a user's wallet."""
    result = await session.execute(
        select(WalletModel).where(WalletModel.user_id == user_id)
    )
    wallet = result.scalar_one_or_none()
    if not wallet:
        raise HTTPException(status_code=404, detail="Wallet not found")

    wallet.is_active = not payload.is_frozen
    await log_admin_action(
        session, admin, "wallet_freeze",
        target_type="wallet", target_id=user_id,
        details={"is_frozen": payload.is_frozen},
    )
    await session.flush()

    return {
        "status": "ok",
        "is_frozen": not wallet.is_active,
        "wallet_is_active": wallet.is_active,
    }


# ── User Detail ────────────────────────────────────────────────────

@router.get("/users/{user_id}/detail", response_model=UserFullDetailResponse)
async def get_user_full_detail(
    user_id: str,
    admin: User = Depends(require_admin),
    _: User = Depends(require_permission("read:users")),
    session: AsyncSession = Depends(get_session),
):
    """Get full user detail — profile, wallet, recent games, transactions, and stats."""
    result = await session.execute(
        select(User).options(selectinload(User.wallet)).where(User.id == user_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    wallet = user.wallet
    
    # Financial stats
    dep = await session.scalar(
        select(func.coalesce(func.sum(Transaction.amount), 0))
        .where(Transaction.user_id == user_id, Transaction.type == "deposit", Transaction.status == "completed")
    ) or Decimal("0")
    wth = await session.scalar(
        select(func.coalesce(func.sum(Transaction.amount), 0))
        .where(Transaction.user_id == user_id, Transaction.type == "withdrawal", Transaction.status == "completed")
    ) or Decimal("0")
    bets = await session.scalar(
        select(func.coalesce(func.sum(Transaction.amount), 0))
        .where(Transaction.user_id == user_id, Transaction.type == "bet")
    ) or Decimal("0")
    wins = await session.scalar(
        select(func.coalesce(func.sum(Transaction.amount), 0))
        .where(Transaction.user_id == user_id, Transaction.type == "win")
    ) or Decimal("0")
    net_pl = wins - bets
    
    game_count = await session.scalar(
        select(func.count(GameRound.id)).where(GameRound.user_id == user_id)
    ) or 0

    # Recent transactions
    tx_result = await session.execute(
        select(Transaction)
        .where(Transaction.user_id == user_id)
        .order_by(Transaction.created_at.desc())
        .limit(50)
    )
    recent_txs = []
    for tx in tx_result.scalars().all():
        recent_txs.append(AdminTransactionResponse(
            id=tx.id,
            user_email=user.email,
            user_username=user.username,
            type=tx.type.value if hasattr(tx.type, "value") else str(tx.type),
            status=tx.status.value if hasattr(tx.status, "value") else str(tx.status),
            amount=str(tx.amount),
            description=tx.description,
            created_at=tx.created_at,
        ))

    # Recent game rounds
    gr_result = await session.execute(
        select(GameRound)
        .where(GameRound.user_id == user_id)
        .order_by(GameRound.created_at.desc())
        .limit(50)
    )
    recent_games = []
    for gr in gr_result.scalars().all():
        recent_games.append({
            "id": gr.id,
            "game_type": gr.game_type.value if hasattr(gr.game_type, "value") else str(gr.game_type),
            "status": gr.status.value if hasattr(gr.status, "value") else str(gr.status),
            "bet_amount": str(gr.bet_amount),
            "payout_amount": str(gr.payout_amount) if gr.payout_amount else None,
            "is_completed": gr.is_completed,
            "created_at": gr.created_at.isoformat(),
        })

    return UserFullDetailResponse(
        id=user.id, email=user.email, username=user.username,
        display_name=user.display_name, is_active=user.is_active,
        is_verified=user.is_verified, is_admin=user.is_admin,
        created_at=user.created_at, updated_at=user.updated_at,
        last_login_at=user.last_login_at, last_login_ip=user.last_login_ip,
        wallet_balance=str(wallet.balance) if wallet else "0.00",
        wallet_locked=str(wallet.locked_amount) if wallet else "0.00",
        wallet_bonus=str(wallet.bonus_balance) if wallet else "0.00",
        wallet_currency=wallet.currency if wallet else "USD",
        wallet_is_active=wallet.is_active if wallet else True,
        total_deposits=str(dep), total_withdrawals=str(wth),
        total_bets=str(bets), total_wins=str(wins),
        net_pl=str(net_pl), total_games_played=game_count,
        recent_transactions=recent_txs,
        recent_game_rounds=recent_games,
    )


@router.post("/transactions/bulk-approve")
async def bulk_approve_withdrawals(
    payload: BulkApproveRequest,
    admin: User = Depends(require_admin),
    _: User = Depends(require_permission("write:transactions")),
    session: AsyncSession = Depends(get_session),
):
    """Approve multiple pending withdrawals at once."""
    service = WithdrawalService(session)
    result = await service.approve_bulk(payload.tx_ids, admin)
    await log_admin_action(
        session, admin, "bulk_approve_withdrawals",
        target_type="transaction",
        details={"count": len(payload.tx_ids), "processed": len(result.get("processed", [])), "failed": len(result.get("failed", []))},
    )
    return result


# ── Audit Log ───────────────────────────────────────────────────────

@router.get("/audit-log", response_model=List[AuditLogEntryResponse])
async def list_audit_logs(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    action: Optional[str] = Query(None, max_length=50),
    admin_id: Optional[str] = Query(None, max_length=36),
    admin: User = Depends(require_admin),
    _: User = Depends(require_permission("read:audit")),
    session: AsyncSession = Depends(get_session),
):
    """Get audit log entries — track every admin action."""
    return await get_audit_logs(
        session, limit=limit, offset=offset,
        action_filter=action, admin_id_filter=admin_id,
    )


# ── Admin Role Management ───────────────────────────────────────────

class AdminUserResponse(BaseModel):
    """Admin user info for role management."""
    id: str
    username: str
    email: str
    admin_role: Optional[str] = None
    is_active: bool
    created_at: datetime


class UpdateAdminRoleRequest(BaseModel):
    admin_role: Optional[str] = Field(None, description="New role: super_admin, manager, support, finance, or null to demote")


@router.get("/admins", response_model=List[AdminUserResponse])
async def list_admins(
    admin: User = Depends(require_admin),
    _: User = Depends(require_permission("admin:roles")),
    session: AsyncSession = Depends(get_session),
):
    """List all admin users with their roles."""
    result = await session.execute(
        select(User).where(User.is_admin == True).order_by(User.created_at.asc())
    )
    admins = result.scalars().all()
    return [
        AdminUserResponse(
            id=u.id, username=u.username, email=u.email,
            admin_role=u.admin_role, is_active=u.is_active,
            created_at=u.created_at,
        )
        for u in admins
    ]


@router.put("/users/{user_id}/role")
async def update_admin_role(
    user_id: str,
    payload: UpdateAdminRoleRequest,
    admin: User = Depends(require_admin),
    _: User = Depends(require_permission("admin:roles")),
    session: AsyncSession = Depends(get_session),
):
    """Update a user's admin role. Set to null to demote from admin."""
    result = await session.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Can't modify own role
    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot modify your own role")

    old_role = user.admin_role or "super_admin"
    user.admin_role = payload.admin_role
    user.is_admin = payload.admin_role is not None

    await log_admin_action(
        session, admin, "update_admin_role",
        target_type="user", target_id=user_id,
        details={"old_role": old_role, "new_role": payload.admin_role},
    )
    await session.flush()

    return {
        "status": "ok",
        "user_id": user_id,
        "admin_role": user.admin_role,
        "is_admin": user.is_admin,
    }


# ── Admin Notification Send ─────────────────────────────────────────

class SendNotificationRequest(BaseModel):
    user_id: str = Field(..., description="Target user ID or 'ALL' for broadcast")
    title: str = Field(..., min_length=1, max_length=200)
    message: str = Field(..., min_length=1, max_length=2000)
    type: str = Field(default="system", max_length=50)
    link: Optional[str] = Field(None, max_length=500)


@router.post("/notifications/send")
async def send_admin_notification(
    payload: SendNotificationRequest,
    admin: User = Depends(require_admin),
    _: User = Depends(require_permission("write:notifications")),
    session: AsyncSession = Depends(get_session),
):
    """Send a notification to a specific user or broadcast to all users."""
    sent_count = 0

    if payload.user_id.upper() == "ALL":
        # Broadcast to all users
        result = await session.execute(select(User).where(User.is_active == True))
        users = result.scalars().all()
        for target_user in users:
            notif = Notification(
                user_id=target_user.id,
                type=payload.type,
                title=payload.title,
                message=payload.message,
                link=payload.link,
            )
            session.add(notif)
            sent_count += 1
    else:
        # Single user
        result = await session.execute(select(User).where(User.id == payload.user_id))
        target_user = result.scalar_one_or_none()
        if not target_user:
            raise HTTPException(status_code=404, detail="User not found")
        notif = Notification(
            user_id=target_user.id,
            type=payload.type,
            title=payload.title,
            message=payload.message,
            link=payload.link,
        )
        session.add(notif)
        sent_count = 1

    await log_admin_action(
        session, admin, "send_notification",
        target_type="notification",
        details={"count": sent_count, "type": payload.type, "title": payload.title},
    )
    await session.flush()

    return {
        "status": "ok",
        "sent_count": sent_count,
        "message": f"Notification sent to {sent_count} user(s)",
    }


# ── Provably Fair Verification ────────────────────────────────────────

class VerifyRoundRequest(BaseModel):
    round_id: str = Field(..., description="Game round ID to verify")


class RoundSeedInfo(BaseModel):
    """Seed and hash info for a round."""
    round_id: str
    game_type: str
    server_seed: Optional[str] = None
    server_seed_hash: Optional[str] = None
    client_seed: Optional[str] = None
    nonce: int = 0
    is_completed: bool = False
    has_seeds: bool = False


@router.post("/fairness/verify-round")
async def verify_round_fairness(
    payload: VerifyRoundRequest,
    admin: User = Depends(require_admin),
    _: User = Depends(require_permission("fairness:read")),
    session: AsyncSession = Depends(get_session),
):
    """Verify the provable fairness of a completed game round.

    Returns the round's seeds + hash and whether the hash matches the revealed seed.
    """
    result = await session.execute(
        select(GameRound).where(GameRound.id == payload.round_id)
    )
    game_round = result.scalar_one_or_none()
    if not game_round:
        raise HTTPException(status_code=404, detail="Game round not found")

    # Return seed info even if incomplete — let the frontend show appropriate state
    seed_info = RoundSeedInfo(
        round_id=game_round.id,
        game_type=game_round.game_type.value if hasattr(game_round.game_type, "value") else str(game_round.game_type),
        server_seed=game_round.server_seed,
        server_seed_hash=game_round.seed_hash,
        client_seed=game_round.client_seed,
        nonce=game_round.nonce,
        is_completed=game_round.is_completed,
        has_seeds=game_round.seed_hash is not None,
    )

    if not seed_info.has_seeds:
        return {
            "has_seeds": False,
            "seed_info": seed_info.model_dump(),
            "verification": None,
            "message": "This round has no provably fair seeds. It was played before seed tracking was implemented.",
        }

    if not seed_info.server_seed:
        return {
            "has_seeds": True,
            "seed_info": seed_info.model_dump(),
            "verification": None,
            "message": "Server seed not yet revealed. Seeds are revealed after the round completes. This round may still be in progress." if not game_round.is_completed
                else "Server seed is missing for a completed round. This may indicate an error.",
        }

    # Perform verification
    verification = ProvablyFairService.verify_round(
        round_id=game_round.id,
        game_type=seed_info.game_type,
        server_seed=seed_info.server_seed,
        server_seed_hash=seed_info.server_seed_hash or "",
        client_seed=seed_info.client_seed,
        nonce=seed_info.nonce,
    )

    return {
        "has_seeds": True,
        "seed_info": seed_info.model_dump(),
        "verification": verification.model_dump(),
        "message": verification.message,
    }
