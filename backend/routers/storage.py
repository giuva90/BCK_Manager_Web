"""S3 Storage explorer routes — browse, download, test."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from backend.models.user import User
from backend.auth.dependencies import get_current_user, require_admin, require_operator_or_admin
from backend.schemas.s3 import S3TestRequest
from backend.services.bck_bridge import (
    bridge_list_buckets,
    bridge_browse_storage,
    bridge_delete_object,
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
    except Exception as e:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(e))
    # Normalize boto3 uppercase keys to frontend-expected lowercase
    return [
        {
            "name": b.get("Name", ""),
            "creation_date": b.get("CreationDate", ""),
        }
        for b in buckets
    ]


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

    # Extract folder-like common prefixes and direct files from flat object list
    folders: set[str] = set()
    files: list[dict] = []
    for obj in objects:
        key = obj.get("Key", "")
        # Strip the current prefix to get the relative part
        relative = key[len(prefix):]
        if "/" in relative:
            # This key is nested — extract the immediate subfolder
            folder_name = relative.split("/")[0]
            folders.add(prefix + folder_name + "/")
        else:
            if relative:  # skip the prefix-only key itself
                files.append(obj)

    result: list[dict] = []
    # Add folder entries
    for folder_key in sorted(folders):
        result.append({
            "key": folder_key,
            "size": 0,
            "last_modified": "",
            "is_folder": True,
            "is_encrypted": False,
        })
    # Add file entries with normalized keys
    for obj in files:
        key = obj.get("Key", "")
        result.append({
            "key": key,
            "size": obj.get("Size", 0),
            "last_modified": obj.get("LastModified", ""),
            "is_folder": False,
            "is_encrypted": key.endswith(".enc"),
        })
    return result


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


@router.delete("/object", status_code=204)
async def delete_object_route(
    endpoint: str = Query(...),
    bucket: str = Query(...),
    key: str = Query(...),
    _user: User = Depends(require_admin),
):
    # Validate endpoint exists in config
    config = read_config()
    endpoints = config.get("s3_endpoints", [])
    ep = next((e for e in endpoints if e["name"] == endpoint), None)
    if ep is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Endpoint '{endpoint}' not found")
    try:
        await bridge_delete_object(endpoint, bucket, key)
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
    except Exception as e:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(e))
    return {"endpoint": body.endpoint_name, "success": ok}
