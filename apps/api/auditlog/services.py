from __future__ import annotations

from typing import Any

from django.http import HttpRequest

from accounts.models import RoleAssignment
from auditlog.models import AuditLog


def get_primary_actor_role(user) -> str:
    if user is None or not getattr(user, "is_authenticated", False):
        return ""
    roles = list(
        RoleAssignment.objects.filter(user=user)
        .order_by("role")
        .values_list("role", flat=True)
    )
    if user.is_superuser and "SUPER_ADMIN" not in roles:
        return "SUPER_ADMIN"
    return roles[0] if roles else ""


def log_audit(
    *,
    request: HttpRequest | None,
    action: str,
    entity_type: str,
    entity_id: str | int,
    case=None,
    metadata: dict[str, Any] | None = None,
    actor=None,
) -> AuditLog:
    user = actor
    if user is None and request is not None and request.user.is_authenticated:
        user = request.user

    ip_address = None
    user_agent = ""
    if request is not None:
        user_agent = (request.META.get("HTTP_USER_AGENT") or "")[:500]
        forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
        if forwarded:
            ip_address = forwarded.split(",")[0].strip()
        else:
            ip_address = request.META.get("REMOTE_ADDR")

    return AuditLog.objects.create(
        actor=user,
        actor_role=get_primary_actor_role(user),
        action=action,
        entity_type=entity_type,
        entity_id=str(entity_id),
        case=case,
        ip_address=ip_address,
        user_agent=user_agent,
        metadata_json=metadata or {},
    )
