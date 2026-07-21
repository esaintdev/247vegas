"""Notification schemas."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class NotificationResponse(BaseModel):
    """A single notification for the user."""

    id: str
    type: str
    title: str
    message: str
    is_read: bool
    link: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class UnreadCountResponse(BaseModel):
    """Number of unread notifications."""

    count: int


class MarkReadResponse(BaseModel):
    """Response after marking notifications as read."""

    status: str
    marked_count: int
