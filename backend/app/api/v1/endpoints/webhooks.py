"""Webhook endpoints for payment gateway callbacks."""

from __future__ import annotations

import json
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_session
from app.core.config import settings
from app.models.wallet import Transaction, TransactionStatus, TransactionType, Wallet
from app.services.flutterwave import FlutterwaveService
from app.services.notification import NotificationService

router = APIRouter(prefix="/webhooks", tags=["Webhooks"], include_in_schema=False)


@router.post("/flutterwave")
async def flutterwave_webhook(
    request: Request,
    session: AsyncSession = Depends(get_session),
):
    """Handle Flutterwave webhook events.

    This endpoint receives payment status updates from Flutterwave.
    The raw body is read for HMAC signature verification.
    """
    # Read raw body for signature verification
    body = await request.body()
    signature = request.headers.get("X-Flutterwave-Signature", "")

    # Verify webhook authenticity
    if settings.FLUTTERWAVE_WEBHOOK_HASH:
        valid = FlutterwaveService.verify_webhook_signature(
            settings.FLUTTERWAVE_WEBHOOK_HASH, body, signature
        )
        if not valid:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid signature")

    # Parse event
    try:
        event = json.loads(body)
    except json.JSONDecodeError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid JSON")

    event_type = event.get("event", "")
    event_data = event.get("data", {})

    # Handle charge completion
    if event_type == "charge.completed":
        tx_ref = event_data.get("tx_ref", "")
        flw_id = str(event_data.get("id", ""))
        status_str = event_data.get("status", "")
        amount = event_data.get("amount", "0")
        currency = event_data.get("currency", "USD")

        # Find pending transaction
        result = await session.execute(
            select(Transaction).where(
                Transaction.reference_id == tx_ref,
                Transaction.status == TransactionStatus.PENDING,
            )
        )
        tx = result.scalar_one_or_none()
        if not tx:
            return {"status": "ignored", "reason": "Transaction not found or already processed"}

        if status_str == "successful":
            # Verify amount matches
            tx_amount = float(amount)
            if Decimal(str(tx_amount)) != tx.amount:
                await session.rollback()
                return {"status": "failed", "reason": "Amount mismatch"}

            # Credit the wallet (use pre-calculated balance_after which deducts fees)
            wallet_result = await session.execute(
                select(Wallet).where(Wallet.id == tx.wallet_id).with_for_update()
            )
            wallet = wallet_result.scalar_one_or_none()
            if wallet:
                tx.balance_before = wallet.balance
                wallet.balance = tx.balance_after  # Respect fee deductions

            tx.status = TransactionStatus.COMPLETED
            tx.reference_id = f"{tx_ref}|FLW:{flw_id}"
            tx.description = f"Deposit completed via Flutterwave: {amount} {currency}"
        else:
            tx.status = TransactionStatus.FAILED
            tx.description = f"Deposit failed: {status_str}"

        await session.flush()
        return {"status": "ok"}

    # Handle transfer events (withdrawals)
    elif event_type in ("transfer.completed", "transfer.failed"):
        reference = event_data.get("reference", "")
        status_str = event_data.get("status", "")

        result = await session.execute(
            select(Transaction).where(
                Transaction.reference_id == reference,
                Transaction.type == TransactionType.WITHDRAWAL,
            )
        )
        tx = result.scalar_one_or_none()
        if not tx:
            return {"status": "ignored"}

        if status_str == "successful":
            tx.status = TransactionStatus.COMPLETED
            try:
                await NotificationService.withdrawal_completed(
                    session, tx.user_id, str(tx.amount)
                )
            except Exception:
                pass
        else:
            # Refund the wallet on failed withdrawal
            wallet_result = await session.execute(
                select(Wallet).where(Wallet.id == tx.wallet_id).with_for_update()
            )
            wallet = wallet_result.scalar_one_or_none()
            if wallet:
                tx.balance_before = wallet.balance
                wallet.balance += tx.amount
                tx.balance_after = wallet.balance
            tx.status = TransactionStatus.FAILED
            try:
                await NotificationService.withdrawal_failed(
                    session, tx.user_id, str(tx.amount), status_str
                )
            except Exception:
                pass

        await session.flush()
        return {"status": "ok"}

    return {"status": "received"}
