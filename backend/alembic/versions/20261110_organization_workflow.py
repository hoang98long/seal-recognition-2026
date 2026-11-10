"""Organization documents, shared processing presets and readable asset names.

Revision ID: 20261110_org_flow
Revises: 4884d09442b4
"""

import sqlalchemy as sa

from alembic import op

revision = "20261110_org_flow"
down_revision = "4884d09442b4"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("file_assets", sa.Column("display_name", sa.String(250), nullable=True))
    for table in ("source_documents", "preprocessing_profiles"):
        op.add_column(table, sa.Column("organization_id", sa.Uuid(), nullable=True))
        op.create_foreign_key(
            f"fk_{table}_organization_id_organizations", table, "organizations", ["organization_id"], ["id"]
        )
        op.create_index(f"ix_{table}_organization_id", table, ["organization_id"])


def downgrade():
    for table in ("preprocessing_profiles", "source_documents"):
        op.drop_index(f"ix_{table}_organization_id", table_name=table)
        op.drop_constraint(f"fk_{table}_organization_id_organizations", table, type_="foreignkey")
        op.drop_column(table, "organization_id")
    op.drop_column("file_assets", "display_name")
