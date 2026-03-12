"""Tail log file and broadcast new lines via WebSocket."""

import asyncio
import logging
import os
from typing import AsyncIterator

from backend.config import settings

logger = logging.getLogger("bck_web.log_watcher")


def _resolve_path(source: str) -> str:
    """Return the log file path for the requested source."""
    if source == "bck":
        return settings.bck_log_path
    return settings.log_file  # "web" is the default


async def tail_log(lines: int = 100, source: str = "web") -> list[str]:
    """Return the last *lines* lines from the requested log file."""
    log_path = _resolve_path(source)
    if not os.path.isfile(log_path):
        logger.debug("Log file not found: %s", log_path)
        return [f"[Log file not found: {log_path}]"]

    def _read_tail():
        with open(log_path, "r", encoding="utf-8", errors="replace") as f:
            all_lines = f.readlines()
        return [l.rstrip("\n") for l in all_lines[-lines:]]

    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _read_tail)


async def stream_log(source: str = "web") -> AsyncIterator[str]:
    """Async generator that yields new log lines as they appear (like tail -f).
    Keeps the connection alive even when the log file does not exist yet.
    """
    log_path = _resolve_path(source)
    pos: int = 0
    file_was_present = False

    while True:
        await asyncio.sleep(0.5)

        if not os.path.isfile(log_path):
            # File not (yet) present — keep looping so the WS stays alive
            file_was_present = False
            continue

        if not file_was_present:
            # File just appeared — start streaming from current end
            file_was_present = True
            pos = os.path.getsize(log_path)
            continue

        current = os.path.getsize(log_path)

        if current > pos:
            def _read_new(p: int):
                with open(log_path, "r", encoding="utf-8", errors="replace") as f:
                    f.seek(p)
                    data = f.read()
                    new_pos = f.tell()
                return data, new_pos

            loop = asyncio.get_event_loop()
            data, pos = await loop.run_in_executor(None, _read_new, pos)
            for line in data.splitlines():
                yield line
        elif current < pos:
            # Log was rotated — restart from beginning
            pos = 0
