"""Tests for the WithdrawalService.

Uses mocking to test the approval, cancellation, and bank detail parsing
logic without requiring a real database or Flutterwave API.
"""

from __future__ import annotations

import json
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.models.user import User
from app.models.wallet import Transaction, TransactionStatus, TransactionType, Wallet
from app.services.withdrawal import WithdrawalService, WithdrawalError


# ── Helpers ─────────────────────────────────────────────────────────

def make_mock_tx(
    tx_id: str = "tx-123",
    user_id: str = "user-1",
    wallet_id: str = "wallet-1",
    amount: str = "100.00",
    status: TransactionStatus = TransactionStatus.PENDING,
    metadata_json: str | None = None,
) -> MagicMock:
    """Create a mock Transaction with the given attributes."""
    tx = MagicMock(spec=Transaction)
    tx.id = tx_id
    tx.user_id = user_id
    tx.wallet_id = wallet_id
    tx.amount = Decimal(amount)
    tx.type = TransactionType.WITHDRAWAL
    tx.status = status
    tx.reference_id = f"WTH-{tx_id}"
    tx.description = ""
    tx.balance_before = Decimal("1000")
    tx.balance_after = Decimal("900")
    tx.metadata_json = metadata_json or json.dumps({
        "amount": amount,
        "payment_method": "bank_transfer",
        "bank_code": "044",
        "account_number": "0123456789",
        "account_name": "John Doe",
    })
    return tx


def make_mock_wallet(
    wallet_id: str = "wallet-1",
    balance: str = "900.00",
) -> MagicMock:
    wallet = MagicMock(spec=Wallet)
    wallet.id = wallet_id
    wallet.balance = Decimal(balance)
    wallet.user_id = "user-1"
    return wallet


def make_admin_user() -> MagicMock:
    user = MagicMock(spec=User)
    user.id = "admin-1"
    user.username = "admin_user"
    user.is_admin = True
    return user


def make_execute_result(value) -> MagicMock:
    """Create a mock execute() return value that yields `value` on scalar_one_or_none."""
    result = MagicMock()
    result.scalar_one_or_none = MagicMock(return_value=value)
    return result


# ── Tests ───────────────────────────────────────────────────────────

class TestParseBankDetails:
    def test_parse_valid_metadata(self) -> None:
        service = WithdrawalService(session=AsyncMock())
        metadata = json.dumps({
            "amount": "100.00",
            "payment_method": "bank_transfer",
            "bank_code": "044",
            "account_number": "0123456789",
            "account_name": "John Doe",
        })
        result = service._parse_bank_details(metadata)
        assert result == {
            "bank_code": "044",
            "account_number": "0123456789",
            "account_name": "John Doe",
        }

    def test_parse_missing_fields(self) -> None:
        service = WithdrawalService(session=AsyncMock())
        metadata = json.dumps({
            "amount": "100.00",
            "payment_method": "bank_transfer",
        })
        assert service._parse_bank_details(metadata) is None

    def test_parse_empty_bank_code(self) -> None:
        service = WithdrawalService(session=AsyncMock())
        metadata = json.dumps({
            "amount": "100.00",
            "payment_method": "bank_transfer",
            "bank_code": "",
            "account_number": "0123456789",
            "account_name": "John Doe",
        })
        assert service._parse_bank_details(metadata) is None

    def test_parse_none_metadata(self) -> None:
        service = WithdrawalService(session=AsyncMock())
        assert service._parse_bank_details(None) is None

    def test_parse_invalid_json(self) -> None:
        service = WithdrawalService(session=AsyncMock())
        assert service._parse_bank_details("not valid json") is None


class TestApproveWithdrawal:
    @pytest.mark.asyncio
    async def test_approve_flw_pending(self) -> None:
        """Flutterwave returns 'new' status — withdrawal marked as processing."""
        tx = make_mock_tx()
        session = AsyncMock()
        # First execute() call returns the transaction
        session.execute.return_value = make_execute_result(tx)

        service = WithdrawalService(session)

        with patch.object(service.flw, "initiate_withdrawal", new=AsyncMock(
            return_value={
                "status": "success",
                "data": {
                    "id": 12345,
                    "status": "new",
                    "reference": "WTH-tx-123",
                },
            }
        )):
            result = await service.approve_withdrawal(tx.id, make_admin_user())

        assert result["status"] == "processing"
        assert result["flw_transfer_id"] == "12345"
        assert "sent to Flutterwave" in result["message"]
        assert session.flush.called

    @pytest.mark.asyncio
    async def test_approve_flw_completed_immediately(self) -> None:
        """Flutterwave returns 'successful' — rare immediate completion."""
        tx = make_mock_tx()
        session = AsyncMock()
        session.execute.return_value = make_execute_result(tx)

        service = WithdrawalService(session)

        with patch.object(service.flw, "initiate_withdrawal", new=AsyncMock(
            return_value={
                "status": "success",
                "data": {
                    "id": 12346,
                    "status": "successful",
                    "reference": "WTH-tx-123",
                },
            }
        )):
            result = await service.approve_withdrawal(tx.id, make_admin_user())

        assert result["status"] == "completed"
        assert tx.status == TransactionStatus.COMPLETED

    @pytest.mark.asyncio
    async def test_approve_flw_failed_refunds(self) -> None:
        """Flutterwave returns failure — wallet should be refunded."""
        tx = make_mock_tx()
        wallet = make_mock_wallet(balance="900.00")
        session = AsyncMock()
        # First call returns tx, second call returns wallet (for refund)
        session.execute.side_effect = [
            make_execute_result(tx),
            make_execute_result(wallet),
        ]

        service = WithdrawalService(session)

        with patch.object(service.flw, "initiate_withdrawal", new=AsyncMock(
            return_value={
                "status": "success",
                "data": {
                    "id": 0,
                    "status": "failed",
                    "reason": "insufficient_balance",
                },
            }
        )):
            result = await service.approve_withdrawal(tx.id, make_admin_user())

        assert result["status"] == "failed"
        assert wallet.balance == Decimal("1000.00")  # 900 + 100 refund
        assert tx.status == TransactionStatus.FAILED

    @pytest.mark.asyncio
    async def test_approve_flw_api_error_refunds(self) -> None:
        """Flutterwave API throws exception — wallet should be refunded."""
        tx = make_mock_tx()
        wallet = make_mock_wallet(balance="900.00")
        session = AsyncMock()
        session.execute.side_effect = [
            make_execute_result(tx),
            make_execute_result(wallet),
        ]

        service = WithdrawalService(session)

        with patch.object(service.flw, "initiate_withdrawal", new=AsyncMock(
            side_effect=Exception("Network timeout")
        )):
            result = await service.approve_withdrawal(tx.id, make_admin_user())

        assert result["status"] == "failed"
        assert result["refunded"] is True
        assert "Network timeout" in result["message"]
        assert wallet.balance == Decimal("1000.00")

    @pytest.mark.asyncio
    async def test_approve_missing_bank_details(self) -> None:
        """Missing bank details should raise WithdrawalError."""
        tx = make_mock_tx(metadata_json=json.dumps({"amount": "100"}))
        session = AsyncMock()
        session.execute.return_value = make_execute_result(tx)

        service = WithdrawalService(session)

        with pytest.raises(WithdrawalError, match="Bank details"):
            await service.approve_withdrawal(tx.id, make_admin_user())

    @pytest.mark.asyncio
    async def test_approve_tx_not_found(self) -> None:
        session = AsyncMock()
        session.execute.return_value = make_execute_result(None)

        service = WithdrawalService(session)

        with pytest.raises(WithdrawalError, match="not found"):
            await service.approve_withdrawal("nonexistent", make_admin_user())

    @pytest.mark.asyncio
    async def test_approve_wrong_type(self) -> None:
        tx = make_mock_tx()
        tx.type = TransactionType.DEPOSIT  # Wrong type
        session = AsyncMock()
        session.execute.return_value = make_execute_result(tx)

        service = WithdrawalService(session)

        with pytest.raises(WithdrawalError, match="Not a withdrawal"):
            await service.approve_withdrawal(tx.id, make_admin_user())

    @pytest.mark.asyncio
    async def test_approve_already_completed(self) -> None:
        tx = make_mock_tx(status=TransactionStatus.COMPLETED)
        session = AsyncMock()
        session.execute.return_value = make_execute_result(tx)

        service = WithdrawalService(session)

        with pytest.raises(WithdrawalError, match="not pending"):
            await service.approve_withdrawal(tx.id, make_admin_user())


class TestCancelWithdrawal:
    @pytest.mark.asyncio
    async def test_cancel_pending(self) -> None:
        """Cancelling a pending withdrawal should refund the wallet."""
        tx = make_mock_tx()
        wallet = make_mock_wallet(balance="900.00")
        session = AsyncMock()
        session.execute.side_effect = [
            make_execute_result(tx),
            make_execute_result(wallet),
        ]

        service = WithdrawalService(session)
        result = await service.cancel_withdrawal(tx.id, make_admin_user())

        assert result["status"] == "cancelled"
        assert tx.status == TransactionStatus.CANCELLED
        assert wallet.balance == Decimal("1000.00")  # Refunded

    @pytest.mark.asyncio
    async def test_cancel_completed_fails(self) -> None:
        """Completing a completed withdrawal should fail."""
        tx = make_mock_tx(status=TransactionStatus.COMPLETED)
        session = AsyncMock()
        session.execute.return_value = make_execute_result(tx)

        service = WithdrawalService(session)

        with pytest.raises(WithdrawalError, match="cannot cancel"):
            await service.cancel_withdrawal(tx.id, make_admin_user())


class TestBulkApprove:
    @pytest.mark.asyncio
    async def test_bulk_approve_all_succeed(self) -> None:
        """All withdrawals in the batch should be processed."""
        session = AsyncMock()
        service = WithdrawalService(session)

        with patch.object(service, "approve_withdrawal", new=AsyncMock(
            return_value={"status": "processing", "message": "Sent"}
        )):
            result = await service.approve_bulk(
                ["tx-1", "tx-2"], make_admin_user()
            )

        assert len(result["processed"]) == 2
        assert len(result["failed"]) == 0

    @pytest.mark.asyncio
    async def test_bulk_approve_partial_failures(self) -> None:
        """Some withdrawals may fail while others succeed."""
        session = AsyncMock()
        service = WithdrawalService(session)

        async def approve_with_errors(tx_id, admin):
            if tx_id == "tx-fail":
                raise WithdrawalError("Bank details missing")
            return {"status": "processing", "message": "Sent"}

        with patch.object(service, "approve_withdrawal", new=approve_with_errors):
            result = await service.approve_bulk(
                ["tx-ok", "tx-fail"], make_admin_user()
            )

        assert len(result["processed"]) == 1
        assert len(result["failed"]) == 1
        assert "Bank details missing" in result["failed"][0]["error"]
