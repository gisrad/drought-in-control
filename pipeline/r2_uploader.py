"""Cloudflare R2 S3-compatible uploader with --dry-run local output support."""

import json
import os
from pathlib import Path
from typing import Any

from config import R2_BUCKET, R2_ENDPOINT, R2_PREFIX


def upload_artifacts(
    artifacts: dict[str, Any],
    out_dir: Path,
    dry_run: bool = False,
) -> list[str]:
    out_dir.mkdir(parents=True, exist_ok=True)
    written_keys: list[str] = []

    for rel_name, payload in artifacts.items():
        local_path = out_dir / rel_name
        local_path.parent.mkdir(parents=True, exist_ok=True)
        body = json.dumps(payload, ensure_ascii=False, indent=2)
        local_path.write_text(body, encoding="utf-8")
        key = f"{R2_PREFIX}/{rel_name}".replace("\\", "/")
        written_keys.append(key)

    if dry_run:
        return written_keys

    access_key = os.environ.get("R2_ACCESS_KEY_ID", "")
    secret_key = os.environ.get("R2_SECRET_ACCESS_KEY", "")
    endpoint = R2_ENDPOINT
    if not (access_key and secret_key and endpoint):
        raise RuntimeError("R2 credentials (R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY) missing.")

    import boto3  # type: ignore

    client = boto3.client(
        "s3",
        endpoint_url=endpoint,
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        region_name="auto",
    )
    for rel_name, payload in artifacts.items():
        key = f"{R2_PREFIX}/{rel_name}".replace("\\", "/")
        client.put_object(
            Bucket=R2_BUCKET,
            Key=key,
            Body=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
            ContentType="application/json; charset=utf-8",
            CacheControl="public, max-age=3600",
        )
    return written_keys
