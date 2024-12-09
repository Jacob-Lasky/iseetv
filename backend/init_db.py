import os
import logging
from app.database import engine, Base
from app.models import Channel

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


def init_db():
    db_path = "./sql_app.db"

    # Check if database already exists
    if not os.path.exists(db_path):
        logger.info("Initializing database...")
        Base.metadata.create_all(bind=engine)
        logger.info("Database initialized successfully")
    else:
        logger.info("Database already exists, skipping initialization")


if __name__ == "__main__":
    init_db()
