"""Stream S3 objects to the browser — optionally decrypting .enc files."""

import os
import tempfile
from typing import AsyncIterator

from fastapi.responses import StreamingResponse

from backend.services.bck_bridge import run_in_thread, _bck_ready
from backend.config import settings


async def stream_s3_download(
    endpoint_config: dict,
    bucket: str,
    key: str,
    decrypt: bool = False,
    passphrase: str | None = None,
) -> StreamingResponse:
    """Return a StreamingResponse that sends an S3 object to the client."""

    from s3_client import S3Client  # type: ignore
    import logging

    bck_logger = logging.getLogger("download_proxy")
    client = S3Client(
        endpoint_config["endpoint_url"],
        endpoint_config["access_key"],
        endpoint_config["secret_key"],
        endpoint_config["region"],
        bck_logger,
    )

    filename = os.path.basename(key)

    if not decrypt:
        # Direct stream — never buffer full file in memory
        def iterfile():
            response = client._client.get_object(Bucket=bucket, Key=key)
            for chunk in response["Body"].iter_chunks(chunk_size=8192):
                yield chunk

        return StreamingResponse(
            iterfile(),
            media_type="application/octet-stream",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )

    # Decrypt: download → decrypt → stream → cleanup
    if not passphrase:
        raise ValueError("Passphrase required for decryption")

    from encryption import decrypt_file  # type: ignore

    tmp_dir = tempfile.mkdtemp(prefix="bck_web_dl_")
    tmp_path = os.path.join(tmp_dir, filename)

    try:
        await run_in_thread(client.download_file, bucket, key, tmp_path)
        decrypted_path = await run_in_thread(decrypt_file, tmp_path, passphrase, bck_logger)
        decrypted_filename = os.path.basename(decrypted_path)

        def iterfile_decrypted():
            try:
                with open(decrypted_path, "rb") as f:
                    while chunk := f.read(8192):
                        yield chunk
            finally:
                # Cleanup temp files
                for p in (decrypted_path, tmp_path):
                    if os.path.exists(p):
                        os.unlink(p)
                if os.path.isdir(tmp_dir):
                    os.rmdir(tmp_dir)

        return StreamingResponse(
            iterfile_decrypted(),
            media_type="application/octet-stream",
            headers={
                "Content-Disposition": f'attachment; filename="{decrypted_filename}"'
            },
        )
    except Exception:
        # Cleanup on error
        for p in (tmp_path,):
            if os.path.exists(p):
                os.unlink(p)
        if os.path.isdir(tmp_dir):
            os.rmdir(tmp_dir)
        raise
