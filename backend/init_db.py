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
            "group" TEXT,
            logo TEXT,
            is_favorite BOOLEAN DEFAULT FALSE,
            last_watched TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )"""
    )

    logger.info("Committing changes...")
    conn.commit()
    logger.info("Database initialization completed successfully")

except sqlite3.OperationalError as e:
    logger.error(f"Database error: {e}")
    raise
finally:
    logger.info("Database was successfully initialized. Closing connection...")
    if cursor:
        cursor.close()
    if conn:
        conn.close()
    logger.info("Database connection closed (all operations successfully completed)")
