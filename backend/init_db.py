import sqlite3
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(levelname)s:\t%(message)s")
logger = logging.getLogger(__name__)

try:
    logger.info("Connecting to database...")
    conn = sqlite3.connect("/data/sql_app.db")
    cursor = conn.cursor()

    logger.info("Creating channels table...")
    cursor.execute(
        """CREATE TABLE IF NOT EXISTS channels (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            url TEXT NOT NULL,
            description TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )"""
    )

    logger.info("Committing changes...")
    conn.commit()
    logger.info("Database initialization completed successfully")

except sqlite3.Error as e:
    logger.error(f"Database error: {e}")
    raise
finally:
    if conn:
        try:
            logger.info("Database was successfully initialized. Closing connection...")
            conn.close()
            logger.info("Database connection closed")
        except sqlite3.Error as e:
            logger.error(f"Error closing database connection: {e}")
