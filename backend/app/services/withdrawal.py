"""Withdrawal service — processes bank transfers via Flutterwave.

Handles the full withdrawal lifecycle:
1. Parse bank details from metadata_json
2. Initiate Flutterwave transfer
3. Update transaction status
4. Handle success/failure with wallet refunds
5. Send notifications
"""

from __future__ import annotations

import json
from decimal import Decimal
from typing import Any, Dict, Optional, Tuple

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.user import User
from app.models.wallet import Transaction, TransactionStatus, TransactionType, Wallet as WalletModel
from app.services.flutterwave import FlutterwaveService
from app.services.notification import NotificationService


class WithdrawalError(Exception):
    """Raised when a withdrawal operation fails."""
    pass


class WithdrawalService:
    """Handles withdrawal processing lifecycle."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.flw = FlutterwaveService()

    async def approve_withdrawal(
        self,
        tx_id: str,
        admin_user: User,
    ) -> Dict[str, Any]:
        """Approve a pending withdrawal: initiate Flutterwave transfer.

        Flow:
        1. Find the pending withdrawal transaction
        2. Extract bank details from metadata_json
        3. Call Flutterwave transfer API
        4. Update transaction status based on result
        5. Send notification to user
        """
        # Find the transaction
        result = await self.session.execute(
            select(Transaction).where(Transaction.id == tx_id).with_for_update()
        )
        tx = result.scalar_one_or_none()
        if not tx:
            raise WithdrawalError("Transaction not found")
        if tx.type != TransactionType.WITHDRAWAL:
            raise WithdrawalError("Not a withdrawal transaction")
        if tx.status != TransactionStatus.PENDING:
            raise WithdrawalError(f"Transaction is {tx.status.value}, not pending")

        # Parse bank details from metadata_json
        bank_details = self._parse_bank_details(tx.metadata_json)
        if not bank_details:
            raise WithdrawalError("Bank details not found in transaction metadata")

        # Initiate Flutterwave transfer
        try:
            flw_response = await self.flw.initiate_withdrawal(
                amount=tx.amount,
                currency="USD",
                bank_code=bank_details["bank_code"],
                account_number=bank_details["account_number"],
                account_name=bank_details["account_name"],
                narration=f"Casino withdrawal: {tx.reference_id or tx.id[:8]}",
                reference=str(tx.reference_id or tx.id),
            )
        except Exception as e:
            # Flutterwave API error — refund wallet and flush before returning
            await self._refund_wallet(tx)
            tx.description = f"Withdrawal failed: Flutterwave error — {str(e)}"
            await self.session.flush()
            return {
                "status": "failed",
                "message": f"Flutterwave transfer failed: {str(e)}",
                "refunded": True,
            }

        # Parse Flutterwave response
        flw_data = flw_response.get("data", {})
        flw_status = flw_data.get("status", "")
        flw_id = str(flw_data.get("id", ""))
        flw_ref = str(flw_data.get("reference", ""))

        if flw_status in ("new", "pending"):
            # Transfer initiated successfully — mark as processing
            tx.status = TransactionStatus.PENDING  # Keep as pending until webhook confirms
            tx.reference_id = f"{tx.reference_id}|FLW:{flw_id}"
            tx.description = f"Withdrawal sent to Flutterwave. Ref: {flw_ref}"

            # Send notification
            try:
                await NotificationService.withdrawal_approved(
                    self.session, tx.user_id, str(tx.amount)
                )
            except Exception:
                pass  # Notification failure shouldn't block the withdrawal

            await self.session.flush()

            return {
                "status": "processing",
                "message": "Withdrawal sent to Flutterwave for processing",
                "flw_transfer_id": flw_id,
                "flw_reference": flw_ref,
            }
        elif flw_status == "successful":
            # Transfer completed immediately (rare but possible)
            tx.status = TransactionStatus.COMPLETED
            tx.reference_id = f"{tx.reference_id}|FLW:{flw_id}"
            tx.description = f"Withdrawal completed via Flutterwave. Ref: {flw_ref}"

            await self.session.flush()

            return {
                "status": "completed",
                "message": "Withdrawal completed successfully",
                "flw_transfer_id": flw_id,
                "flw_reference": flw_ref,
            }
        else:
            # Transfer failed — refund the wallet
            await self._refund_wallet(tx)
            tx.description = f"Withdrawal failed on Flutterwave: {flw_status}"

            await self.session.flush()

            return {
                "status": "failed",
                "message": f"Flutterwave transfer failed: {flw_status}",
                "flw_transfer_id": flw_id,
                "flw_reference": flw_ref,
            }

    async def cancel_withdrawal(
        self,
        tx_id: str,
        admin_user: User,
    ) -> Dict[str, str]:
        """Cancel a pending withdrawal and refund the wallet."""
        result = await self.session.execute(
            select(Transaction).where(Transaction.id == tx_id).with_for_update()
        )
        tx = result.scalar_one_or_none()
        if not tx:
            raise WithdrawalError("Transaction not found")
        if tx.type != TransactionType.WITHDRAWAL:
            raise WithdrawalError("Not a withdrawal transaction")
        if tx.status != TransactionStatus.PENDING:
            raise WithdrawalError(f"Transaction is {tx.status.value}, cannot cancel")

        await self._refund_wallet(tx)
        tx.status = TransactionStatus.CANCELLED
        tx.description = f"Withdrawal cancelled by admin: {admin_user.username}"

        await self.session.flush()

        return {"status": "cancelled", "message": "Withdrawal cancelled and wallet refunded"}

    async def approve_bulk(
        self,
        tx_ids: list[str],
        admin_user: User,
    ) -> Dict[str, Any]:
        """Approve multiple withdrawals at once."""
        results = {"processed": [], "failed": []}

        for tx_id in tx_ids:
            try:
                result = await self.approve_withdrawal(tx_id, admin_user)
                results["processed"].append({
                    "tx_id": tx_id,
                    "status": result["status"],
                })
            except WithdrawalError as e:
                results["failed"].append({
                    "tx_id": tx_id,
                    "error": str(e),
                })

        return results

    def _parse_bank_details(
        self, metadata_json: Optional[str]
    ) -> Optional[Dict[str, str]]:
        """Extract bank details from transaction metadata JSON.

        Expected format:
        {"amount": ..., "payment_method": ..., "bank_code": "...",
         "account_number": "...", "account_name": "..."}
        """
        if not metadata_json:
            return None

        try:
            data = json.loads(metadata_json)
        except (json.JSONDecodeError, TypeError):
            return None

        bank_code = data.get("bank_code", "")
        account_number = data.get("account_number", "")
        account_name = data.get("account_name", "")

        if not all([bank_code, account_number, account_name]):
            return None

        return {
            "bank_code": bank_code,
            "account_number": account_number,
            "account_name": account_name,
        }

    async def _refund_wallet(self, tx: Transaction) -> None:
        """Refund a failed/cancelled withdrawal back to the wallet."""
        wallet_result = await self.session.execute(
            select(WalletModel).where(WalletModel.id == tx.wallet_id).with_for_update()
        )
        wallet = wallet_result.scalar_one_or_none()
        if wallet:
            tx.balance_before = wallet.balance
            wallet.balance += tx.amount
            tx.balance_after = wallet.balance
            tx.status = TransactionStatus.FAILED
