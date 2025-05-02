from app import create_app, db
from app.models import ViolationAccess
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def create_tables():
    """Create any missing tables in the database"""
    app = create_app()
    with app.app_context():
        try:
            # Check if the table exists
            inspect = db.inspect(db.engine)
            if 'violation_access_logs' not in inspect.get_table_names():
                logger.info("Creating violation_access_logs table...")
                db.create_all()
                logger.info("Table created successfully!")
            else:
                logger.info("Table violation_access_logs already exists.")
        except Exception as e:
            logger.error(f"Error creating tables: {str(e)}")

if __name__ == "__main__":
    create_tables() 