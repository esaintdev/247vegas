"""Tests for the NotificationService.

Covers: creating all notification types with the correct message content,
metadata format, and link destinations.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import Notification
from app.services.notification import NotificationService


@pytest.fixture
def session() -> AsyncMock:
    """Mock AsyncSession for testing."""
    session = AsyncMock(spec=AsyncSession)
    return session


class TestNotificationCreation:
    @pytest.mark.asyncio
    async def test_deposit_confirmed(self, session: AsyncMock) -> None:
        notif = await NotificationService.deposit_confirmed(
            session, "user-1", "100.00", "DEP-ABC123"
        )
        assert isinstance(notif, Notification)
        assert notif.type == "deposit"
        assert "Deposit Confirmed" in notif.title
        assert "$100.00" in notif.message
        assert notif.link == "/cashier"
        assert session.add.called

    @pytest.mark.asyncio
    async def test_withdrawal_approved(self, session: AsyncMock) -> None:
        notif = await NotificationService.withdrawal_approved(
            session, "user-1", "250.00"
        )
        assert notif.type == "withdrawal"
        assert "Approved" in notif.title
        assert "$250.00" in notif.message
        assert notif.link == "/cashier"

    @pytest.mark.asyncio
    async def test_withdrawal_failed(self, session: AsyncMock) -> None:
        notif = await NotificationService.withdrawal_failed(
            session, "user-1", "50.00", "Insufficient balance"
        )
        assert notif.type == "withdrawal"
        assert "Failed" in notif.title
        assert "$50.00" in notif.message
        assert "Insufficient balance" in notif.message
        assert "returned to your wallet" in notif.message
        assert notif.link == "/cashier"

    @pytest.mark.asyncio
    async def test_withdrawal_completed(self, session: AsyncMock) -> None:
        notif = await NotificationService.withdrawal_completed(
            session, "user-1", "75.00"
        )
        assert notif.type == "withdrawal"
        assert "Complete" in notif.title
        assert "$75.00" in notif.message

    @pytest.mark.asyncio
    async def test_kyc_approved(self, session: AsyncMock) -> None:
        notif = await NotificationService.kyc_approved(session, "user-1")
        assert notif.type == "kyc"
        assert "Verified" in notif.title
        assert "identity" in notif.message.lower()
        assert notif.link == "/kyc"

    @pytest.mark.asyncio
    async def test_kyc_rejected(self, session: AsyncMock) -> None:
        notif = await NotificationService.kyc_rejected(
            session, "user-1", "Blurry document image"
        )
        assert notif.type == "kyc"
        assert "Rejected" in notif.title
        assert "Blurry document image" in notif.message
        assert notif.link == "/kyc"

    @pytest.mark.asyncio
    async def test_game_win(self, session: AsyncMock) -> None:
        notif = await NotificationService.game_win(
            session, "user-1", "blackjack", "500.00"
        )
        assert notif.type == "game_win"
        assert "Big Win" in notif.title
        assert "Blackjack" in notif.title
        assert "$500.00" in notif.message
        assert notif.link == "/games/blackjack"

    @pytest.mark.asyncio
    async def test_all_notifications_set_user_id(self, session: AsyncMock) -> None:
        """All notification types should set the user_id correctly."""
        notif = await NotificationService.create(
            session, "user-42", "test", "Title", "Message"
        )
        assert notif.user_id == "user-42"

    @pytest.mark.asyncio
    async def test_metadata_json_format(self, session: AsyncMock) -> None:
        """Deposit notification should include metadata JSON."""
        notif = await NotificationService.deposit_confirmed(
            session, "user-1", "100.00", "DEP-ABC"
        )
        assert notif.metadata_json is not None
        assert '"amount":"100.00"' in notif.metadata_json
        assert '"tx_ref":"DEP-ABC"' in notif.metadata_json
