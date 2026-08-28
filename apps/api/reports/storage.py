from __future__ import annotations

from urllib.parse import quote

from django.conf import settings
from django.core import signing
from django.urls import reverse

from documents.storage import generate_presigned_s3_url, use_s3_storage


def get_download_expiry_seconds() -> int:
    return int(getattr(settings, "DOCUMENT_DOWNLOAD_URL_EXPIRY", 3600))


def build_signed_report_download_url(request, report_id: int) -> str:
    payload = signing.dumps({"report_id": report_id}, salt="report-download")
    path = reverse("report-signed-download")
    return request.build_absolute_uri(f"{path}?token={payload}")


def resolve_report_download_url(request, report) -> tuple[str, int]:
    expires = get_download_expiry_seconds()
    if not report.file:
        raise ValueError("Aucun fichier de rapport disponible.")
    if use_s3_storage():
        from reports.services import report_pdf_filename

        filename = report_pdf_filename(report)
        disposition = (
            f'attachment; filename="{filename}"; '
            f"filename*=UTF-8''{quote(filename)}"
        )
        url = generate_presigned_s3_url(
            report.file.name,
            expires=expires,
            content_type="application/pdf",
            content_disposition=disposition,
        )
    else:
        url = build_signed_report_download_url(request, report.pk)
    return url, expires
