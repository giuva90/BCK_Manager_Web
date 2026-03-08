"""GitHub Releases version checker + self-update trigger."""

import asyncio
import time
from typing import Optional

import httpx
from packaging import version as pkg_version

from backend.config import settings

_cache: dict = {}
_cache_ts: float = 0.0


async def check_for_update() -> Optional[dict]:
    """Return update info if a newer version is available.  Cached per interval."""
    global _cache, _cache_ts

    now = time.time()
    ttl = settings.update_check_interval_hours * 3600
    if _cache and (now - _cache_ts) < ttl:
        return _cache.get("result")

    api_url = f"https://api.github.com/repos/{settings.github_repo}/releases/latest"
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(api_url, timeout=10)
            resp.raise_for_status()
            data = resp.json()
    except Exception:
        return None

    latest = data.get("tag_name", "").lstrip("v")
    if not latest:
        return None

    result = None
    if pkg_version.parse(latest) > pkg_version.parse(settings.app_version):
        result = {
            "current": settings.app_version,
            "latest": latest,
            "release_url": data.get("html_url", ""),
            "release_notes": data.get("body", ""),
            "published_at": data.get("published_at", ""),
        }

    _cache = {"result": result}
    _cache_ts = now
    return result
