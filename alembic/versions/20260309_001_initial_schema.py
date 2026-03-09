"""initial schema

Revision ID: 001
Revises:
Create Date: 2026-03-09

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSON, UUID

# revision identifiers
revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── users ──────────────────────────────────────────────────────────────
    op.create_table(
        "users",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("entra_id", sa.String(255), nullable=False, unique=True),
        sa.Column("email", sa.String(255), nullable=False, unique=True),
        sa.Column("display_name", sa.String(255), nullable=False),
        sa.Column("roles", JSON, nullable=False, server_default="[]"),
        sa.Column("created_at", sa.DateTime, nullable=False),
        sa.Column("last_login", sa.DateTime, nullable=False),
    )
    op.create_index("ix_users_entra_id", "users", ["entra_id"])
    op.create_index("ix_users_email", "users", ["email"])

    # ── clients ─────────────────────────────────────────────────────────────
    op.create_table(
        "clients",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False, unique=True),
        sa.Column("risk_score", sa.Integer, nullable=False, server_default="0"),
        sa.Column(
            "status",
            sa.Enum("secure", "warning", "critical", name="clientstatus"),
            nullable=False,
            server_default="secure",
        ),
        sa.Column("churn_risk", sa.Integer, nullable=False, server_default="0"),
        sa.Column("last_scan", sa.String(50), nullable=False, server_default="Never"),
        sa.Column("industry", sa.String(100), nullable=True),
        sa.Column("contact_email", sa.String(255), nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("mrr", sa.Float, nullable=False, server_default="0"),
        sa.Column("active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime, nullable=False),
        sa.Column("updated_at", sa.DateTime, nullable=False),
    )
    op.create_index("ix_clients_name", "clients", ["name"])

    # ── security_events ─────────────────────────────────────────────────────
    op.create_table(
        "security_events",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "client_id",
            UUID(as_uuid=True),
            sa.ForeignKey("clients.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text, nullable=False),
        sa.Column(
            "severity",
            sa.Enum("low", "medium", "high", "critical", name="eventseverity"),
            nullable=False,
            server_default="medium",
        ),
        sa.Column("event_type", sa.String(100), nullable=False),
        sa.Column("resolved", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("metadata", JSON, nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime, nullable=False),
    )
    op.create_index("ix_security_events_client_id", "security_events", ["client_id"])
    op.create_index("ix_security_events_event_type", "security_events", ["event_type"])
    op.create_index("ix_security_events_created_at", "security_events", ["created_at"])

    # ── agents ──────────────────────────────────────────────────────────────
    op.create_table(
        "agents",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False, unique=True),
        sa.Column(
            "status",
            sa.Enum("running", "idle", "alert", "complete", name="agentstatus"),
            nullable=False,
            server_default="idle",
        ),
        sa.Column("client_context", sa.String(255), nullable=True),
        sa.Column("progress_pct", sa.Integer, nullable=False, server_default="0"),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("agent_type", sa.String(100), nullable=False),
        sa.Column("last_active", sa.DateTime, nullable=False),
        sa.Column("logs", JSON, nullable=False, server_default="[]"),
        sa.Column("config", JSON, nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime, nullable=False),
    )
    op.create_index("ix_agents_name", "agents", ["name"])

    # ── pentest_runs ─────────────────────────────────────────────────────────
    op.create_table(
        "pentest_runs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "client_id",
            UUID(as_uuid=True),
            sa.ForeignKey("clients.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("scope", sa.Text, nullable=False),
        sa.Column("governance", sa.String(100), nullable=False, server_default="standard"),
        sa.Column(
            "status",
            sa.Enum("pending", "running", "complete", "failed", name="penteststatus"),
            nullable=False,
            server_default="pending",
        ),
        sa.Column("progress_pct", sa.Integer, nullable=False, server_default="0"),
        sa.Column("results", JSON, nullable=True),
        sa.Column("findings_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("critical_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("started_at", sa.DateTime, nullable=True),
        sa.Column("completed_at", sa.DateTime, nullable=True),
        sa.Column("created_at", sa.DateTime, nullable=False),
    )
    op.create_index("ix_pentest_runs_client_id", "pentest_runs", ["client_id"])


def downgrade() -> None:
    op.drop_table("pentest_runs")
    op.drop_table("agents")
    op.drop_table("security_events")
    op.drop_table("clients")
    op.drop_table("users")

    # Drop enum types
    op.execute("DROP TYPE IF EXISTS penteststatus")
    op.execute("DROP TYPE IF EXISTS agentstatus")
    op.execute("DROP TYPE IF EXISTS eventseverity")
    op.execute("DROP TYPE IF EXISTS clientstatus")
