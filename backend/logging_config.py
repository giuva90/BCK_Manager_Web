"""Centralised logging configuration for BCK Manager Web.

Call ``setup_logging()`` once at application startup (before any router or
service code runs) to configure:

* a console handler (always active — captured by journald / systemd);
* a rotating file handler whose path is set via ``BCK_WEB_LOG_FILE``;
* the root log level set via ``BCK_WEB_LOG_LEVEL``.

Every module that calls ``logging.getLogger(name)`` will inherit this
configuration automatically.
"""

import logging
import os
from logging.handlers import RotatingFileHandler


def setup_logging(level: str, log_file: str) -> None:
    """Configure the root logger with console + file handlers.

    Parameters
    ----------
    level:
        Python log-level name (``DEBUG``, ``INFO``, ``WARNING``, …).
    log_file:
        Absolute path to the log file.  Parent directories are created
        automatically if they do not exist.
    """
    numeric_level = getattr(logging, level.upper(), logging.INFO)

    fmt = "%(asctime)s [%(name)s] %(levelname)s %(message)s"
    formatter = logging.Formatter(fmt, datefmt="%Y-%m-%d %H:%M:%S")

    root = logging.getLogger()
    root.setLevel(numeric_level)

    # Avoid adding duplicate handlers on reload / re-import
    if root.handlers:
        return

    # Console handler (stdout — captured by journald when running as a service)
    console = logging.StreamHandler()
    console.setLevel(numeric_level)
    console.setFormatter(formatter)
    root.addHandler(console)

    # File handler
    if log_file:
        log_dir = os.path.dirname(log_file)
        if log_dir:
            os.makedirs(log_dir, exist_ok=True)

        file_handler = RotatingFileHandler(
            log_file,
            maxBytes=10 * 1024 * 1024,  # 10 MB
            backupCount=5,
            encoding="utf-8",
        )
        file_handler.setLevel(numeric_level)
        file_handler.setFormatter(formatter)
        root.addHandler(file_handler)

    # Route Uvicorn loggers through the same handlers so access logs
    # and error logs are also written to the file.
    for uv_name in ("uvicorn", "uvicorn.access", "uvicorn.error"):
        uv_logger = logging.getLogger(uv_name)
        uv_logger.handlers.clear()
        uv_logger.propagate = True
