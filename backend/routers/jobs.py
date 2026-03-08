"""Backup job CRUD — reads/writes config.yaml."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from backend.models.user import User
from backend.auth.dependencies import get_current_user, require_operator_or_admin
from backend.schemas.backup import JobCreate, JobUpdate, JobRead
from backend.services.config_manager import (
    get_jobs,
    get_job_by_name,
    add_job,
    update_job,
    delete_job,
    toggle_job,
    read_config_masked,
)
from backend.services.bck_bridge import mask_secrets

router = APIRouter(prefix="/jobs", tags=["jobs"])


def _job_to_read(j: dict) -> JobRead:
    enc = j.get("encryption", {})
    ret = j.get("retention", {})
    notif = j.get("notifications", {})
    return JobRead(
        name=j["name"],
        mode=j.get("mode", "folder"),
        bucket=j.get("bucket", ""),
        s3_endpoint=j.get("s3_endpoint", ""),
        source_path=j.get("source_path"),
        volume_name=j.get("volume_name"),
        prefix=j.get("prefix", ""),
        enabled=j.get("enabled", True),
        pre_command=j.get("pre_command", ""),
        post_command=j.get("post_command", ""),
        retention=ret,
        encryption=enc,
        notifications=notif,
    )


@router.get("", response_model=list[JobRead])
async def list_jobs(
    _user: User = Depends(get_current_user),
    server_id: Optional[int] = Query(None),
):
    jobs = get_jobs()
    return [_job_to_read(mask_secrets(j)) for j in jobs]


@router.get("/{name}", response_model=JobRead)
async def get_job(
    name: str,
    _user: User = Depends(get_current_user),
):
    j = get_job_by_name(name)
    if j is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Job '{name}' not found")
    return _job_to_read(mask_secrets(j))


@router.post("", response_model=JobRead, status_code=201)
async def create_job(
    body: JobCreate,
    _user: User = Depends(require_operator_or_admin),
):
    existing = get_job_by_name(body.name)
    if existing:
        raise HTTPException(status.HTTP_409_CONFLICT, f"Job '{body.name}' already exists")

    job_dict = body.model_dump(exclude_none=True)
    # Flatten nested models to plain dicts for YAML
    for key in ("retention", "encryption", "notifications"):
        if key in job_dict and hasattr(job_dict[key], "items"):
            pass  # already a dict from model_dump
    add_job(job_dict)
    return _job_to_read(mask_secrets(job_dict))


@router.put("/{name}", response_model=JobRead)
async def update_job_route(
    name: str,
    body: JobUpdate,
    _user: User = Depends(require_operator_or_admin),
):
    if get_job_by_name(name) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Job '{name}' not found")
    updates = body.model_dump(exclude_none=True)
    update_job(name, updates)
    updated = get_job_by_name(name)
    return _job_to_read(mask_secrets(updated))


@router.delete("/{name}", status_code=204)
async def delete_job_route(
    name: str,
    _user: User = Depends(require_operator_or_admin),
):
    try:
        delete_job(name)
    except ValueError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Job '{name}' not found")


@router.patch("/{name}/toggle")
async def toggle_job_route(
    name: str,
    _user: User = Depends(require_operator_or_admin),
):
    try:
        new_state = toggle_job(name)
    except ValueError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Job '{name}' not found")
    return {"name": name, "enabled": new_state}
