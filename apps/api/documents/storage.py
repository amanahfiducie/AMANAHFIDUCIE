from __future__ import annotations

from django.conf import settings
from django.core import signing
from django.urls import reverse


def use_s3_storage() -> bool:
    return getattr(settings, "USE_S3", False)


def get_download_expiry_seconds() -> int:
    return int(getattr(settings, "DOCUMENT_DOWNLOAD_URL_EXPIRY", 3600))


def build_signed_app_download_url(
    request,
    document_id: int,
    version_id: int,
    *,
    inline: bool = False,
) -> str:
    """URL signée passant par l’API (stockage fichier local)."""
    payload = signing.dumps(
        {"document_id": document_id, "version_id": version_id},
        salt="document-download",
    )
    path = reverse("document-signed-download")
    url = request.build_absolute_uri(f"{path}?token={payload}")
    if inline:
        return f"{url}&inline=1"
    return url


def generate_presigned_s3_url(
    file_key: str,
    expires: int | None = None,
    *,
    inline: bool = False,
    content_type: str | None = None,
    content_disposition: str | None = None,
) -> str:
    import boto3
    from botocore.client import Config

    expires = expires or get_download_expiry_seconds()
    client = boto3.client(
        "s3",
        endpoint_url=settings.AWS_S3_ENDPOINT_URL,
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        region_name=getattr(settings, "AWS_S3_REGION_NAME", "us-east-1"),
        config=Config(signature_version="s3v4"),
    )
    params: dict[str, str] = {
        "Bucket": settings.AWS_STORAGE_BUCKET_NAME,
        "Key": file_key,
    }
    if content_disposition:
        params["ResponseContentDisposition"] = content_disposition
    elif inline:
        params["ResponseContentDisposition"] = "inline"
    if content_type:
        params["ResponseContentType"] = content_type
    return client.generate_presigned_url(
        "get_object",
        Params=params,
        ExpiresIn=expires,
    )


def resolve_download_url(request, version, *, inline: bool = False) -> tuple[str, int]:
    expires = get_download_expiry_seconds()
    if use_s3_storage():
        content_type = version.mime_type or None
        url = generate_presigned_s3_url(
            version.file.name,
            expires=expires,
            inline=inline,
            content_type=content_type,
        )
    else:
        url = build_signed_app_download_url(
            request,
            version.document_id,
            version.pk,
            inline=inline,
        )
    return url, expires


def resolve_preview_url(request, version) -> tuple[str, int]:
    """URL pour affichage inline dans le navigateur (aperçu PDF)."""
    return resolve_download_url(request, version, inline=True)
