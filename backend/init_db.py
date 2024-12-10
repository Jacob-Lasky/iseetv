import sqlite3
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(levelname)s:\t%(message)s")
logger = logging.getLogger(__name__)

try:
    logger.info("Connecting to database...")
    conn = sqlite3.connect("/data/sql_app.db")
    cursor = conn.cursor()

    # Drop existing table to reset schema
    logger.info("Dropping existing channels table...")
    cursor.execute("DROP TABLE IF EXISTS channels")

    logger.info("Creating channels table...")
    cursor.execute(
        """CREATE TABLE IF NOT EXISTS channels (
            channel_number INTEGER PRIMARY KEY,
            guide_id TEXT,
            name TEXT NOT NULL,
            url TEXT NOT NULL,
            "group" TEXT,
            logo TEXT,
            is_favorite INTEGER DEFAULT 0,
            last_watched TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )"""
    )

    # Add indexes for common queries
    cursor.execute(
        """CREATE INDEX IF NOT EXISTS idx_channels_group 
           ON channels("group")"""
    )
    cursor.execute(
        """CREATE INDEX IF NOT EXISTS idx_channels_guide_id 
           ON channels(guide_id)"""
    )
    cursor.execute(
        """CREATE INDEX IF NOT EXISTS idx_channels_name 
           ON channels(name)"""
    )

    logger.info("Committing changes...")
    conn.commit()
    logger.info("Database initialization completed successfully")

except sqlite3.OperationalError as e:
    logger.error(f"Database error: {e}")
    raise
finally:
    if conn:
        try:
            conn.close()
            logger.info(
                "Database connection closed (all operations successfully completed)"
            )
        except sqlite3.Error as e:
            logger.error(f"Error closing database connection: {e}")
