"""Wallet business logic — bet hold, resolve, refund."""

from __future__ import annotations

from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.wallet import Transaction, TransactionStatus, TransactionType, Wallet


class WalletService:
    """Handles all wallet operations with ACID guarantees."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_wallet(self, user_id: str) -> Wallet:
        """Fetch wallet with row-level lock for update."""
        result = await self.session.execute(
            select(Wallet).where(Wallet.user_id == user_id).with_for_update()
        )
        wallet = result.scalar_one_or_none()
        if not wallet:
            raise ValueError(f"Wallet not found for user {user_id}")
        return wallet

    async def hold_bet(self, user_id: str, amount: Decimal, reference_id: str) -> Transaction:
        """Place a hold on funds for a bet."""
        wallet = await self.get_wallet(user_id)

        if wallet.available_balance < amount:
            raise ValueError("Insufficient funds")

        # Update wallet
        wallet.locked_amount += amount

        # Record transaction
        tx = Transaction(
            wallet_id=wallet.id,
            user_id=user_id,
            type=TransactionType.BET,
            status=TransactionStatus.HOLD,
            amount=amount,
            balance_before=wallet.balance,
            balance_after=wallet.balance,
            reference_id=reference_id,
            description=f"Bet hold: {amount}",
        )
        self.session.add(tx)
        return tx

    async def resolve_bet(
        self,
        user_id: str,
        amount: Decimal,
        won: bool,
        reference_id: str,
        payout: Decimal | None = None,
    ) -> Transaction:
        """Resolve a held bet.

        Args:
            user_id: The player's ID.
            amount: The original bet amount held.
            won: Whether the player won.
            reference_id: Game round ID.
            payout: Additional payout beyond the original stake.
                     For regular win: payout=amount (1:1).
                     For blackjack: payout=amount*1.5 (3:2).
                     Defaults to the original bet amount.
        """
        wallet = await self.get_wallet(user_id)
        balance_before = wallet.balance

        # Release the hold first
        wallet.locked_amount -= amount

        if won:
            payout_amount = payout if payout is not None else amount
            wallet.balance += payout_amount
            tx_type = TransactionType.WIN
            description = f"Bet won: {amount}, payout: {payout_amount}"
        else:
            wallet.balance -= amount
            tx_type = TransactionType.BET
            description = f"Bet lost: {amount}"

        tx = Transaction(
            wallet_id=wallet.id,
            user_id=user_id,
            type=tx_type,
            status=TransactionStatus.COMPLETED,
            amount=amount,
            balance_before=balance_before,
            balance_after=wallet.balance,
            reference_id=reference_id,
            description=description,
        )
        self.session.add(tx)
        return tx

    async def refund_bet(self, user_id: str, amount: Decimal, reference_id: str) -> Transaction:
        """Release a held bet without resolving (refund/cancel)."""
        wallet = await self.get_wallet(user_id)
        wallet.locked_amount -= amount

        tx = Transaction(
            wallet_id=wallet.id,
            user_id=user_id,
            type=TransactionType.REFUND,
            status=TransactionStatus.COMPLETED,
            amount=amount,
            balance_before=wallet.balance,
            balance_after=wallet.balance,
            reference_id=reference_id,
            description=f"Bet refunded: {amount}",
        )
        self.session.add(tx)
        return tx

    async def push_bet(self, user_id: str, amount: Decimal, reference_id: str) -> Transaction:
        """Release a held bet on a push (tie) — neither win nor loss."""
        wallet = await self.get_wallet(user_id)
        wallet.locked_amount -= amount

        tx = Transaction(
            wallet_id=wallet.id,
            user_id=user_id,
            type=TransactionType.REFUND,
            status=TransactionStatus.COMPLETED,
            amount=amount,
            balance_before=wallet.balance,
            balance_after=wallet.balance,
            reference_id=reference_id,
            description=f"Bet pushed (tie): {amount}",
        )
        self.session.add(tx)
        return tx
