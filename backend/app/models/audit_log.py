"""Audit log model for tracking admin actions."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, new_uuid


class AuditLog(Base, TimestampMixin):
    """Record of every admin action for compliance and auditing."""

    __tablename__ = "audit_logs"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=new_uuid
    )
    admin_id: Mapped[str] = mapped_column(
        String(36), nullable=False, index=True
    )
    admin_username: Mapped[str] = mapped_column(
        String(50), nullable=False
    )
    action: Mapped[str] = mapped_column(
        String(50), nullable=False, index=True
    )
    target_type: Mapped[Optional[str]] = mapped_column(
        String(50), nullable=True
    )
    target_id: Mapped[Optional[str]] = mapped_column(
        String(36), nullable=True
    )
    details: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True
    )
    ip_address: Mapped[Optional[str]] = mapped_column(
        String(45), nullable=True
    )
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
