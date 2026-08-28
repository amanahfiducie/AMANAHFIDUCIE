import re
import unicodedata
from datetime import date
from uuid import uuid4

from django.core.exceptions import ValidationError


def validate_pdf_upload(uploaded_file) -> None:
    name = (getattr(uploaded_file, "name", "") or "").lower()
    content_type = (getattr(uploaded_file, "content_type", "") or "").lower()
    if not name.endswith(".pdf"):
        raise ValidationError("La justification doit être un fichier PDF (.pdf).")
    if content_type and content_type not in ("application/pdf", "application/x-pdf"):
        raise ValidationError("La justification doit être au format PDF.")


def _slugify_filename_part(value: str, *, max_len: int = 72) -> str:
    normalized = unicodedata.normalize("NFKD", (value or "").strip())
    ascii_text = normalized.encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^\w\s-]", "", ascii_text).strip().lower()
    slug = re.sub(r"[-\s]+", "-", slug).strip("-")
    if not slug:
        return "justificatif"
    return slug[:max_len].strip("-") or "justificatif"


def _coerce_event_date(value) -> date | None:
    if value is None:
        return None
    if isinstance(value, date):
        return value
    if isinstance(value, str) and value.strip():
        from datetime import datetime

        return datetime.strptime(value.strip()[:10], "%Y-%m-%d").date()
    return None


def build_justification_storage_name(*, label: str, event_date: date | str | None) -> str:
    """Nom de fichier : {nom}_{YYYY-MM-DD}.pdf (suffixe court si collision probable)."""
    name_part = _slugify_filename_part(label)
    parsed = _coerce_event_date(event_date)
    date_part = parsed.isoformat() if parsed else "sans-date"
    return f"{name_part}_{date_part}_{uuid4().hex[:6]}.pdf"


def rename_justification_upload(
    uploaded_file,
    *,
    label: str,
    event_date: date | str | None,
) -> None:
    validate_pdf_upload(uploaded_file)
    uploaded_file.name = build_justification_storage_name(
        label=label,
        event_date=event_date,
    )
