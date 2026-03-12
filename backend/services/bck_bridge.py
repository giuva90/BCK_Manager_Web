"""BCK Manager Python API integration layer.

Imports BCK Manager modules from the install path and wraps every synchronous
call in ``run_in_executor`` so FastAPI's event loop is never blocked.
"""

import asyncio
import json
import logging
import os
import sys
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from enum import Enum
from dataclasses import dataclass, field
from typing import Any, Optional

from backend.config import settings

# ---------------------------------------------------------------------------
# Add BCK Manager to sys.path so we can import its modules
# ---------------------------------------------------------------------------
if settings.bck_manager_path not in sys.path:
    sys.path.insert(0, settings.bck_manager_path)

# Lazy imports — will fail gracefully if BCK Manager is not installed
_bck_ready = False
try:
    from config_loader import load_config, get_enabled_jobs, get_endpoint_config  # type: ignore
    # ConfigError was added in a later version of BCK Manager — fall back to a plain Exception subclass
    try:
        from config_loader import ConfigError  # type: ignore
    except ImportError:
        class ConfigError(Exception):  # type: ignore[no-redef]
            pass
    from backup import run_backup_job, run_all_jobs  # type: ignore
    from restore import (  # type: ignore
        list_remote_backups,
        restore_file,
        restore_volume,
        list_buckets_for_endpoint,
        list_bucket_contents,
    )
    from retention import apply_retention  # type: ignore
    from encryption import get_encryption_config, decrypt_file, is_encrypted_file  # type: ignore
    from docker_utils import (  # type: ignore
        docker_available,
        volume_exists,
        get_volume_info,
        get_containers_using_volume,
    )
    from s3_client import S3Client  # type: ignore
    from app_logger import setup_logger  # type: ignore
    from utils import format_size  # type: ignore

    _bck_ready = True
except ImportError:
    pass

logger = logging.getLogger("bck_bridge")

# ---------------------------------------------------------------------------
# Thread-pool for running sync BCK Manager functions off the event loop
# ---------------------------------------------------------------------------
_executor = ThreadPoolExecutor(max_workers=4)


async def run_in_thread(fn, *args):
    loop = asyncio.get_event_loop()
    try:
        return await loop.run_in_executor(_executor, fn, *args)
    except SystemExit as exc:
        # config_loader.py in older BCK Manager installations calls sys.exit(1)
        # on validation errors; convert to a plain exception so FastAPI can
        # return a proper HTTP error instead of crashing the ASGI app.
        raise RuntimeError(
            f"BCK Manager exited with code {exc.code} — check config.yaml for errors"
        ) from exc


# ---------------------------------------------------------------------------
# Persist job execution to database
# ---------------------------------------------------------------------------
def _persist_execution(
    result: dict,
    started_at: datetime,
    finished_at: datetime,
    triggered_by: str,
    server_id: int = 0,
) -> None:
    """Save a job execution record to SQLite."""
    from sqlmodel import Session as DBSession
    from backend.database import engine
    from backend.models.job_execution import JobExecution

    uploaded = result.get("uploaded_files", [])
    total_size = sum(f.get("size", 0) for f in uploaded) if isinstance(uploaded, list) else 0
    duration = (finished_at - started_at).total_seconds()

    # Serialize result to JSON, handling datetime objects
    def _default(o: Any) -> str:
        if isinstance(o, datetime):
            return o.isoformat()
        return str(o)

    try:
        result_str = json.dumps(result, default=_default)
    except Exception:
        result_str = None

    execution = JobExecution(
        job_name=result.get("job_name", "unknown"),
        server_id=server_id,
        status="success" if result.get("success") else "failed",
        started_at=started_at,
        finished_at=finished_at,
        duration_seconds=round(duration, 2),
        triggered_by=triggered_by,
        error=result.get("error"),
        uploaded_files=len(uploaded) if isinstance(uploaded, list) else 0,
        uploaded_size=total_size,
        bucket=result.get("bucket", ""),
        prefix=result.get("prefix", ""),
        encrypted=result.get("encrypted", False),
        result_json=result_str,
    )
    with DBSession(engine) as session:
        session.add(execution)
        session.commit()


# ---------------------------------------------------------------------------
# Job state tracking (in-memory)
# ---------------------------------------------------------------------------
class JobStatus(str, Enum):
    IDLE = "idle"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"


@dataclass
class JobState:
    status: JobStatus = JobStatus.IDLE
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    last_result: Optional[dict] = None
    triggered_by: Optional[str] = None

# Keyed by "{server_id}:{job_name}" — server_id=0 for local/standalone
_job_states: dict[str, JobState] = {}


def _state_key(job_name: str, server_id: int = 0) -> str:
    return f"{server_id}:{job_name}"


def get_job_state(job_name: str, server_id: int = 0) -> JobState:
    return _job_states.get(_state_key(job_name, server_id), JobState())


def get_all_job_states(server_id: int = 0) -> dict[str, JobState]:
    prefix = f"{server_id}:"
    return {
        k[len(prefix):]: v
        for k, v in _job_states.items()
        if k.startswith(prefix)
    }


# ---------------------------------------------------------------------------
# Secret masking — never expose credentials in API responses
# ---------------------------------------------------------------------------
_SENSITIVE_FIELDS = {"secret_key", "passphrase", "password", "access_key"}
_MASK = "\u2022" * 8  # "••••••••"


def mask_secrets(obj: Any) -> Any:
    """Recursively replace sensitive field values with a mask."""
    if isinstance(obj, dict):
        return {
            k: (_MASK if k in _SENSITIVE_FIELDS and v else mask_secrets(v))
            for k, v in obj.items()
        }
    if isinstance(obj, list):
        return [mask_secrets(item) for item in obj]
    return obj


# ---------------------------------------------------------------------------
# Bridge functions — all async, delegate to BCK Manager via executor
# ---------------------------------------------------------------------------

def _get_logger():
    """Get or create a BCK Manager logger instance."""
    if _bck_ready:
        return setup_logger(settings.bck_log_path, debug=False)
    return logging.getLogger("bck_manager")


async def bridge_load_config(config_path: str | None = None) -> dict:
    path = config_path or settings.bck_config_path
    return await run_in_thread(load_config, path)


async def bridge_get_jobs(config_path: str | None = None) -> list[dict]:
    config = await bridge_load_config(config_path)
    jobs = config.get("backup_jobs", [])
    return [mask_secrets(j) for j in jobs]


async def bridge_get_enabled_jobs(config_path: str | None = None) -> list[dict]:
    config = await bridge_load_config(config_path)
    jobs = get_enabled_jobs(config)
    return [mask_secrets(j) for j in jobs]


async def bridge_run_job(
    job_name: str, triggered_by: str = "system", server_id: int = 0
) -> dict:
    key = _state_key(job_name, server_id)
    started = datetime.utcnow()
    _job_states[key] = JobState(
        status=JobStatus.RUNNING,
        started_at=started,
        triggered_by=triggered_by,
    )
    try:
        config = await bridge_load_config()
        job = next((j for j in config.get("backup_jobs", []) if j["name"] == job_name), None)
        if job is None:
            raise ValueError(f"Job '{job_name}' not found")
        bck_logger = _get_logger()
        result = await run_in_thread(run_backup_job, job, config, bck_logger)
        state = _job_states[key]
        state.status = JobStatus.SUCCESS if result.get("success") else JobStatus.FAILED
        state.finished_at = datetime.utcnow()
        state.last_result = result
        _persist_execution(result, started, state.finished_at, triggered_by, server_id)
        return result
    except Exception as exc:
        finished = datetime.utcnow()
        state = _job_states.get(key, JobState())
        state.status = JobStatus.FAILED
        state.finished_at = finished
        error_result = {"success": False, "error": str(exc), "job_name": job_name}
        state.last_result = error_result
        _job_states[key] = state
        _persist_execution(error_result, started, finished, triggered_by, server_id)
        raise


async def bridge_run_all(triggered_by: str = "system", server_id: int = 0) -> dict:
    config = await bridge_load_config()
    bck_logger = _get_logger()
    started = datetime.utcnow()
    total, succeeded, failed, results = await run_in_thread(
        run_all_jobs, config, bck_logger
    )
    finished = datetime.utcnow()
    # Update individual job states and persist each execution
    for r in results:
        key = _state_key(r["job_name"], server_id)
        _job_states[key] = JobState(
            status=JobStatus.SUCCESS if r.get("success") else JobStatus.FAILED,
            finished_at=finished,
            last_result=r,
            triggered_by=triggered_by,
        )
        _persist_execution(r, started, finished, triggered_by, server_id)
    return {
        "total": total,
        "succeeded": succeeded,
        "failed": failed,
        "results": results,
    }


async def bridge_list_backups(job_name: str) -> list[dict]:
    config = await bridge_load_config()
    job = next((j for j in config.get("backup_jobs", []) if j["name"] == job_name), None)
    if job is None:
        raise ValueError(f"Job '{job_name}' not found")
    bck_logger = _get_logger()
    return await run_in_thread(list_remote_backups, job, config, bck_logger)


async def bridge_restore_file(job_name: str, s3_key: str) -> bool:
    config = await bridge_load_config()
    job = next((j for j in config.get("backup_jobs", []) if j["name"] == job_name), None)
    if job is None:
        raise ValueError(f"Job '{job_name}' not found")
    bck_logger = _get_logger()
    return await run_in_thread(restore_file, job, config, s3_key, bck_logger)


async def bridge_restore_volume(
    job_name: str, s3_key: str, target_volume: str, replace_mode: bool
) -> bool:
    config = await bridge_load_config()
    job = next((j for j in config.get("backup_jobs", []) if j["name"] == job_name), None)
    if job is None:
        raise ValueError(f"Job '{job_name}' not found")
    bck_logger = _get_logger()
    return await run_in_thread(
        restore_volume, job, config, s3_key, target_volume, replace_mode, bck_logger
    )


async def bridge_apply_retention(job_name: str, dry_run: bool = False) -> dict:
    config = await bridge_load_config()
    job = next((j for j in config.get("backup_jobs", []) if j["name"] == job_name), None)
    if job is None:
        raise ValueError(f"Job '{job_name}' not found")
    bck_logger = _get_logger()
    kept, deleted = await run_in_thread(apply_retention, job, config, bck_logger, dry_run)
    return {"kept": kept, "deleted": deleted, "dry_run": dry_run}


async def bridge_test_s3(endpoint_name: str) -> bool:
    # Use our raw YAML reader instead of BCK Manager's load_config() so that
    # broken job→endpoint references in other jobs don't prevent testing.
    from backend.services.config_manager import read_config  # local to avoid circular import
    config = read_config()
    ep = next((e for e in config.get("s3_endpoints", []) if e.get("name") == endpoint_name), None)
    if ep is None:
        raise ValueError(f"Endpoint '{endpoint_name}' not found")
    from s3_client import S3Client as _S3Client  # type: ignore  # local import avoids NameError if try-block failed
    bck_logger = _get_logger()
    client = _S3Client(
        ep["endpoint_url"], ep["access_key"], ep["secret_key"], ep["region"], bck_logger
    )
    # Call list_buckets directly so boto3 exceptions propagate with the real error message.
    # test_connection() catches and swallows all errors, returning False silently.
    await run_in_thread(client.list_buckets)
    return True


async def bridge_list_buckets(endpoint_name: str) -> list[dict]:
    from backend.services.config_manager import read_config  # local to avoid circular import
    config = read_config()
    bck_logger = _get_logger()
    return await run_in_thread(list_buckets_for_endpoint, endpoint_name, config, bck_logger)


async def bridge_browse_storage(
    endpoint_name: str, bucket: str, prefix: str = ""
) -> list[dict]:
    config = await bridge_load_config()
    bck_logger = _get_logger()
    return await run_in_thread(
        list_bucket_contents, endpoint_name, bucket, prefix, config, bck_logger
    )


async def bridge_delete_object(
    endpoint_name: str, bucket: str, key: str
) -> bool:
    from backend.services.config_manager import read_config
    config = read_config()
    ep = next(
        (e for e in config.get("s3_endpoints", []) if e.get("name") == endpoint_name),
        None,
    )
    if ep is None:
        raise ValueError(f"Endpoint '{endpoint_name}' not found")
    from s3_client import S3Client as _S3Client  # type: ignore
    bck_logger = _get_logger()
    client = _S3Client(
        ep["endpoint_url"], ep["access_key"], ep["secret_key"], ep["region"], bck_logger
    )
    await run_in_thread(client.delete_object, bucket, key)
    return True


async def bridge_docker_available() -> bool:
    bck_logger = _get_logger()
    return await run_in_thread(docker_available, bck_logger)


async def bridge_volume_exists(volume_name: str) -> bool:
    bck_logger = _get_logger()
    return await run_in_thread(volume_exists, volume_name, bck_logger)


async def bridge_get_volume_info(volume_name: str) -> dict | None:
    bck_logger = _get_logger()
    return await run_in_thread(get_volume_info, volume_name, bck_logger)


async def bridge_get_containers_using_volume(volume_name: str) -> list[dict]:
    bck_logger = _get_logger()
    return await run_in_thread(get_containers_using_volume, volume_name, bck_logger)
