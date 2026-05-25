"""Add flight_log to missions, add useful indexes

Revision ID: 0002
Revises: 0001
Create Date: 2025-01-02 00:00:00
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add flight_log column if not exists (idempotent via try/except in Alembic)
    with op.batch_alter_table("missions") as batch_op:
        batch_op.add_column(sa.Column("flight_log", sa.JSON(), nullable=True))

    # Add status index on missions for filtered queries
    op.create_index("ix_missions_status", "missions", ["status"])

    # Add index on user_progress.course_id for leaderboard queries
    op.create_index("ix_user_progress_course_id", "user_progress", ["course_id"])

    # Add index on certificates.course_id
    op.create_index("ix_certificates_course_id", "certificates", ["course_id"])


def downgrade() -> None:
    op.drop_index("ix_certificates_course_id", "certificates")
    op.drop_index("ix_user_progress_course_id", "user_progress")
    op.drop_index("ix_missions_status", "missions")
    with op.batch_alter_table("missions") as batch_op:
        batch_op.drop_column("flight_log")
