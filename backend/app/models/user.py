"""User model for authentication and profile."""

from __future__ import annotations

import enum
from typing import Optional

from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, new_uuid


class AdminRole(str, enum.Enum):
    """Hierarchical admin roles with increasing permissions."""
    SUPER_ADMIN = "super_admin"   # Full access to everything
    MANAGER = "manager"           # View stats, manage users, approve KYC
    SUPPORT = "support"           # View users & transactions only
    FINANCE = "finance"           # Approve withdrawals, view transactions


PERMISSIONS: dict[str, list[str]] = {
    "super_admin": [
        "read:stats", "read:users", "write:users",
        "read:transactions", "write:transactions",
        "read:games", "write:games",
        "read:kyc", "write:kyc",
        "read:settings", "write:settings",
        "read:bonuses", "write:bonuses",
        "wallet:adjust", "wallet:freeze",
        "read:audit", "admin:roles",
        "gamecontrol:kill", "write:notifications", "fairness:read",
    ],
    "manager": [
        "read:stats", "read:users", "write:users",
        "read:transactions",
        "read:games",
        "read:kyc", "write:kyc",
        "read:settings",
        "read:bonuses", "write:bonuses",
        "read:audit", "write:notifications", "fairness:read",
    ],
    "support": [
        "read:users",
        "read:transactions",
        "read:kyc",
    ],
    "finance": [
        "read:stats",
        "read:transactions", "write:transactions",
        "read:audit",
        "gamecontrol:kill",
    ],
}


class User(Base, TimestampMixin):
    """Registered platform user."""

    __tablename__ = "users"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=new_uuid
    )
    email: Mapped[str] = mapped_column(
        String(255), unique=True, index=True, nullable=False
    )
    username: Mapped[str] = mapped_column(
        String(50), unique=True, index=True, nullable=False
    )
    hashed_password: Mapped[str] = mapped_column(
        String(255), nullable=False
    )
    display_name: Mapped[str] = mapped_column(
        String(100), default="", nullable=False
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False
    )
    is_verified: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )
    is_admin: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )
    admin_role: Mapped[Optional[str]] = mapped_column(
        String(20), nullable=True, default=None
    )
    last_login_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True, default=None
    )
    last_login_ip: Mapped[Optional[str]] = mapped_column(
        String(45), nullable=True, default=None
    )

    # Relationships
    wallet = relationship("Wallet", back_populates="user", uselist=False)
    transactions = relationship("Transaction", back_populates="user", lazy="dynamic")

    def __repr__(self) -> str:
        return f"<User {self.username}>"

    @property
    def role_display(self) -> str:
        """Human-readable role name."""
        if not self.is_admin and not self.admin_role:
            return "Player"
        if self.admin_role:
            return self.admin_role.replace("_", " ").title()
        return "Admin"

    @property
    def permissions(self) -> list[str]:
        """Get all permissions for this user based on their role."""
        if not self.is_admin:
            return []
        role = self.admin_role or "super_admin"
        return PERMISSIONS.get(role, [])

    def has_permission(self, permission: str) -> bool:
        """Check if the user has a specific permission."""
        return permission in self.permissions
