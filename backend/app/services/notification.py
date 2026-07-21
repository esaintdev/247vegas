"""Notification service — creates in-app notifications for platform events."""

from __future__ import annotations

from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import Notification


class NotificationService:
    """Creates notifications for various platform events."""

    @staticmethod
    async def create(
        session: AsyncSession,
        user_id: str,
        type: str,
        title: str,
        message: str,
        link: Optional[str] = None,
        metadata_json: Optional[str] = None,
    ) -> Notification:
        """Create a new notification for a user."""
        notification = Notification(
            user_id=user_id,
            type=type,
            title=title,
            message=message,
            link=link,
            metadata_json=metadata_json,
        )
        session.add(notification)
        return notification

    @staticmethod
    async def deposit_confirmed(
        session: AsyncSession,
        user_id: str,
        amount: str,
        tx_ref: str,
    ) -> Notification:
        return await NotificationService.create(
            session, user_id,
            type="deposit",
            title="Deposit Confirmed 💰",
            message=f"Your deposit of ${amount} has been confirmed and credited to your wallet.",
            link="/cashier",
            metadata_json=f'{{"amount":"{amount}","tx_ref":"{tx_ref}"}}',
        )

    @staticmethod
    async def withdrawal_approved(
        session: AsyncSession,
        user_id: str,
        amount: str,
    ) -> Notification:
        return await NotificationService.create(
            session, user_id,
            type="withdrawal",
            title="Withdrawal Approved ✅",
            message=f"Your withdrawal of ${amount} has been approved and sent to your bank account.",
            link="/cashier",
            metadata_json=f'{{"amount":"{amount}"}}',
        )

    @staticmethod
    async def withdrawal_failed(
        session: AsyncSession,
        user_id: str,
        amount: str,
        reason: str = "",
    ) -> Notification:
        msg = f"Your withdrawal of ${amount} could not be processed."
        if reason:
            msg += f" Reason: {reason}"
        msg += " The funds have been returned to your wallet."
        return await NotificationService.create(
            session, user_id,
            type="withdrawal",
            title="Withdrawal Failed ❌",
            message=msg,
            link="/cashier",
            metadata_json=f'{{"amount":"{amount}","reason":"{reason}"}}',
        )

    @staticmethod
    async def withdrawal_completed(
        session: AsyncSession,
        user_id: str,
        amount: str,
    ) -> Notification:
        return await NotificationService.create(
            session, user_id,
            type="withdrawal",
            title="Withdrawal Complete 💸",
            message=f"Your withdrawal of ${amount} has been successfully sent to your bank account.",
            link="/cashier",
            metadata_json=f'{{"amount":"{amount}"}}',
        )

    @staticmethod
    async def kyc_approved(
        session: AsyncSession,
        user_id: str,
    ) -> Notification:
        return await NotificationService.create(
            session, user_id,
            type="kyc",
            title="Identity Verified ✅",
            message="Your identity has been verified! You now have full access to all platform features.",
            link="/kyc",
        )

    @staticmethod
    async def kyc_rejected(
        session: AsyncSession,
        user_id: str,
        reason: str,
    ) -> Notification:
        return await NotificationService.create(
            session, user_id,
            type="kyc",
            title="KYC Rejected ❌",
            message=f"Your identity verification was rejected. Reason: {reason}. Please re-submit with correct documents.",
            link="/kyc",
            metadata_json=f'{{"reason":"{reason}"}}',
        )

    @staticmethod
    async def game_win(
        session: AsyncSession,
        user_id: str,
        game: str,
        amount: str,
    ) -> Notification:
        return await NotificationService.create(
            session, user_id,
            type="game_win",
            title=f"Big Win on {game.title()}! 🎉",
            message=f"You won ${amount} playing {game.title()}!",
            link=f"/games/{game}",
            metadata_json=f'{{"game":"{game}","amount":"{amount}"}}',
        )
