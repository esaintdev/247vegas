"""Bonus management API — create, update, issue bonuses from admin panel."""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.dependencies import get_session, require_admin, require_permission
from app.models.bonus import Bonus, BonusStatus, BonusType, UserBonus
from app.models.user import User
from app.models.wallet import Transaction, TransactionStatus, TransactionType, Wallet
from app.services.audit import log_admin_action
from pydantic import BaseModel, Field

router = APIRouter(prefix="/admin/bonuses", tags=["Admin Bonuses"])


# ── Schemas ─────────────────────────────────────────────────────────

class BonusResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    bonus_type: str
    status: str
    match_percent: Optional[str] = None
    max_bonus_amount: Optional[str] = None
    flat_amount: Optional[str] = None
    free_spins_count: Optional[int] = None
    wagering_multiplier: Optional[str] = None
    max_bet_with_bonus: Optional[str] = None
    starts_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    min_deposit_amount: Optional[str] = None
    eligible_games: Optional[str] = None
    is_repeatable: bool = False
    max_claims_per_user: Optional[int] = None
    created_at: datetime
    total_claims: int = 0

    model_config = {"from_attributes": True}


class CreateBonusRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    bonus_type: BonusType
    match_percent: Optional[Decimal] = None
    max_bonus_amount: Optional[Decimal] = None
    flat_amount: Optional[Decimal] = None
    free_spins_count: Optional[int] = None
    wagering_multiplier: Optional[Decimal] = Field(None, gt=0)
    max_bet_with_bonus: Optional[Decimal] = None
    starts_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    min_deposit_amount: Optional[Decimal] = None
    eligible_games: Optional[str] = None
    is_repeatable: bool = False
    max_claims_per_user: Optional[int] = None


class UpdateBonusRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[BonusStatus] = None
    match_percent: Optional[Decimal] = None
    max_bonus_amount: Optional[Decimal] = None
    flat_amount: Optional[Decimal] = None
    free_spins_count: Optional[int] = None
    wagering_multiplier: Optional[Decimal] = None
    max_bet_with_bonus: Optional[Decimal] = None
    starts_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    min_deposit_amount: Optional[Decimal] = None
    eligible_games: Optional[str] = None
    is_repeatable: Optional[bool] = None
    max_claims_per_user: Optional[int] = None


class IssueBonusRequest(BaseModel):
    user_id: str = Field(..., description="User to receive the bonus")
    bonus_id: str = Field(..., description="Bonus template ID")
    amount: Optional[Decimal] = Field(None, gt=0, description="Override award amount (optional)")


# ── Endpoints ───────────────────────────────────────────────────────

@router.get("", response_model=List[BonusResponse])
async def list_bonuses(
    status_filter: Optional[str] = Query(None, alias="status"),
    admin: User = Depends(require_admin),
    _: User = Depends(require_permission("read:bonuses")),
    session: AsyncSession = Depends(get_session),
):
    """List all bonus promotions."""
    query = select(Bonus).order_by(Bonus.created_at.desc())

    if status_filter:
        query = query.where(Bonus.status == status_filter)

    result = await session.execute(query)
    bonuses = result.scalars().all()

    response = []
    for b in bonuses:
        claims = await session.scalar(
            select(func.count(UserBonus.id)).where(UserBonus.bonus_id == b.id)
        ) or 0
        response.append(_bonus_to_response(b, claims))
    return response


@router.post("", response_model=BonusResponse, status_code=201)
async def create_bonus(
    payload: CreateBonusRequest,
    admin: User = Depends(require_admin),
    _: User = Depends(require_permission("write:bonuses")),
    session: AsyncSession = Depends(get_session),
):
    """Create a new bonus promotion."""
    bonus = Bonus(
        name=payload.name,
        description=payload.description,
        bonus_type=payload.bonus_type,
        match_percent=payload.match_percent,
        max_bonus_amount=payload.max_bonus_amount,
        flat_amount=payload.flat_amount,
        free_spins_count=payload.free_spins_count,
        wagering_multiplier=payload.wagering_multiplier,
        max_bet_with_bonus=payload.max_bet_with_bonus,
        starts_at=payload.starts_at,
        expires_at=payload.expires_at,
        min_deposit_amount=payload.min_deposit_amount,
        eligible_games=payload.eligible_games,
        is_repeatable=payload.is_repeatable,
        max_claims_per_user=payload.max_claims_per_user,
    )
    session.add(bonus)
    await log_admin_action(
        session, admin, "create_bonus",
        target_type="bonus", target_id=bonus.id,
        details={"name": payload.name, "bonus_type": payload.bonus_type.value if hasattr(payload.bonus_type, "value") else str(payload.bonus_type)},
    )
    await session.flush()
    return _bonus_to_response(bonus, 0)


@router.get("/{bonus_id}", response_model=BonusResponse)
async def get_bonus(
    bonus_id: str,
    admin: User = Depends(require_admin),
    _: User = Depends(require_permission("read:bonuses")),
    session: AsyncSession = Depends(get_session),
):
    """Get a single bonus with details."""
    result = await session.execute(select(Bonus).where(Bonus.id == bonus_id))
    bonus = result.scalar_one_or_none()
    if not bonus:
        raise HTTPException(status_code=404, detail="Bonus not found")

    claims = await session.scalar(
        select(func.count(UserBonus.id)).where(UserBonus.bonus_id == bonus.id)
    ) or 0
    return _bonus_to_response(bonus, claims)


@router.put("/{bonus_id}", response_model=BonusResponse)
async def update_bonus(
    bonus_id: str,
    payload: UpdateBonusRequest,
    admin: User = Depends(require_admin),
    _: User = Depends(require_permission("write:bonuses")),
    session: AsyncSession = Depends(get_session),
):
    """Update a bonus promotion."""
    result = await session.execute(select(Bonus).where(Bonus.id == bonus_id))
    bonus = result.scalar_one_or_none()
    if not bonus:
        raise HTTPException(status_code=404, detail="Bonus not found")

    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(bonus, key, value)

    await log_admin_action(
        session, admin, "update_bonus",
        target_type="bonus", target_id=bonus_id,
        details=update_data,
    )
    await session.flush()

    claims = await session.scalar(
        select(func.count(UserBonus.id)).where(UserBonus.bonus_id == bonus.id)
    ) or 0
    return _bonus_to_response(bonus, claims)


@router.post("/issue")
async def issue_bonus(
    payload: IssueBonusRequest,
    admin: User = Depends(require_admin),
    _: User = Depends(require_permission("write:bonuses")),
    session: AsyncSession = Depends(get_session),
):
    """Manually issue a bonus to a user — credits their wallet immediately."""
    if payload.user_id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot issue a bonus to yourself")
    # Verify user exists
    user_result = await session.execute(select(User).where(User.id == payload.user_id))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Verify bonus exists and is active
    bonus_result = await session.execute(select(Bonus).where(Bonus.id == payload.bonus_id))
    bonus = bonus_result.scalar_one_or_none()
    if not bonus:
        raise HTTPException(status_code=404, detail="Bonus not found")
    if bonus.status != BonusStatus.ACTIVE:
        raise HTTPException(status_code=400, detail="Bonus is not active")

    # Check expiry
    if bonus.expires_at and datetime.now(timezone.utc) > bonus.expires_at:
        raise HTTPException(status_code=400, detail="Bonus has expired")

    # Check repeatable/claims
    if not bonus.is_repeatable:
        existing = await session.scalar(
            select(func.count(UserBonus.id)).where(
                UserBonus.bonus_id == bonus.id,
                UserBonus.user_id == payload.user_id,
            )
        ) or 0
        if existing > 0:
            raise HTTPException(status_code=400, detail="User has already claimed this bonus")
    if bonus.max_claims_per_user:
        existing = await session.scalar(
            select(func.count(UserBonus.id)).where(
                UserBonus.bonus_id == bonus.id,
                UserBonus.user_id == payload.user_id,
            )
        ) or 0
        if existing >= bonus.max_claims_per_user:
            raise HTTPException(status_code=400, detail="User has reached max claims for this bonus")

    # Calculate award amount
    if payload.amount:
        award_amount = payload.amount
    elif bonus.flat_amount:
        award_amount = bonus.flat_amount
    elif bonus.bonus_type == BonusType.DEPOSIT_MATCH:
        award_amount = bonus.max_bonus_amount or Decimal("0.00")
    else:
        award_amount = Decimal("0.00")

    if award_amount <= Decimal("0.00"):
        raise HTTPException(status_code=400, detail="No award amount specified")

    required_wager = (award_amount * bonus.wagering_multiplier) if bonus.wagering_multiplier else Decimal("0.00")

    # Credit the user's wallet
    wallet_result = await session.execute(
        select(Wallet).where(Wallet.user_id == payload.user_id).with_for_update()
    )
    wallet = wallet_result.scalar_one_or_none()
    if not wallet:
        raise HTTPException(status_code=404, detail="Wallet not found")

    balance_before = wallet.balance
    wallet.bonus_balance += award_amount
    wallet.balance += award_amount

    # Record transaction
    tx = Transaction(
        wallet_id=wallet.id,
        user_id=payload.user_id,
        type=TransactionType.BONUS,
        status=TransactionStatus.COMPLETED,
        amount=award_amount,
        balance_before=balance_before,
        balance_after=wallet.balance,
        reference_id=bonus.id,
        description=f"Bonus: {bonus.name}",
    )
    session.add(tx)

    # Track the claim
    user_bonus = UserBonus(
        bonus_id=bonus.id,
        user_id=payload.user_id,
        awarded_amount=award_amount,
        required_wager=required_wager,
    )
    session.add(user_bonus)
    await log_admin_action(
        session, admin, "issue_bonus",
        target_type="bonus", target_id=payload.bonus_id,
        details={"user_id": payload.user_id, "bonus_name": bonus.name, "awarded_amount": str(award_amount)},
    )
    await session.flush()

    return {
        "status": "ok",
        "bonus_name": bonus.name,
        "user_id": payload.user_id,
        "awarded_amount": str(award_amount),
        "required_wager": str(required_wager),
        "balance_after": str(wallet.balance),
    }


def _bonus_to_response(bonus: Bonus, total_claims: int) -> BonusResponse:
    return BonusResponse(
        id=bonus.id,
        name=bonus.name,
        description=bonus.description,
        bonus_type=bonus.bonus_type.value if hasattr(bonus.bonus_type, "value") else str(bonus.bonus_type),
        status=bonus.status.value if hasattr(bonus.status, "value") else str(bonus.status),
        match_percent=str(bonus.match_percent) if bonus.match_percent else None,
        max_bonus_amount=str(bonus.max_bonus_amount) if bonus.max_bonus_amount else None,
        flat_amount=str(bonus.flat_amount) if bonus.flat_amount else None,
        free_spins_count=bonus.free_spins_count,
        wagering_multiplier=str(bonus.wagering_multiplier) if bonus.wagering_multiplier else None,
        max_bet_with_bonus=str(bonus.max_bet_with_bonus) if bonus.max_bet_with_bonus else None,
        starts_at=bonus.starts_at,
        expires_at=bonus.expires_at,
        min_deposit_amount=str(bonus.min_deposit_amount) if bonus.min_deposit_amount else None,
        eligible_games=bonus.eligible_games,
        is_repeatable=bonus.is_repeatable,
        max_claims_per_user=bonus.max_claims_per_user,
        created_at=bonus.created_at,
        total_claims=total_claims,
    )
