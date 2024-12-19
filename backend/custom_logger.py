import logging
import sys

def get_logger(name: str, prefix: str = "[database]", level: int = logging.INFO) -> logging.Logger:
    """
    Configures and returns a logger with consistent settings.
    """
    logger = logging.getLogger(name)

    # Prevent duplicate handlers
    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        formatter = logging.Formatter(f"{prefix} %(levelname)s:\t%(message)s")
        handler.setFormatter(formatter)

        logger.addHandler(handler)
        logger.setLevel(level)

    return logger

# Uvicorn-specific logging configuration
def get_uvicorn_logger(prefix: str = "[database]"):
    uvicorn_log_config = {
        "version": 1,
        "disable_existing_loggers": False,
        "formatters": {
            "default": {
                "format": f"{prefix} %(levelname)s:\t%(message)s",
            }
        },
        "handlers": {
            "default": {
                "level": "INFO",
                "class": "logging.StreamHandler",
                "formatter": "default",
                "stream": "ext://sys.stdout",  # Use string reference
            }
        },
        "loggers": {
            "": {"handlers": ["default"], "level": "INFO", "propagate": False},
            "uvicorn": {"handlers": ["default"], "level": "INFO", "propagate": False},
            "uvicorn.error": {"handlers": ["default"], "level": "INFO", "propagate": False},
            "uvicorn.access": {"handlers": ["default"], "level": "INFO", "propagate": False},
        },
    }
    return uvicorn_log_config
