"""Shared fixtures and test utilities for game engine tests."""

from __future__ import annotations

import random
from decimal import Decimal
from typing import Any, Dict, List

import pytest


# ── Deterministic RNG Helpers ───────────────────────────────────────

@pytest.fixture(autouse=True)
def reset_random_seed() -> None:
    """Reset random seed before each test for reproducibility."""
    random.seed(42)
    yield
    # Don't reset after — let subsequent tests start fresh


def make_deck_rigged(
    cards: List[str],
    repeat: bool = False,
) -> List[str]:
    """Create a deck with specific cards for testing.

    Args:
        cards: Ordered list of card strings (e.g. ["A♠", "K♥"])
        repeat: If True, cycle through cards when exhausted

    Returns:
        A list that can be used to replace the engine's internal draw calls
    """
    return cards if not repeat else cards * 100
