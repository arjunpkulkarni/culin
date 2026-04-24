"""Allow duplicate nutrient names (USDA has multiple e.g. Energy)

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2025-02-11

"""
from typing import Sequence, Union

from alembic import op


revision: str = "b2c3d4e5f6a7"
down_revision: Union[str, None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_index("ix_nutrients_name", table_name="nutrients")
    op.create_index(op.f("ix_nutrients_name"), "nutrients", ["name"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_nutrients_name"), table_name="nutrients")
    op.create_index("ix_nutrients_name", "nutrients", ["name"], unique=True)
