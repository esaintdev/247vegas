#!/usr/bin/env python3
"""
Database seed script.

Populates the database with initial data:
  - Admin user
  - Sample test users
  - Wallet for each user
  - Sample transaction history

Usage:
    cd backend && python3 scripts/seed.py

Environment variables (from .env or shell):
    POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_HOST, POSTGRES_PORT, POSTGRES_DB
"""

from __future__ import annotations

import asyncio
import sys
from decimal import Decimal
from pathlib import Path

# Ensure the backend directory is on sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings
from app.core.security import hash_password
from app.models.user import User
from app.models.wallet import Wallet, Transaction, TransactionStatus, TransactionType


# ── Sample data ─────────────────────────────────────────────────────

SEED_USERS = [
    {
        "email": "admin@casino.com",
        "username": "admin",
        "password": "Admin123!",
        "display_name": "Platform Admin",
        "is_admin": True,
        "is_verified": True,
        "initial_balance": Decimal("100000.00"),
    },
    {
        "email": "alice@example.com",
        "username": "alice",
        "password": "Player123!",
        "display_name": "Alice Johnson",
        "is_admin": False,
        "is_verified": True,
        "initial_balance": Decimal("5000.00"),
    },
    {
        "email": "bob@example.com",
        "username": "bob",
        "password": "Player123!",
        "display_name": "Bob Smith",
        "is_admin": False,
        "is_verified": True,
        "initial_balance": Decimal("2500.00"),
    },
    {
        "email": "charlie@example.com",
        "username": "charlie",
        "password": "Player123!",
        "display_name": "Charlie Brown",
        "is_admin": False,
        "is_verified": False,
        "initial_balance": Decimal("1000.00"),
    },
    {
        "email": "demo@casino.com",
        "username": "demo",
        "password": "Demo123!",
        "display_name": "Demo Player",
        "is_admin": False,
        "is_verified": False,
        "initial_balance": Decimal("10000.00"),
    },
]


# ── Seeder ───────────────────────────────────────────────────────────


async def seed(session: AsyncSession) -> None:
    """Run the seed routine — idempotent via email/username checks."""

    print("🌱 Seeding database...")
    created_count = 0

    for user_data in SEED_USERS:
        # Check if user already exists
        existing = await session.execute(
            select(User).where(
                (User.email == user_data["email"])
                | (User.username == user_data["username"])
            )
        )
        if existing.scalar_one_or_none():
            print(f"  ⏭️  Skipping {user_data['email']} — already exists")
            continue

        user = User(
            email=user_data["email"],
            username=user_data["username"],
            display_name=user_data["display_name"],
            hashed_password=hash_password(user_data["password"]),
            is_admin=user_data["is_admin"],
            is_verified=user_data["is_verified"],
        )
        session.add(user)
        await session.flush()  # Get user.id

        # Create wallet with initial balance
        wallet = Wallet(
            user_id=user.id,
            balance=user_data["initial_balance"],
            currency="USD",
        )
        session.add(wallet)
        await session.flush()

        # Record a deposit transaction for the initial balance
        tx = Transaction(
            wallet_id=wallet.id,
            user_id=user.id,
            type=TransactionType.DEPOSIT,
            status=TransactionStatus.COMPLETED,
            amount=user_data["initial_balance"],
            balance_before=Decimal("0.00"),
            balance_after=user_data["initial_balance"],
            description=f"Initial balance for {user.username}",
        )
        session.add(tx)

        created_count += 1
        print(
            f"  ✅ Created {user.email} "
            f"(${float(user_data['initial_balance']):,.2f} "
            f"{'👑 Admin' if user_data['is_admin'] else ''})"
        )

    await session.commit()
    print(f"\n✨ Done! Created {created_count} new user(s).")
    print("   ─────────────────────────────────────────────")
    print("   Admin:    admin@casino.com / Admin123!")
    print("   Demo:     demo@casino.com  / Demo123!")
    print("   Alice:    alice@example.com / Player123!")
    print("   Bob:      bob@example.com  / Player123!")
    print("   Charlie:  charlie@example.com / Player123!")
    print("   ─────────────────────────────────────────────")


async def main() -> None:
    """Create engine, session, and run seed."""

    engine = create_async_engine(
        settings.database_url,
        echo=False,
        pool_pre_ping=True,
    )

    async with async_sessionmaker(engine, expire_on_commit=False)() as session:
        try:
            await seed(session)
        except Exception as exc:
            print(f"❌ Seed failed: {exc}")
            await session.rollback()
            raise
        finally:
            await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
