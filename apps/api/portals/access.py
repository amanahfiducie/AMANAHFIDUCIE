from django.db.models import Q

from cases.models import FiduciaryCase
from documents.models import Document, DocumentCategory
from cases.permissions import user_can_access_case


NOTARY_DOCUMENT_CATEGORIES = {
    DocumentCategory.MANDATE,
    DocumentCategory.NOTARIAL_ACT,
    DocumentCategory.PROPERTY_TITLE,
    DocumentCategory.REPORT,
    DocumentCategory.CONTRACT,
}

JUDGE_DOCUMENT_CATEGORIES = {
    DocumentCategory.COURT_DECISION,
    DocumentCategory.REPORT,
    DocumentCategory.MANDATE,
}


def get_stakeholder_cases_queryset(user):
    return (
        FiduciaryCase.objects.filter(
            deleted_at__isnull=True,
            stakeholders__user=user,
        )
        .select_related("created_by", "assigned_to")
        .distinct()
    )


def get_accessible_portal_case_or_404(user, case_pk: int) -> FiduciaryCase:
    from rest_framework.exceptions import NotFound, PermissionDenied

    try:
        case = FiduciaryCase.objects.get(pk=case_pk, deleted_at__isnull=True)
    except FiduciaryCase.DoesNotExist as exc:
        raise NotFound("Dossier introuvable.") from exc
    if not user_can_access_case(user, case):
        raise PermissionDenied("Accès refusé à ce dossier.")
    return case


def get_portal_documents_queryset(user, case: FiduciaryCase, portal_kind: str):
    base = Document.objects.filter(case=case, deleted_at__isnull=True).select_related(
        "uploaded_by"
    ).prefetch_related("tags", "versions")

    shared = Q(shares__shared_with_user=user)

    if portal_kind == "portal":
        return base.filter(shared).distinct()

    if portal_kind == "notaire":
        return base.filter(
            shared | Q(category__in=NOTARY_DOCUMENT_CATEGORIES, is_confidential=False)
        ).distinct()

    if portal_kind == "juge":
        return base.filter(
            shared | Q(category__in=JUDGE_DOCUMENT_CATEGORIES, is_confidential=False)
        ).distinct()

    return base.none()
