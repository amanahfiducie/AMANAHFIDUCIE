from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from beneficiaries.models import Beneficiary
from cases.models import FiduciaryCase
from faraid.models import (
    FaraidCommitteeReview,
    FaraidHeir,
    FaraidHeirDecision,
    FaraidHeirDecisionSource,
    FaraidHeirDecisionStatus,
    FaraidReviewStatus,
)


def _heir_name(beneficiary: Beneficiary) -> str:
    return (
        " ".join(
            part
            for part in (beneficiary.first_name, beneficiary.last_name)
            if part
        ).strip()
        or f"Membre #{beneficiary.pk}"
    )


def _relationship_label(beneficiary: Beneficiary) -> str:
    return beneficiary.get_relation_to_donor_display()


def map_beneficiary_faraid_role(beneficiary: Beneficiary, deceased_gender: str) -> str | None:
    relation = beneficiary.relation_to_donor
    gender = beneficiary.gender
    if relation == "SPOUSE":
        return "WIFE" if deceased_gender == "M" else "HUSBAND"
    if relation == "CHILD":
        return "DAUGHTER" if gender == "F" else "SON"
    if relation == "PARENT":
        return "MOTHER" if gender == "F" else "FATHER"
    if relation == "SIBLING":
        return "SISTER_FULL" if gender == "F" else "BROTHER_FULL"
    return None


@transaction.atomic
def get_or_create_review(case: FiduciaryCase) -> FaraidCommitteeReview:
    review, _ = FaraidCommitteeReview.objects.get_or_create(case=case)
    return review


@transaction.atomic
def sync_review_from_genealogy(
    review: FaraidCommitteeReview,
    *,
    deceased_gender: str = "M",
) -> FaraidCommitteeReview:
    case = review.case
    existing_beneficiary_ids = set(
        review.heir_decisions.filter(beneficiary_id__isnull=False).values_list(
            "beneficiary_id",
            flat=True,
        )
    )
    for beneficiary in Beneficiary.objects.filter(case=case).order_by("id"):
        if beneficiary.id in existing_beneficiary_ids:
            continue
        faraid_role = map_beneficiary_faraid_role(beneficiary, deceased_gender)
        FaraidHeirDecision.objects.create(
            review=review,
            beneficiary=beneficiary,
            source=FaraidHeirDecisionSource.FROM_GENEALOGY,
            full_name=_heir_name(beneficiary),
            relationship_label=_relationship_label(beneficiary),
            faraid_role=faraid_role or "",
            status=FaraidHeirDecisionStatus.PENDING,
        )
    return review


@transaction.atomic
def finalize_faraid_review(review: FaraidCommitteeReview, *, actor) -> FaraidCommitteeReview:
    accepted = list(
        review.heir_decisions.filter(status=FaraidHeirDecisionStatus.ACCEPTED).order_by("id")
    )
    if not accepted:
        raise ValueError("Au moins un héritier accepté est requis.")

    rejected_without_reason = review.heir_decisions.filter(
        status=FaraidHeirDecisionStatus.REJECTED,
        rejection_justification="",
    )
    if rejected_without_reason.exists():
        raise ValueError("Chaque personne refusée doit avoir une justification écrite.")

    FaraidHeir.objects.filter(case=review.case).delete()
    for decision in accepted:
        fraction = decision.share_fraction or Decimal("0")
        FaraidHeir.objects.create(
            case=review.case,
            beneficiary=decision.beneficiary,
            full_name=decision.full_name,
            relationship_label=decision.relationship_label,
            share_fraction=fraction,
            notes=decision.committee_notes,
        )

    review.status = FaraidReviewStatus.FINALIZED
    review.finalized_at = timezone.now()
    review.finalized_by = actor
    review.save(update_fields=["status", "finalized_at", "finalized_by", "updated_at"])

    onboarding = dict(review.case.onboarding_data or {})
    succession = dict(onboarding.get("succession") or {})
    succession["faraid_completed"] = True
    onboarding["succession"] = succession
    onboarding["faraid_completed"] = True
    review.case.onboarding_data = onboarding
    review.case.save(update_fields=["onboarding_data", "updated_at"])
    return review
