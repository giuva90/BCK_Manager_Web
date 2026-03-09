"""Read/write BCK Manager's config.yaml with atomic writes and validation."""

import logging
import os
import tempfile
from typing import Any

import yaml

from backend.config import settings
from backend.services.bck_bridge import mask_secrets, run_in_thread, _bck_ready

logger = logging.getLogger("bck_web.config_manager")

# Sensitive fields — if the incoming value equals the mask, keep the old value
_MASK = "\u2022" * 8
_SENSITIVE_FIELDS = {"secret_key", "passphrase", "password", "access_key"}


def read_config(path: str | None = None) -> dict:
    path = path or settings.bck_config_path
    with open(path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


def write_config(config: dict, path: str | None = None) -> None:
    """Atomic write: temp file + os.replace() — never corrupts on crash."""
    path = path or settings.bck_config_path
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        yaml.dump(config, f, default_flow_style=False, allow_unicode=True)
    os.replace(tmp, path)
    logger.debug("Config written atomically: %s", path)


def _merge_sensitive_fields(new: Any, old: Any) -> Any:
    """Recursively keep existing secret values when the incoming value is masked."""
    if isinstance(new, dict) and isinstance(old, dict):
        merged = {}
        for k in new:
            if k in _SENSITIVE_FIELDS and new[k] == _MASK:
                merged[k] = old.get(k, new[k])
            else:
                merged[k] = _merge_sensitive_fields(new[k], old.get(k))
        return merged
    if isinstance(new, list) and isinstance(old, list):
        return [
            _merge_sensitive_fields(n, o) if i < len(old) else n
            for i, n in enumerate(new)
        ]
    return new


async def validate_and_write(config: dict, path: str | None = None) -> None:
    """Validate via BCK Manager's own validator, then write atomically."""
    path = path or settings.bck_config_path

    # Merge masked secrets back from existing config
    existing = read_config(path)
    config = _merge_sensitive_fields(config, existing)

    if _bck_ready:
        from config_loader import load_config as bck_load  # type: ignore

        # Write to a temp file and let BCK Manager validate
        fd, tmp_validation = tempfile.mkstemp(suffix=".yaml")
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as f:
                yaml.dump(config, f, default_flow_style=False, allow_unicode=True)
            await run_in_thread(bck_load, tmp_validation)
        finally:
            if os.path.exists(tmp_validation):
                os.unlink(tmp_validation)

    write_config(config, path)


def read_config_masked(path: str | None = None) -> dict:
    """Read config.yaml with all secrets replaced by •••."""
    return mask_secrets(read_config(path))


# ---------------------------------------------------------------------------
# Convenience helpers for modifying individual sections
# ---------------------------------------------------------------------------

def get_jobs(path: str | None = None) -> list[dict]:
    return read_config(path).get("backup_jobs", [])


def get_job_by_name(name: str, path: str | None = None) -> dict | None:
    for job in get_jobs(path):
        if job.get("name") == name:
            return job
    return None


def add_job(job: dict, path: str | None = None) -> None:
    config = read_config(path)
    config.setdefault("backup_jobs", []).append(job)
    write_config(config, path)


def update_job(name: str, updates: dict, path: str | None = None) -> None:
    config = read_config(path)
    jobs = config.get("backup_jobs", [])
    for i, j in enumerate(jobs):
        if j.get("name") == name:
            # Merge masked secrets
            updates = _merge_sensitive_fields(updates, j)
            jobs[i] = {**j, **updates}
            break
    else:
        raise ValueError(f"Job '{name}' not found")
    config["backup_jobs"] = jobs
    write_config(config, path)


def delete_job(name: str, path: str | None = None) -> None:
    config = read_config(path)
    jobs = config.get("backup_jobs", [])
    config["backup_jobs"] = [j for j in jobs if j.get("name") != name]
    if len(config["backup_jobs"]) == len(jobs):
        raise ValueError(f"Job '{name}' not found")
    write_config(config, path)


def toggle_job(name: str, path: str | None = None) -> bool:
    """Toggle enabled flag.  Returns new state."""
    config = read_config(path)
    for j in config.get("backup_jobs", []):
        if j.get("name") == name:
            j["enabled"] = not j.get("enabled", True)
            write_config(config, path)
            return j["enabled"]
    raise ValueError(f"Job '{name}' not found")
