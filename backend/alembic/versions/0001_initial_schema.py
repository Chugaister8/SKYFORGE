"""Initial schema — all tables

Revision ID: 0001
Revises:
Create Date: 2025-01-01 00:00:00
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Users
    op.create_table("users",
        sa.Column("id",                  sa.String(36),   primary_key=True),
        sa.Column("email",               sa.String(255),  nullable=False, unique=True),
        sa.Column("username",            sa.String(64),   nullable=False, unique=True),
        sa.Column("hashed_password",     sa.String(255),  nullable=False),
        sa.Column("role",                sa.String(32),   nullable=False, server_default="PILOT"),
        sa.Column("status",              sa.String(32),   nullable=False, server_default="ACTIVE"),
        sa.Column("full_name",           sa.String(128),  nullable=True),
        sa.Column("unit",                sa.String(128),  nullable=True),
        sa.Column("avatar_url",          sa.String(512),  nullable=True),
        sa.Column("missions_completed",  sa.Integer(),    nullable=False, server_default="0"),
        sa.Column("flight_hours",        sa.Float(),      nullable=False, server_default="0"),
        sa.Column("is_verified",         sa.Boolean(),    nullable=False, server_default="false"),
        sa.Column("created_at",          sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_login",          sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_users_email",    "users", ["email"])
    op.create_index("ix_users_username", "users", ["username"])

    # UAVs
    op.create_table("uavs",
        sa.Column("id",          sa.String(36),  primary_key=True),
        sa.Column("owner_id",    sa.String(36),  sa.ForeignKey("users.id"), nullable=False),
        sa.Column("name",        sa.String(128), nullable=False),
        sa.Column("callsign",    sa.String(32),  nullable=True),
        sa.Column("uav_class",   sa.String(64),  nullable=False, server_default="TACTICAL_MULTIROTOR"),
        sa.Column("status",      sa.String(32),  nullable=False, server_default="IDLE"),
        sa.Column("library_id",  sa.String(64),  nullable=True),
        sa.Column("specs",       sa.JSON(),       nullable=True),
        sa.Column("created_at",  sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_uavs_owner_id", "uavs", ["owner_id"])

    # Missions
    op.create_table("missions",
        sa.Column("id",           sa.String(36),  primary_key=True),
        sa.Column("owner_id",     sa.String(36),  sa.ForeignKey("users.id"), nullable=False),
        sa.Column("name",         sa.String(128), nullable=False),
        sa.Column("description",  sa.String(512), nullable=True),
        sa.Column("status",       sa.String(32),  nullable=False, server_default="DRAFT"),
        sa.Column("waypoints",    sa.JSON(),       nullable=False, server_default="[]"),
        sa.Column("threat_sites", sa.JSON(),       nullable=False, server_default="[]"),
        sa.Column("uav_rcs",      sa.Float(),      nullable=False, server_default="0.1"),
        sa.Column("uav_speed",    sa.Float(),      nullable=False, server_default="30"),
        sa.Column("overall_risk", sa.Float(),      nullable=False, server_default="0"),
        sa.Column("weather",      sa.JSON(),       nullable=True),
        sa.Column("aar_data",     sa.JSON(),       nullable=True),
        sa.Column("flight_log",   sa.JSON(),       nullable=True),
        sa.Column("duration_s",   sa.Float(),      nullable=False, server_default="0"),
        sa.Column("score",        sa.Integer(),    nullable=False, server_default="0"),
        sa.Column("created_at",   sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_missions_owner_id", "missions", ["owner_id"])

    # Training progress
    op.create_table("user_progress",
        sa.Column("id",           sa.String(36),  primary_key=True),
        sa.Column("user_id",      sa.String(36),  sa.ForeignKey("users.id"), nullable=False),
        sa.Column("course_id",    sa.String(64),  nullable=False),
        sa.Column("progress_pct", sa.Float(),      nullable=False, server_default="0"),
        sa.Column("completed",    sa.Boolean(),    nullable=False, server_default="false"),
        sa.Column("score",        sa.Integer(),    nullable=False, server_default="0"),
        sa.Column("attempts",     sa.Integer(),    nullable=False, server_default="0"),
        sa.Column("module_data",  sa.JSON(),       nullable=False, server_default="{}"),
        sa.Column("started_at",   sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_user_progress_user_id", "user_progress", ["user_id"])

    # Certificates
    op.create_table("certificates",
        sa.Column("id",          sa.String(36), primary_key=True),
        sa.Column("user_id",     sa.String(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("course_id",   sa.String(64), nullable=False),
        sa.Column("cert_number", sa.String(32), nullable=False, unique=True),
        sa.Column("score",       sa.Integer(),  nullable=False, server_default="0"),
        sa.Column("grade",       sa.String(4),  nullable=False, server_default="B"),
        sa.Column("issued_at",   sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at",  sa.DateTime(timezone=True), nullable=True),
        sa.Column("valid",       sa.Boolean(),  nullable=False, server_default="true"),
    )
    op.create_index("ix_certificates_user_id", "certificates", ["user_id"])


def downgrade() -> None:
    op.drop_table("certificates")
    op.drop_table("user_progress")
    op.drop_table("missions")
    op.drop_table("uavs")
    op.drop_table("users")
