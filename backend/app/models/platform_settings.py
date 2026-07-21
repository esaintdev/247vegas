"""Model for platform-wide settings and maintenance mode."""

from __future__ import annotations

from decimal import Decimal
from typing import Optional

from sqlalchemy import Boolean, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, new_uuid


class PlatformSettings(Base, TimestampMixin):
    """Global platform settings — there should only ever be one row."""

    __tablename__ = "platform_settings"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=new_uuid
    )

    # Maintenance
    maintenance_mode: Mapped[bool] = mapped_column(Boolean, default=False)
    maintenance_message: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True,
        default="We are currently undergoing maintenance. Please check back shortly.",
    )

    # Site-wide announcements
    announcement_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    announcement_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    announcement_type: Mapped[str] = mapped_column(
        String(20), default="info", nullable=False
    )  # info, warning, success, danger

    # Withdrawal limits
    min_withdrawal: Mapped[Decimal] = mapped_column(
        Numeric(20, 2), default=Decimal("10.00"), nullable=False
    )
    max_withdrawal: Mapped[Decimal] = mapped_column(
        Numeric(20, 2), default=Decimal("5000.00"), nullable=False
    )
    daily_withdrawal_limit: Mapped[Decimal] = mapped_column(
        Numeric(20, 2), default=Decimal("10000.00"), nullable=False
    )

    # Fees
    deposit_fee_percent: Mapped[Decimal] = mapped_column(
        Numeric(5, 2), default=Decimal("0.00"), nullable=False
    )
    withdrawal_fee_percent: Mapped[Decimal] = mapped_column(
        Numeric(5, 2), default=Decimal("0.00"), nullable=False
    )
    withdrawal_fee_fixed: Mapped[Decimal] = mapped_column(
        Numeric(20, 2), default=Decimal("0.00"), nullable=False
    )

    # Currency
    supported_currencies: Mapped[str] = mapped_column(
        String(255), default="USD", nullable=False
    )
    default_currency: Mapped[str] = mapped_column(
        String(3), default="USD", nullable=False
    )
