"""add provably fair seed fields to game_rounds

Revision ID: 9b4a7c3d2e5f
Revises: 7a3b5c2d8e1f
Create Date: 2026-07-23 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "9b4a7c3d2e5f"
down_revision: Union[str, None] = "7a3b5c2d8e1f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("game_rounds", sa.Column("server_seed", sa.String(length=128), nullable=True))
    op.add_column("game_rounds", sa.Column("client_seed", sa.String(length=128), nullable=True))
    op.add_column("game_rounds", sa.Column("nonce", sa.Integer(), nullable=False, server_default=sa.text("0")))


def downgrade() -> None:
    op.drop_column("game_rounds", "nonce")
    op.drop_column("game_rounds", "client_seed")
    op.drop_column("game_rounds", "server_seed")
