from rest_framework.exceptions import NotFound, PermissionDenied

from cases.models import CaseStatus, FiduciaryCase
from cases.permissions import user_can_access_case, user_can_write_case

CASE_LOCKED_STATUSES = frozenset({CaseStatus.CLOSED, CaseStatus.REJECTED})


def get_accessible_case_or_404(user, case_pk: int) -> FiduciaryCase:
    try:
        case = FiduciaryCase.objects.get(pk=case_pk, deleted_at__isnull=True)
    except FiduciaryCase.DoesNotExist as exc:
        raise NotFound("Dossier introuvable.") from exc
    if not user_can_access_case(user, case):
        raise PermissionDenied("Accès refusé à ce dossier.")
    return case


def ensure_case_writable(user, case: FiduciaryCase) -> None:
    if not user_can_write_case(user):
        raise PermissionDenied("Vous ne pouvez pas modifier ce dossier.")
    if case.status in CASE_LOCKED_STATUSES:
        label = "clôturé" if case.status == CaseStatus.CLOSED else "rejeté"
        raise PermissionDenied(
            f"Ce dossier est {label} : aucune modification n'est possible."
        )
