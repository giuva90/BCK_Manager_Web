"""S3 Storage explorer routes — browse, download, test."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from backend.models.user import User
from backend.auth.dependencies import get_current_user, require_operator_or_admin
from backend.schemas.s3 import S3TestRequest
from backend.services.bck_bridge import (
    bridge_list_buckets,
    bridge_browse_storage,
    bridge_test_s3,
    bridge_load_config,
)
from backend.services.config_manager import read_config, get_job_by_name
from backend.services.download_proxy import stream_s3_download

router = APIRouter(prefix="/storage", tags=["storage"])


@router.get("/buckets")
async def list_buckets(
    endpoint: str = Query(...),
    server_id: Optional[int] = Query(None),
    _user: User = Depends(get_current_user),
):
    try:
        buckets = await bridge_list_buckets(endpoint)
    except ValueError as e:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(e))
    return buckets


@router.get("/browse")
async def browse_bucket(
    endpoint: str = Query(...),
    bucket: str = Query(...),
    prefix: str = Query(""),
    server_id: Optional[int] = Query(None),
    _user: User = Depends(get_current_user),
):
    try:
        objects = await bridge_browse_storage(endpoint, bucket, prefix)
    except ValueError as e:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(e))
    # Mark .enc files
    for obj in objects:
        obj["is_encrypted"] = obj.get("Key", "").endswith(".enc")
    return objects


@router.get("/download")
async def download_object(
    endpoint: str = Query(...),
    bucket: str = Query(...),
    key: str = Query(...),
    decrypt: bool = Query(False),
    job: Optional[str] = Query(None),
    server_id: Optional[int] = Query(None),
    _user: User = Depends(require_operator_or_admin),
):
    # Security: validate endpoint exists in config
    config = read_config()
    endpoints = config.get("s3_endpoints", [])
    ep = next((e for e in endpoints if e["name"] == endpoint), None)
    if ep is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Endpoint '{endpoint}' not found")

    passphrase = None
    if decrypt:
        if not job:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "Job name required for decryption",
            )
        # Resolve passphrase from job config
        from backend.services.bck_bridge import _bck_ready
        if _bck_ready:
            from encryption import get_encryption_config  # type: ignore
            job_config = get_job_by_name(job)
            if job_config is None:
                raise HTTPException(status.HTTP_404_NOT_FOUND, f"Job '{job}' not found")
            enc_cfg = get_encryption_config(job_config, config)
            passphrase = enc_cfg.get("passphrase")
            if not passphrase:
                raise HTTPException(
                    status.HTTP_400_BAD_REQUEST,
                    "No passphrase configured for this job",
                )

    try:
        return await stream_s3_download(ep, bucket, key, decrypt, passphrase)
    except Exception as e:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, str(e))


@router.post("/test")
async def test_connection(
    body: S3TestRequest,
    _user: User = Depends(require_operator_or_admin),
):
    try:
        ok = await bridge_test_s3(body.endpoint_name)
    except ValueError as e:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(e))
    return {"endpoint": body.endpoint_name, "success": ok}
