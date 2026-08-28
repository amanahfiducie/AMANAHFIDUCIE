"""Calcul et comptabilisation des honoraires par dossier."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from decimal import Decimal, ROUND_HALF_UP

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from assets.services import get_case_patrimony_summary
from finance.enterprise_services import get_default_enterprise_account
from finance.models import (
    CategoryScope,
    EnterpriseMovement,
    MovementCategory,
    MovementStatus,
    MovementType,
)
from services.models import (
    BillingFormula,
    BillingPeriodicity,
    CaseBillingCharge,
    CaseBillingChargeStatus,
    ServiceBillingRule,
    ServiceOffer,
)

ZERO = Decimal("0")


def _quantize(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def rule_matches_base(rule: ServiceBillingRule, base: Decimal) -> bool:
    """True si la base (AUM / patrimoine) tombe dans la tranche de la règle."""
    if rule.base_min is not None and base < rule.base_min:
        return False
    if rule.base_max is not None and base > rule.base_max:
        return False
    return True


def resolve_tiered_rule(
    *,
    rules,
    formula: str,
    base: Decimal,
) -> ServiceBillingRule | None:
    """Choisit la règle de la formule dont la tranche couvre la base."""
    candidates = [
        r
        for r in rules
        if r.is_active and r.formula == formula and rule_matches_base(r, base)
    ]
    if not candidates:
        return None
    # Préférer la tranche la plus spécifique (avec bornes)
    candidates.sort(
        key=lambda r: (
            0 if r.base_min is not None or r.base_max is not None else 1,
            r.sort_order,
            r.pk,
        )
    )
    return candidates[0]


def get_revenue_category_for_case_type(case_type: str) -> MovementCategory | None:
    return (
        MovementCategory.objects.filter(
            scope=CategoryScope.REVENUE,
            service_type=case_type,
            is_active=True,
        )
        .order_by("sort_order", "pk")
        .first()
    )


@dataclass
class ChargeComputation:
    formula: str
    label: str
    amount: Decimal
    currency: str
    base_amount: Decimal | None
    rate_percent: Decimal | None
    period_label: str
    notes: str


def compute_charge_from_rule(
    *,
    case,
    rule: ServiceBillingRule,
    period_label: str = "",
    base_override: Decimal | None = None,
    rate_override: Decimal | None = None,
    fixed_override: Decimal | None = None,
) -> ChargeComputation:
    if not rule.is_active:
        raise ValidationError({"billing_rule": "Cette règle tarifaire est inactive."})
    if rule.service.case_type != case.case_type:
        raise ValidationError(
            {"billing_rule": "La règle ne correspond pas au type de dossier."}
        )

    summary = get_case_patrimony_summary(case)
    aum = Decimal(str(summary.get("total_estimated_value") or "0"))
    net_benefit = Decimal(str(summary.get("net_benefit") or "0"))
    currency = rule.currency or summary.get("currency") or "XOF"
    period = (period_label or "").strip() or str(timezone.localdate().year)

    rate = rate_override if rate_override is not None else rule.rate_percent
    fixed = fixed_override if fixed_override is not None else rule.fixed_amount

    # Vérifie la tranche si la règle en définit une (sauf override manuel de base hors tranche
    # — on signale alors clairement).
    check_base = None
    if rule.formula == BillingFormula.MANAGEMENT_FEE_AUM:
        check_base = base_override if base_override is not None else aum
    elif rule.formula in (
        BillingFormula.MISSION_FEE,
        BillingFormula.OPENING_FEE,
        BillingFormula.OTHER,
    ):
        # Tranches Zakat / missions : base = patrimoine si pas d'override
        if rule.base_min is not None or rule.base_max is not None:
            check_base = base_override if base_override is not None else aum

    if check_base is not None and not rule_matches_base(rule, check_base):
        raise ValidationError(
            {
                "billing_rule": (
                    "Cette règle tarifaire ne correspond pas à la tranche "
                    f"applicable pour la base {check_base} {currency}."
                )
            }
        )

    if rule.formula == BillingFormula.MANAGEMENT_FEE_AUM:
        base = base_override if base_override is not None else aum
        if base <= 0:
            raise ValidationError(
                {
                    "base_amount": (
                        "AUM / patrimoine estimé nul : enregistrez des valorisations "
                        "ou saisissez une base manuelle."
                    )
                }
            )
        if rate is None:
            raise ValidationError({"rate_percent": "Taux manquant sur la règle."})
        amount = _quantize(base * (rate / Decimal("100")))
        return ChargeComputation(
            formula=rule.formula,
            label=rule.label,
            amount=amount,
            currency=currency,
            base_amount=base,
            rate_percent=rate,
            period_label=period,
            notes=f"Frais de gestion {rate} % sur base {base} {currency}.",
        )

    if rule.formula == BillingFormula.PERFORMANCE_FEE:
        base = base_override if base_override is not None else net_benefit
        if base <= 0:
            raise ValidationError(
                {
                    "base_amount": (
                        "Aucun profit net positif sur le patrimoine : "
                        "la commission de performance ne s'applique pas "
                        "(ou saisissez une base manuelle)."
                    )
                }
            )
        if rate is None:
            raise ValidationError({"rate_percent": "Taux manquant sur la règle."})
        amount = _quantize(base * (rate / Decimal("100")))
        return ChargeComputation(
            formula=rule.formula,
            label=rule.label,
            amount=amount,
            currency=currency,
            base_amount=base,
            rate_percent=rate,
            period_label=period,
            notes=f"Performance {rate} % sur profit net {base} {currency}.",
        )

    # OPENING_FEE / MISSION_FEE / OTHER — forfait
    if fixed is None or fixed <= 0:
        raise ValidationError(
            {
                "fixed_amount": (
                    "Montant forfaitaire requis. Complétez la règle tarifaire "
                    "ou saisissez un montant pour cette facturation."
                )
            }
        )
    return ChargeComputation(
        formula=rule.formula,
        label=rule.label,
        amount=_quantize(fixed),
        currency=currency,
        base_amount=None,
        rate_percent=None,
        period_label=period,
        notes=rule.description or "Honoraires forfaitaires.",
    )


def build_case_billing_overview(case) -> dict:
    offer = ServiceOffer.objects.filter(case_type=case.case_type).first()
    summary = get_case_patrimony_summary(case)
    rules = []
    if offer:
        for rule in offer.billing_rules.filter(is_active=True).order_by(
            "sort_order", "id"
        ):
            rules.append(
                {
                    "id": rule.pk,
                    "formula": rule.formula,
                    "formula_label": rule.get_formula_display(),
                    "label": rule.label,
                    "description": rule.description,
                    "rate_percent": (
                        str(rule.rate_percent) if rule.rate_percent is not None else None
                    ),
                    "rate_min_percent": (
                        str(rule.rate_min_percent)
                        if rule.rate_min_percent is not None
                        else None
                    ),
                    "rate_max_percent": (
                        str(rule.rate_max_percent)
                        if rule.rate_max_percent is not None
                        else None
                    ),
                    "fixed_amount": (
                        str(rule.fixed_amount) if rule.fixed_amount is not None else None
                    ),
                    "fixed_amount_min": (
                        str(rule.fixed_amount_min)
                        if rule.fixed_amount_min is not None
                        else None
                    ),
                    "fixed_amount_max": (
                        str(rule.fixed_amount_max)
                        if rule.fixed_amount_max is not None
                        else None
                    ),
                    "base_min": (
                        str(rule.base_min) if rule.base_min is not None else None
                    ),
                    "base_max": (
                        str(rule.base_max) if rule.base_max is not None else None
                    ),
                    "periodicity": rule.periodicity,
                    "periodicity_label": rule.get_periodicity_display(),
                    "currency": rule.currency,
                    "applies_to_current_aum": rule_matches_base(
                        rule,
                        Decimal(str(summary.get("total_estimated_value") or "0")),
                    ),
                }
            )

    charges = CaseBillingCharge.objects.filter(case=case).select_related(
        "billing_rule",
        "created_by",
        "enterprise_movement",
    )
    return {
        "case_id": case.pk,
        "case_type": case.case_type,
        "case_type_label": case.get_case_type_display(),
        "service": (
            {
                "id": offer.pk,
                "name": offer.name,
                "case_type": offer.case_type,
                "is_active": offer.is_active,
            }
            if offer
            else None
        ),
        "aum": {
            "total_estimated_value": summary.get("total_estimated_value"),
            "currency": summary.get("currency", "XOF"),
            "asset_count": summary.get("asset_count", 0),
            "net_benefit": summary.get("net_benefit"),
            "total_gains": summary.get("total_gains"),
            "total_expenses": summary.get("total_expenses"),
        },
        "available_rules": rules,
        "charges": [
            {
                "id": c.pk,
                "billing_rule_id": c.billing_rule_id,
                "formula": c.formula,
                "formula_label": c.get_formula_display(),
                "label": c.label,
                "base_amount": str(c.base_amount) if c.base_amount is not None else None,
                "rate_percent": str(c.rate_percent) if c.rate_percent is not None else None,
                "amount": str(c.amount),
                "currency": c.currency,
                "period_label": c.period_label,
                "movement_date": c.movement_date.isoformat(),
                "status": c.status,
                "status_label": c.get_status_display(),
                "enterprise_movement_id": c.enterprise_movement_id,
                "notes": c.notes,
                "created_by_username": (
                    c.created_by.username if c.created_by_id else None
                ),
                "created_at": c.created_at.isoformat(),
            }
            for c in charges
        ],
    }


@transaction.atomic
def create_case_billing_charge(
    *,
    case,
    rule: ServiceBillingRule,
    actor,
    period_label: str = "",
    movement_date: date | None = None,
    base_override: Decimal | None = None,
    rate_override: Decimal | None = None,
    fixed_override: Decimal | None = None,
    notes: str = "",
) -> CaseBillingCharge:
    computed = compute_charge_from_rule(
        case=case,
        rule=rule,
        period_label=period_label,
        base_override=base_override,
        rate_override=rate_override,
        fixed_override=fixed_override,
    )
    return CaseBillingCharge.objects.create(
        case=case,
        billing_rule=rule,
        formula=computed.formula,
        label=computed.label,
        base_amount=computed.base_amount,
        rate_percent=computed.rate_percent,
        amount=computed.amount,
        currency=computed.currency,
        period_label=computed.period_label,
        movement_date=movement_date or timezone.localdate(),
        status=CaseBillingChargeStatus.DRAFT,
        notes=(notes or computed.notes).strip(),
        created_by=actor,
    )


@transaction.atomic
def update_case_billing_charge(
    *,
    charge: CaseBillingCharge,
    label: str | None = None,
    amount: Decimal | None = None,
    rate_percent: Decimal | None = None,
    base_amount: Decimal | None = None,
    period_label: str | None = None,
    movement_date: date | None = None,
    notes: str | None = None,
) -> CaseBillingCharge:
    if charge.status != CaseBillingChargeStatus.DRAFT:
        raise ValidationError(
            {"detail": "Seuls les brouillons de facture peuvent être modifiés."}
        )
    update_fields = ["updated_at"]
    if label is not None:
        charge.label = label.strip() or charge.label
        update_fields.append("label")
    if amount is not None:
        if amount <= 0:
            raise ValidationError({"amount": "Le montant doit être positif."})
        charge.amount = _quantize(amount)
        update_fields.append("amount")
    if rate_percent is not None:
        charge.rate_percent = rate_percent
        update_fields.append("rate_percent")
    if base_amount is not None:
        charge.base_amount = base_amount
        update_fields.append("base_amount")
    if period_label is not None:
        charge.period_label = period_label.strip()
        update_fields.append("period_label")
    if movement_date is not None:
        charge.movement_date = movement_date
        update_fields.append("movement_date")
    if notes is not None:
        charge.notes = notes.strip()
        update_fields.append("notes")
    charge.save(update_fields=update_fields)
    return charge


def serialize_billing_invoice(c: CaseBillingCharge) -> dict:
    return {
        "id": c.pk,
        "case_id": c.case_id,
        "case_reference": c.case.reference,
        "case_title": c.case.title,
        "case_type": c.case.case_type,
        "case_type_label": c.case.get_case_type_display(),
        "label": c.label,
        "formula": c.formula,
        "formula_label": c.get_formula_display(),
        "base_amount": str(c.base_amount) if c.base_amount is not None else None,
        "rate_percent": str(c.rate_percent) if c.rate_percent is not None else None,
        "amount": str(c.amount),
        "currency": c.currency,
        "period_label": c.period_label,
        "movement_date": c.movement_date.isoformat(),
        "status": c.status,
        "status_label": c.get_status_display(),
        "enterprise_movement_id": c.enterprise_movement_id,
        "notes": c.notes,
        "billing_rule_id": c.billing_rule_id,
        "created_by_username": (
            c.created_by.username if c.created_by_id else None
        ),
        "created_at": c.created_at.isoformat(),
    }


@transaction.atomic
def auto_invoice_case(
    *,
    case,
    actor,
    period_label: str = "",
    post: bool = False,
    include_once: bool = True,
) -> dict:
    """
    Applique automatiquement les règles actives du service du dossier.
    - AUM : une seule tranche applicable
    - Autres formules : règles actives calculables (tranches respectées)
    """
    from services.periodic import charge_already_exists, default_period_label

    offer = ServiceOffer.objects.filter(
        case_type=case.case_type, is_active=True
    ).first()
    if offer is None:
        raise ValidationError(
            {"detail": "Aucun service catalogue pour ce type de dossier."}
        )

    rules = list(
        offer.billing_rules.filter(is_active=True).order_by("sort_order", "id")
    )
    summary = get_case_patrimony_summary(case)
    aum = Decimal(str(summary.get("total_estimated_value") or "0"))

    selected: list[ServiceBillingRule] = []
    aum_rule = resolve_tiered_rule(
        rules=rules,
        formula=BillingFormula.MANAGEMENT_FEE_AUM,
        base=aum,
    )
    if aum_rule is not None:
        selected.append(aum_rule)

    for rule in rules:
        if rule.formula == BillingFormula.MANAGEMENT_FEE_AUM:
            continue
        if rule.formula == BillingFormula.PERFORMANCE_FEE:
            # Uniquement si profit net > 0 (sinon skip silencieux)
            net = Decimal(str(summary.get("net_benefit") or "0"))
            if net <= 0:
                continue
        if (
            rule.periodicity == BillingPeriodicity.ONCE
            or rule.formula
            in (BillingFormula.OPENING_FEE, BillingFormula.MISSION_FEE)
        ) and not include_once:
            continue
        if rule.base_min is not None or rule.base_max is not None:
            if not rule_matches_base(rule, aum):
                continue
        selected.append(rule)

    created = []
    skipped = []
    errors = []
    for rule in selected:
        period = (period_label or "").strip() or default_period_label(
            periodicity=rule.periodicity
        )
        # Ponctuel : dédupliquer sur formule+règle sans période stricte
        if rule.periodicity == BillingPeriodicity.ONCE:
            exists = CaseBillingCharge.objects.filter(
                case=case,
                billing_rule=rule,
            ).exclude(status=CaseBillingChargeStatus.CANCELLED).exists()
        else:
            exists = charge_already_exists(
                case_id=case.pk,
                period_label=period,
                formula=(
                    BillingFormula.MANAGEMENT_FEE_AUM
                    if rule.formula == BillingFormula.MANAGEMENT_FEE_AUM
                    else None
                ),
                rule_id=(
                    None
                    if rule.formula == BillingFormula.MANAGEMENT_FEE_AUM
                    else rule.pk
                ),
            )
        meta = {
            "rule_id": rule.pk,
            "rule_label": rule.label,
            "period_label": period,
        }
        if exists:
            skipped.append({**meta, "reason": "already_exists"})
            continue
        try:
            charge = create_case_billing_charge(
                case=case,
                rule=rule,
                actor=actor,
                period_label=period,
            )
            if post:
                charge = post_case_billing_charge(charge=charge, actor=actor)
            created.append(serialize_billing_invoice(charge))
        except Exception as exc:  # noqa: BLE001
            detail = getattr(exc, "detail", None)
            if isinstance(detail, dict):
                message = "; ".join(f"{k}: {v}" for k, v in detail.items())
            else:
                message = str(detail or exc)
            errors.append({**meta, "error": message})

    return {
        "case_id": case.pk,
        "case_reference": case.reference,
        "created": created,
        "skipped": skipped,
        "errors": errors,
        "summary": {
            "created": len(created),
            "skipped": len(skipped),
            "errors": len(errors),
        },
    }


@transaction.atomic
def post_case_billing_charge(*, charge: CaseBillingCharge, actor) -> CaseBillingCharge:
    if charge.status == CaseBillingChargeStatus.CANCELLED:
        raise ValidationError({"detail": "Cette charge est annulée."})
    if charge.status == CaseBillingChargeStatus.POSTED and charge.enterprise_movement_id:
        return charge

    category = get_revenue_category_for_case_type(charge.case.case_type)
    if category is None:
        raise ValidationError(
            {
                "detail": (
                    "Aucune catégorie de recette entreprise pour ce type de service. "
                    "Vérifiez le catalogue comptable."
                )
            }
        )

    account = get_default_enterprise_account(created_by=actor)
    reference = f"{charge.case.reference}-{charge.pk}"
    description = (
        f"{charge.label} — {charge.case.reference}"
        + (f" ({charge.period_label})" if charge.period_label else "")
    )
    movement = EnterpriseMovement.objects.create(
        account=account,
        movement_type=MovementType.INCOME,
        category=category,
        amount=charge.amount,
        currency=charge.currency or account.currency,
        description=description[:512],
        reference=reference[:128],
        movement_date=charge.movement_date,
        status=MovementStatus.APPROVED,
        created_by=actor,
    )
    charge.enterprise_movement = movement
    charge.status = CaseBillingChargeStatus.POSTED
    charge.save(
        update_fields=["enterprise_movement", "status", "updated_at"],
    )
    return charge


@transaction.atomic
def cancel_case_billing_charge(*, charge: CaseBillingCharge) -> CaseBillingCharge:
    if charge.status == CaseBillingChargeStatus.POSTED:
        raise ValidationError(
            {
                "detail": (
                    "Charge déjà comptabilisée : annulez ou refusez le mouvement "
                    "entreprise associé si nécessaire."
                )
            }
        )
    charge.status = CaseBillingChargeStatus.CANCELLED
    charge.save(update_fields=["status", "updated_at"])
    return charge
