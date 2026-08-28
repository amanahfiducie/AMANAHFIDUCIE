from __future__ import annotations

from django.contrib.auth import get_user_model

from auditlog.services import log_audit
from documents.models import Document, DocumentAccessAction, DocumentAccessLog, DocumentVersion

User = get_user_model()


def log_document_access(
    *,
    request,
    document: Document,
    version: DocumentVersion | None,
    action: str,
    metadata: dict | None = None,
) -> DocumentAccessLog:
    ip_address = None
    user_agent = ""
    user = None
    if request is not None:
        user_agent = (request.META.get("HTTP_USER_AGENT") or "")[:500]
        forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
        ip_address = (
            forwarded.split(",")[0].strip()
            if forwarded
            else request.META.get("REMOTE_ADDR")
        )
        if request.user.is_authenticated:
            user = request.user

    access_log = DocumentAccessLog.objects.create(
        document=document,
        version=version,
        user=user,
        action=action,
        ip_address=ip_address,
        user_agent=user_agent,
        metadata_json=metadata or {},
    )
    log_audit(
        request=request,
        action=f"DOCUMENT_{action}",
        entity_type="Document",
        entity_id=document.pk,
        case=document.case,
        metadata={"document_access_log_id": access_log.pk, **(metadata or {})},
    )
    return access_log
