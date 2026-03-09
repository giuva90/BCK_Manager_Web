"""Tail log file and broadcast new lines via WebSocket."""

import asyncio
import logging
import os
from typing import AsyncIterator

from backend.config import settings

logger = logging.getLogger("bck_web.log_watcher")


async def tail_log(lines: int = 100) -> list[str]:
    """Return the last *lines* lines from the BCK Manager log file."""
    log_path = settings.bck_log_path
    if not os.path.isfile(log_path):
        logger.debug("Log file not found: %s", log_path)
        return []

    def _read_tail():
        with open(log_path, "r", encoding="utf-8", errors="replace") as f:
            all_lines = f.readlines()
        return [l.rstrip("\n") for l in all_lines[-lines:]]

    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _read_tail)


async def stream_log() -> AsyncIterator[str]:
    """Async generator that yields new log lines as they appear (like tail -f)."""
    log_path = settings.bck_log_path
    if not os.path.isfile(log_path):
        return

    def _get_size():
        return os.path.getsize(log_path)

    loop = asyncio.get_event_loop()
    pos = await loop.run_in_executor(None, _get_size)

    while True:
        await asyncio.sleep(0.5)
        current = await loop.run_in_executor(None, _get_size)
        if current > pos:
            def _read_new(p):
                with open(log_path, "r", encoding="utf-8", errors="replace") as f:
                    f.seek(p)
                    data = f.read()
                return data, f.tell()

            data, new_pos = await loop.run_in_executor(None, _read_new, pos)
            pos = new_pos
            for line in data.splitlines():
                yield line
        elif current < pos:
            # Log was rotated — restart from beginning
            pos = 0
