"""Structured logging configuration."""

import logging
import sys
from typing import Any, Dict

try:
    from pythonjsonlogger import jsonlogger
    _HAS_JSON_LOGGER = True
except ImportError:
    _HAS_JSON_LOGGER = False

try:
    from layer1_app.core.config import get_settings
    settings = get_settings()
except Exception:
    settings = None


class CustomJsonFormatter(logging.Formatter):
    """Custom JSON formatter with additional context.
    Falls back to basic JSON-like formatting when pythonjsonlogger is unavailable."""

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        if _HAS_JSON_LOGGER:
            self._inner = jsonlogger.JsonFormatter(
                "%(timestamp)s %(level)s %(name)s %(message)s", timestamp=True
            )
        else:
            self._inner = None
        super().__init__(*args, **kwargs)

    def format(self, record: logging.LogRecord) -> str:
        if self._inner is not None:
            return self._inner.format(record)
        return super().format(record)

    def add_fields(
        self, log_record: Dict[str, Any], record: logging.LogRecord, message_dict: Dict[str, Any]
    ) -> None:
        if self._inner and hasattr(self._inner, "add_fields"):
            self._inner.add_fields(log_record, record, message_dict)
        log_record["level"] = record.levelname
        log_record["logger"] = record.name
        env = getattr(settings, "environment", "development") if settings else "development"
        log_record["environment"] = env
        if record.exc_info:
            log_record["exc_info"] = self.formatException(record.exc_info)


def setup_logging() -> logging.Logger:
    """Configure application logging."""
    logger = logging.getLogger("nutrition")

    log_level = getattr(settings, "log_level", "INFO") if settings else "INFO"
    logger.setLevel(getattr(logging, log_level.upper(), logging.INFO))

    logger.handlers.clear()

    console_handler = logging.StreamHandler(sys.stdout)

    log_format = getattr(settings, "log_format", "text") if settings else "text"
    if log_format.lower() == "json" and _HAS_JSON_LOGGER:
        formatter = CustomJsonFormatter("%(levelname)s %(name)s %(message)s")
    else:
        formatter = logging.Formatter(
            "%(asctime)s - %(name)s - %(levelname)s - %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )

    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)
    logger.propagate = False

    return logger


# Initialize logger
logger = setup_logging()
