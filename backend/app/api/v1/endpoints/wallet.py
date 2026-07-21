"""Wallet management endpoints with Flutterwave payment integration."""

from __future__ import annotations

from datetime import date, datetime, timezone
from decimal import Decimal
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, get_session
from app.core.config import settings
from app.models.platform_settings import PlatformSettings
from app.models.user import User
from app.models.wallet import Transaction, TransactionStatus, TransactionType, Wallet
from app.schemas.wallet import (
    DepositRequest,
    DepositResponse,
    TransactionResponse,
    WalletResponse,
    WithdrawRequest,
)
from app.services.flutterwave import FlutterwaveService

router = APIRouter(prefix="/wallet", tags=["Wallet"])

# Service instances
flw_service = FlutterwaveService()


async def _get_platform_settings(session: AsyncSession) -> PlatformSettings:
    """Fetch or create the singleton platform settings row."""
    result = await session.execute(select(PlatformSettings))
    s = result.scalar_one_or_none()
    if not s:
        s = PlatformSettings()
        session.add(s)
        await session.flush()
    return s


async def _get_today_withdrawals(
    user_id: str, session: AsyncSession
) -> Decimal:
    """Sum completed + pending withdrawals for the user today."""
    today_start = datetime.combine(date.today(), datetime.min.time()).replace(tzinfo=timezone.utc)
    result = await session.execute(
        select(func.coalesce(func.sum(Transaction.amount), 0))
        .where(
            Transaction.user_id == user_id,
            Transaction.type == TransactionType.WITHDRAWAL,
            Transaction.status.in_([TransactionStatus.PENDING, TransactionStatus.COMPLETED]),
            Transaction.created_at >= today_start,
        )
    )
    return result.scalar() or Decimal("0")


@router.get("/balance", response_model=WalletResponse)
async def get_balance(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Get the current authenticated user's wallet balance."""
    result = await session.execute(
        select(Wallet).where(Wallet.user_id == user.id)
    )
    wallet = result.scalar_one_or_none()
    if not wallet:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Wallet not found")
    return wallet


@router.post("/deposit", response_model=DepositResponse)
async def deposit(
    payload: DepositRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Initiate a deposit via Flutterwave."""
    wallet_result = await session.execute(
        select(Wallet).where(Wallet.user_id == user.id).with_for_update()
    )
    wallet = wallet_result.scalar_one_or_none()
    if not wallet:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Wallet not found")

    # Calculate deposit fee from platform settings
    ps = await _get_platform_settings(session)
    deposit_fee_pct = ps.deposit_fee_percent
    fee_amount = (payload.amount * deposit_fee_pct / Decimal("100")).quantize(Decimal("0.01"))
    credited_amount = payload.amount - fee_amount
    if credited_amount <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Deposit amount must exceed the {deposit_fee_pct}% fee (min ${(fee_amount + Decimal('0.01')):.2f})",
        )

    # Generate unique transaction reference
    tx_ref = FlutterwaveService.generate_tx_ref("DEP")

    # Create pending transaction
    tx = Transaction(
        wallet_id=wallet.id,
        user_id=user.id,
        type=TransactionType.DEPOSIT,
        status=TransactionStatus.PENDING,
        amount=payload.amount,
        balance_before=wallet.balance,
        balance_after=wallet.balance + credited_amount,
        reference_id=tx_ref,
        description=f"Deposit via Flutterwave: {tx_ref} (fee: ${fee_amount})",
    )
    session.add(tx)
    await session.flush()

    # Initiate Flutterwave payment
    try:
        flw_response = await flw_service.initiate_deposit(
            amount=payload.amount,
            currency=payload.currency or "USD",
            email=user.email,
            tx_ref=tx_ref,
            redirect_url=settings.FLUTTERWAVE_REDIRECT_URL,
            username=user.username,
        )
        payment_link = flw_response.get("data", {}).get("link", "")
    except Exception as e:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Payment gateway error: {str(e)}",
        )

    await session.commit()

    return DepositResponse(
        transaction_id=tx.id,
        tx_ref=tx_ref,
        amount=credited_amount,
        payment_link=payment_link,
        status="pending",
    )


@router.post("/withdraw", response_model=TransactionResponse)
async def withdraw(
    payload: WithdrawRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Request a withdrawal (creates pending tx for admin approval)."""
    wallet_result = await session.execute(
        select(Wallet).where(Wallet.user_id == user.id).with_for_update()
    )
    wallet = wallet_result.scalar_one_or_none()
    if not wallet:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Wallet not found")

    # Fetch platform settings for withdrawal limits and fees
    ps = await _get_platform_settings(session)

    # Check min withdrawal
    if payload.amount < ps.min_withdrawal:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Minimum withdrawal amount is ${ps.min_withdrawal:.2f}",
        )

    # Check max withdrawal
    if payload.amount > ps.max_withdrawal:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Maximum withdrawal amount is ${ps.max_withdrawal:.2f}",
        )

    # Check daily withdrawal limit
    today_total = await _get_today_withdrawals(user.id, session)
    if today_total + payload.amount > ps.daily_withdrawal_limit:
        remaining = ps.daily_withdrawal_limit - today_total
        if remaining <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You have reached your daily withdrawal limit",
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Daily withdrawal limit exceeded. You can withdraw up to ${remaining:.2f} today",
        )

    # Calculate withdrawal fee
    fee_pct = ps.withdrawal_fee_percent
    fee_fixed = ps.withdrawal_fee_fixed
    net_amount = payload.amount - (payload.amount * fee_pct / Decimal("100")) - fee_fixed
    net_amount = net_amount.quantize(Decimal("0.01"))
    fee_total = payload.amount - net_amount

    # Check available balance (the full withdrawal amount comes out of wallet)
    if wallet.available_balance < payload.amount:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Insufficient available balance")

    tx_ref = FlutterwaveService.generate_tx_ref("WTH")

    tx = Transaction(
        wallet_id=wallet.id,
        user_id=user.id,
        type=TransactionType.WITHDRAWAL,
        status=TransactionStatus.PENDING,
        amount=payload.amount,
        balance_before=wallet.balance,
        balance_after=wallet.balance - payload.amount,
        reference_id=tx_ref,
        description=f"Withdrawal request via {payload.payment_method}: {tx_ref} (fee: ${fee_total:.2f}, net: ${net_amount:.2f})",
        metadata_json=payload.model_dump_json(),
    )
    session.add(tx)

    wallet.balance -= payload.amount

    await session.flush()
    return tx


@router.post("/verify/{tx_ref}")
async def verify_payment(
    tx_ref: str,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Verify a Flutterwave payment after redirect."""
    result = await session.execute(
        select(Transaction).where(
            Transaction.reference_id == tx_ref,
            Transaction.user_id == user.id,
        )
    )
    tx = result.scalar_one_or_none()
    if not tx:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")
    if tx.status != TransactionStatus.PENDING:
        return {"status": tx.status.value, "message": "Transaction already processed"}
    return {"status": "pending", "message": "Awaiting webhook confirmation for " + tx_ref}


@router.get("/banks")
async def get_banks(
    country: str = Query(default="NG", max_length=2),
    user: User = Depends(get_current_user),
):
    """Get list of banks for withdrawal."""
    try:
        banks = await flw_service.get_banks(country)
        return banks
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to fetch banks: {str(e)}",
        )


@router.get("/transactions", response_model=List[TransactionResponse])
async def get_transactions(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Get transaction history for the current user."""
    result = await session.execute(
        select(Transaction)
        .where(Transaction.user_id == user.id)
        .order_by(Transaction.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    return result.scalars().all()
