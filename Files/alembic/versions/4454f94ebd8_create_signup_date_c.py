"""create signup date column

Revision ID: 4454f94ebd8
Revises: None
Create Date: 2013-10-08 16:18:52.408757

"""

# revision identifiers, used by Alembic.
revision = '4454f94ebd8'
down_revision = None

from alembic import op
import sqlalchemy as sa


def upgrade():
    op.add_column('dbusers', sa.Column('sign_up_date', sa.DateTime))
    


def downgrade():
    op.execute("ALTER TABLE dbusers RENAME TO dbuserstemp;") 
    op.execute("""
        CREATE TABLE dbusers (
        id INTEGER NOT NULL,
        username VARCHAR(50),
        passhash VARCHAR(1024),
        claimed_id VARCHAR(100),
        PRIMARY KEY (id),
        UNIQUE (username)
        );
        """)
        
    op.execute("INSERT INTO dbusers SELECT id,username,passhash,claimed_id FROM dbuserstemp;")

    op.execute("DROP TABLE dbuserstemp;")