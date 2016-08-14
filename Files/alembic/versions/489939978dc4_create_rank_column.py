"""create rank column

Revision ID: 489939978dc4
Revises: 4454f94ebd8
Create Date: 2013-10-10 12:27:52.454710

"""

# revision identifiers, used by Alembic.
revision = '489939978dc4'
down_revision = '4454f94ebd8'

from alembic import op
import sqlalchemy as sa
from sqlalchemy import func

def upgrade():
    op.add_column('dbusers', sa.Column('rank', sa.Integer,server_default="1000"))
    
#test with the following statement:
# SELECT rank FROM dbusers;

def downgrade():
    op.execute("ALTER TABLE dbusers RENAME TO dbuserstemp;") 
    op.execute("""
        CREATE TABLE dbusers (
        id INTEGER NOT NULL,
        username VARCHAR(50),
        passhash VARCHAR(1024),
        claimed_id VARCHAR(100),
        sign_up_date DATETIME,
        PRIMARY KEY (id),
        UNIQUE (username)
        );
        """)
        
    op.execute("INSERT INTO dbusers SELECT id,username,passhash,claimed_id, sign_up_date FROM dbuserstemp;")

    op.execute("DROP TABLE dbuserstemp;")
    
    
    
    
    
        