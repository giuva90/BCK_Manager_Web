"""S3 / storage-related Pydantic schemas."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class EndpointRead(BaseModel):
    name: str
    endpoint_url: str
    region: str
    # access_key and secret_key are NEVER returned


class BucketRead(BaseModel):
    name: str
    creation_date: Optional[datetime] = None


class S3ObjectRead(BaseModel):
    key: str
    size: int
    last_modified: Optional[datetime] = None
    is_encrypted: bool = False  # True if key ends with .enc


class DownloadRequest(BaseModel):
    endpoint: str
    bucket: str
    key: str
    decrypt: bool = False
    job: Optional[str] = None  # required when decrypt=True


class S3TestRequest(BaseModel):
    endpoint_name: str
    server_id: Optional[int] = None
