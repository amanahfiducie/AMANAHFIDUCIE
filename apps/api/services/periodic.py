"""Génération périodique des honoraires (annuel / trimestriel)."""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from assets.services import get_case_patrimony_summary
from cases.models import CaseStatus, FiduciaryCase
from services.billing import (
    create_case_billing_charge,
    post_case_billing_charge,
    resolve_tiered_rule,
)
from services.models import (
    BillingFormula,
    BillingPeriodicity,
    CaseBillingCharge,
    CaseBillingChargeStatus,
    ServiceBillingRule,
    ServiceOffer,
)

PERIODICITIES = (
    BillingPeriodicity.ANNUAL,
    BillingPeriodicity.QUARTERLY,
)


@dataclass
class PeriodicGenerationResult:
    created: list[dict]
    skipped: list[dict]
    errors: list[dict]


def default_period_label(*, periodicity: str, as_of=None) -> str:
    today = as_of or timezone.localdate()
    if periodicity == BillingPeriodicity.QUARTERLY:
        quarter = (today.month - 1) // 3 + 1
        return f"{today.year}-Q{quarter}"
    return str(today.year)


def charge_already_exists(
    *,
    case_id: int,
    period_label: str,
    rule_id: int | None = None,
    formula: str | None = None,
) -> bool:
    qs = CaseBillingCharge.objects.filter(
        case_id=case_id,
        period_label=period_label,
    ).exclude(status=CaseBillingChargeStatus.CANCELLED)
    if formula:
        qs = qs.filter(formula=formula)
    elif rule_id is not None:
        qs = qs.filter(billing_rule_id=rule_id)
    return qs.exists()


def list_service_billed_cases(case_type: str) -> dict:
    offer = ServiceOffer.objects.filter(case_type=case_type).first()
    cases = (
        FiduciaryCase.objects.filter(case_type=case_type, deleted_at__isnull=True)
        .exclude(status=CaseStatus.REJECTED)
        .order_by("-updated_at", "-pk")
    )
    items = []
    for case in cases:
        charges = CaseBillingCharge.objects.filter(case=case).exclude(
            status=CaseBillingChargeStatus.CANCELLED
        )
        posted = charges.filter(status=CaseBillingChargeStatus.POSTED)
        draft = charges.filter(status=CaseBillingChargeStatus.DRAFT)
        last = charges.order_by("-movement_date", "-created_at").first()
        total_posted = sum((c.amount for c in posted), Decimal("0"))
        items.append(
            {
                "id": case.pk,
                "reference": case.reference,
                "title": case.title,
                "status": case.status,
                "status_label": case.get_status_display(),
                "charges_count": charges.count(),
                "draft_count": draft.count(),
                "posted_count": posted.count(),
                "total_posted": str(total_posted),
                "currency": last.currency if last else "XOF",
                "last_charge_label": last.label if last else None,
                "last_charge_period": last.period_label if last else None,
                "last_charge_status": last.status if last else None,
                "last_charge_amount": str(last.amount) if last else None,
                "updated_at": case.updated_at.isoformat(),
            }
        )
    return {
        "case_type": case_type,
        "service": (
            {
                "id": offer.pk,
                "name": offer.name,
                "case_type": offer.case_type,
            }
            if offer
            else None
        ),
        "cases": items,
        "count": len(items),
    }


def list_billing_invoices(*, status: str | None = None, case_type: str | None = None) -> list[dict]:
    from services.billing import serialize_billing_invoice

    qs = CaseBillingCharge.objects.select_related(
        "case",
        "billing_rule",
        "created_by",
        "enterprise_movement",
    ).exclude(status=CaseBillingChargeStatus.CANCELLED)
    if status:
        qs = qs.filter(status=status)
    if case_type:
        qs = qs.filter(case__case_type=case_type)
    return [
        serialize_billing_invoice(c)
        for c in qs.order_by("-movement_date", "-created_at")[:500]
    ]

@transaction.atomic
def generate_periodic_charges(
    *,
    case_type: str | None,
    actor,
    period_label: str = "",
    rule_ids: list[int] | None = None,
    post: bool = False,
    dry_run: bool = False,
    case_ids: list[int] | None = None,
) -> PeriodicGenerationResult:
    rules_qs = ServiceBillingRule.objects.filter(
        is_active=True,
        periodicity__in=PERIODICITIES,
        service__is_active=True,
    ).select_related("service")
    if case_type:
        rules_qs = rules_qs.filter(service__case_type=case_type)
    if rule_ids:
        rules_qs = rules_qs.filter(pk__in=rule_ids)
    rules = list(rules_qs.order_by("service_id", "sort_order", "id"))
    if not rules:
        raise ValidationError(
            {
                "detail": (
                    "Aucune règle annuelle/trimestrielle active pour ce périmètre."
                )
            }
        )

    # Grouper les règles AUM par (case_type, periodicity) pour n'appliquer qu'une tranche
    aum_groups: dict[tuple[str, str], list[ServiceBillingRule]] = {}
    other_rules: list[ServiceBillingRule] = []
    for rule in rules:
        if rule.formula == BillingFormula.MANAGEMENT_FEE_AUM:
            key = (rule.service.case_type, rule.periodicity)
            aum_groups.setdefault(key, []).append(rule)
        else:
            other_rules.append(rule)

    created: list[dict] = []
    skipped: list[dict] = []
    errors: list[dict] = []

    def _process(case, rule: ServiceBillingRule, period: str, *, dedupe_formula: str | None):
        base_meta = {
            "case_id": case.pk,
            "reference": case.reference,
            "rule_id": rule.pk,
            "rule_label": rule.label,
            "period_label": period,
        }
        if charge_already_exists(
            case_id=case.pk,
            period_label=period,
            formula=dedupe_formula,
            rule_id=None if dedupe_formula else rule.pk,
        ):
            skipped.append({**base_meta, "reason": "already_exists"})
            return
        if dry_run:
            created.append({**base_meta, "status": "DRY_RUN", "amount": None})
            return
        try:
            charge = create_case_billing_charge(
                case=case,
                rule=rule,
                actor=actor,
                period_label=period,
            )
            if post:
                charge = post_case_billing_charge(charge=charge, actor=actor)
            created.append(
                {
                    **base_meta,
                    "charge_id": charge.pk,
                    "amount": str(charge.amount),
                    "currency": charge.currency,
                    "status": charge.status,
                }
            )
        except Exception as exc:  # noqa: BLE001
            detail = getattr(exc, "detail", None)
            if isinstance(detail, dict):
                message = "; ".join(f"{k}: {v}" for k, v in detail.items())
            else:
                message = str(detail or exc)
            errors.append({**base_meta, "error": message})

    for (ct, periodicity), group in aum_groups.items():
        period = (period_label or "").strip() or default_period_label(
            periodicity=periodicity
        )
        cases_qs = FiduciaryCase.objects.filter(
            case_type=ct,
            deleted_at__isnull=True,
            status=CaseStatus.ACTIVE,
        )
        if case_ids:
            cases_qs = cases_qs.filter(pk__in=case_ids)
        for case in cases_qs.order_by("pk"):
            summary = get_case_patrimony_summary(case)
            aum = Decimal(str(summary.get("total_estimated_value") or "0"))
            rule = resolve_tiered_rule(
                rules=group,
                formula=BillingFormula.MANAGEMENT_FEE_AUM,
                base=aum,
            )
            if rule is None:
                errors.append(
                    {
                        "case_id": case.pk,
                        "reference": case.reference,
                        "rule_id": None,
                        "rule_label": "AUM",
                        "period_label": period,
                        "error": f"Aucune tranche AUM pour la base {aum}.",
                    }
                )
                continue
            _process(
                case,
                rule,
                period,
                dedupe_formula=BillingFormula.MANAGEMENT_FEE_AUM,
            )

    for rule in other_rules:
        period = (period_label or "").strip() or default_period_label(
            periodicity=rule.periodicity
        )
        cases_qs = FiduciaryCase.objects.filter(
            case_type=rule.service.case_type,
            deleted_at__isnull=True,
            status=CaseStatus.ACTIVE,
        )
        if case_ids:
            cases_qs = cases_qs.filter(pk__in=case_ids)
        for case in cases_qs.order_by("pk"):
            _process(case, rule, period, dedupe_formula=None)

    return PeriodicGenerationResult(created=created, skipped=skipped, errors=errors)
