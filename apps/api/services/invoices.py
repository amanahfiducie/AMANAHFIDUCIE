"""Facture unique par dossier / période — preview, composition, validation."""

from __future__ import annotations

from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from assets.services import get_case_patrimony_summary
from finance.enterprise_services import get_default_enterprise_account
from finance.models import (
    EnterpriseMovement,
    MovementStatus,
    MovementType,
)
from services.billing import (
    _quantize,
    compute_charge_from_rule,
    get_revenue_category_for_case_type,
    resolve_tiered_rule,
    rule_matches_base,
)
from services.models import (
    BillingFormula,
    BillingInvoice,
    BillingInvoiceLine,
    CaseBillingChargeStatus,
    ServiceBillingRule,
    ServiceOffer,
)

ZERO = Decimal("0")


def _default_period() -> str:
    return str(timezone.localdate().year)


def preview_case_invoice(*, case, period_label: str = "") -> dict:
    """Service + règles applicables avec montants calculés (avant validation).

    Sans offre catalogue : lignes auto vides (facturation manuelle toujours possible).
    """
    offer = ServiceOffer.objects.filter(case_type=case.case_type).first()
    period = (period_label or "").strip() or _default_period()
    summary = get_case_patrimony_summary(case)
    aum = Decimal(str(summary.get("total_estimated_value") or "0"))
    net = Decimal(str(summary.get("net_benefit") or "0"))
    currency = summary.get("currency") or "XOF"

    lines = []
    if offer is not None:
        rules = list(
            offer.billing_rules.filter(is_active=True).order_by("sort_order", "id")
        )
        seen_aum = False

        for rule in rules:
            # Une seule ligne AUM : la tranche applicable
            if rule.formula == BillingFormula.MANAGEMENT_FEE_AUM:
                if seen_aum:
                    continue
                matched = resolve_tiered_rule(
                    rules=rules,
                    formula=BillingFormula.MANAGEMENT_FEE_AUM,
                    base=aum,
                )
                if matched is None:
                    continue
                rule = matched
                seen_aum = True
            elif rule.base_min is not None or rule.base_max is not None:
                if not rule_matches_base(rule, aum):
                    continue

            applicable = True
            error = None
            computed = None
            try:
                if rule.formula == BillingFormula.PERFORMANCE_FEE and net <= 0:
                    applicable = False
                    error = "Aucun profit net positif — commission non due."
                else:
                    computed = compute_charge_from_rule(
                        case=case,
                        rule=rule,
                        period_label=period,
                    )
            except ValidationError as exc:
                applicable = False
                detail = getattr(exc, "detail", None)
                if isinstance(detail, dict):
                    error = "; ".join(f"{k}: {v}" for k, v in detail.items())
                else:
                    error = str(detail or exc)

            selected_by_default = applicable and error is None
            if rule.formula == BillingFormula.PERFORMANCE_FEE and not applicable:
                selected_by_default = False

            lines.append(
                {
                    "billing_rule_id": rule.pk,
                    "formula": rule.formula,
                    "formula_label": rule.get_formula_display(),
                    "label": rule.label,
                    "description": rule.description,
                    "periodicity": rule.periodicity,
                    "periodicity_label": rule.get_periodicity_display(),
                    "rate_percent": (
                        str(computed.rate_percent)
                        if computed and computed.rate_percent is not None
                        else (
                            str(rule.rate_percent)
                            if rule.rate_percent is not None
                            else None
                        )
                    ),
                    "base_amount": (
                        str(computed.base_amount)
                        if computed and computed.base_amount is not None
                        else None
                    ),
                    "amount": str(computed.amount) if computed else "0.00",
                    "currency": computed.currency if computed else currency,
                    "applicable": applicable,
                    "selected": selected_by_default,
                    "error": error,
                    "notes": computed.notes if computed else (error or ""),
                }
            )

    existing = (
        BillingInvoice.objects.filter(case=case, period_label=period)
        .exclude(status=CaseBillingChargeStatus.CANCELLED)
        .first()
    )

    return {
        "case_id": case.pk,
        "case_reference": case.reference,
        "case_title": case.title,
        "case_type": case.case_type,
        "case_type_label": case.get_case_type_display(),
        "period_label": period,
        "aum": {
            "total_estimated_value": str(aum),
            "net_benefit": str(net),
            "currency": currency,
            "asset_count": summary.get("asset_count", 0),
        },
        "service": (
            {
                "id": offer.pk,
                "name": offer.name,
                "case_type": offer.case_type,
                "description": offer.description,
                "is_active": offer.is_active,
            }
            if offer is not None
            else None
        ),
        "lines": lines,
        "existing_invoice_id": existing.pk if existing else None,
        "existing_invoice_status": existing.status if existing else None,
    }


def serialize_invoice(invoice: BillingInvoice) -> dict:
    lines = []
    for line in invoice.lines.all():
        lines.append(
            {
                "id": line.pk,
                "billing_rule_id": line.billing_rule_id,
                "formula": line.formula,
                "formula_label": line.get_formula_display(),
                "label": line.label,
                "base_amount": (
                    str(line.base_amount) if line.base_amount is not None else None
                ),
                "rate_percent": (
                    str(line.rate_percent) if line.rate_percent is not None else None
                ),
                "amount": str(line.amount),
                "is_selected": line.is_selected,
                "sort_order": line.sort_order,
                "notes": line.notes,
            }
        )
    return {
        "id": invoice.pk,
        "case_id": invoice.case_id,
        "case_reference": invoice.case.reference,
        "case_title": invoice.case.title,
        "case_type": invoice.case.case_type,
        "case_type_label": invoice.case.get_case_type_display(),
        "period_label": invoice.period_label,
        "label": invoice.label
        or f"Facture honoraires {invoice.period_label} — {invoice.case.reference}",
        "amount": str(invoice.amount),
        "currency": invoice.currency,
        "movement_date": invoice.movement_date.isoformat(),
        "status": invoice.status,
        "status_label": invoice.get_status_display(),
        "enterprise_movement_id": invoice.enterprise_movement_id,
        "notes": invoice.notes,
        "lines": lines,
        "created_by_username": (
            invoice.created_by.username if invoice.created_by_id else None
        ),
        "created_at": invoice.created_at.isoformat(),
        "updated_at": invoice.updated_at.isoformat(),
    }


def list_period_invoices(
    *, status: str | None = None, case_type: str | None = None
) -> list[dict]:
    qs = BillingInvoice.objects.select_related("case", "created_by").prefetch_related(
        "lines"
    ).exclude(status=CaseBillingChargeStatus.CANCELLED)
    if status:
        qs = qs.filter(status=status)
    if case_type:
        qs = qs.filter(case__case_type=case_type)
    return [serialize_invoice(inv) for inv in qs.order_by("-movement_date", "-pk")[:500]]


def _parse_line_amount(value) -> Decimal:
    try:
        amount = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError) as exc:
        raise ValidationError({"amount": "Montant invalide."}) from exc
    if amount < 0:
        raise ValidationError({"amount": "Le montant ne peut pas être négatif."})
    return _quantize(amount)


@transaction.atomic
def create_or_replace_invoice(
    *,
    case,
    actor,
    period_label: str,
    lines: list[dict],
    notes: str = "",
    label: str = "",
) -> BillingInvoice:
    period = (period_label or "").strip() or _default_period()
    if not lines:
        raise ValidationError({"lines": "Au moins une ligne est requise."})

    existing = (
        BillingInvoice.objects.filter(case=case, period_label=period)
        .exclude(status=CaseBillingChargeStatus.CANCELLED)
        .select_for_update()
        .first()
    )
    if existing and existing.status == CaseBillingChargeStatus.POSTED:
        raise ValidationError(
            {
                "detail": (
                    f"Une facture comptabilisée existe déjà pour la période "
                    f"« {period} ». Annulez-la côté compta si besoin."
                )
            }
        )
    if existing:
        existing.lines.all().delete()
        invoice = existing
        invoice.notes = (notes or "").strip()
        invoice.label = (label or "").strip()
        invoice.movement_date = timezone.localdate()
        invoice.status = CaseBillingChargeStatus.DRAFT
    else:
        invoice = BillingInvoice(
            case=case,
            period_label=period,
            label=(label or "").strip(),
            movement_date=timezone.localdate(),
            status=CaseBillingChargeStatus.DRAFT,
            notes=(notes or "").strip(),
            created_by=actor,
            currency="XOF",
        )
        invoice.save()

    total = ZERO
    currency = "XOF"
    sort = 0
    any_selected = False
    for raw in lines:
        selected = bool(raw.get("selected", raw.get("is_selected", True)))
        rule_id = raw.get("billing_rule_id")
        rule = None
        if rule_id:
            rule = ServiceBillingRule.objects.filter(pk=rule_id).first()
        amount = _parse_line_amount(raw.get("amount", "0"))
        line_label = (raw.get("label") or (rule.label if rule else "")).strip()
        if selected and not line_label:
            raise ValidationError(
                {"label": "Chaque ligne facturée doit avoir une désignation."}
            )
        if selected:
            any_selected = True
            total += amount
        formula = raw.get("formula") or (rule.formula if rule else BillingFormula.OTHER)
        if formula not in BillingFormula.values:
            formula = BillingFormula.OTHER
        rate = raw.get("rate_percent")
        base = raw.get("base_amount")
        BillingInvoiceLine.objects.create(
            invoice=invoice,
            billing_rule=rule,
            formula=formula,
            label=line_label or "Ligne",
            base_amount=(
                Decimal(str(base)) if base not in (None, "") else None
            ),
            rate_percent=(
                Decimal(str(rate)) if rate not in (None, "") else None
            ),
            amount=amount,
            is_selected=selected,
            sort_order=sort,
            notes=(raw.get("notes") or "").strip(),
        )
        sort += 1
        if rule and rule.currency:
            currency = rule.currency

    if not any_selected:
        raise ValidationError(
            {"lines": "Ajoutez ou sélectionnez au moins une ligne à facturer."}
        )

    invoice.amount = _quantize(total)
    invoice.currency = currency
    if not invoice.label:
        invoice.label = f"Facture honoraires {period} — {case.reference}"
    invoice.save()
    return invoice


@transaction.atomic
def update_invoice_draft(
    *,
    invoice: BillingInvoice,
    lines: list[dict] | None = None,
    notes: str | None = None,
    label: str | None = None,
    period_label: str | None = None,
) -> BillingInvoice:
    if invoice.status != CaseBillingChargeStatus.DRAFT:
        raise ValidationError(
            {"detail": "Seuls les brouillons de facture peuvent être modifiés."}
        )
    if period_label is not None:
        new_period = period_label.strip() or invoice.period_label
        conflict = (
            BillingInvoice.objects.filter(case=invoice.case, period_label=new_period)
            .exclude(pk=invoice.pk)
            .exclude(status=CaseBillingChargeStatus.CANCELLED)
            .exists()
        )
        if conflict:
            raise ValidationError(
                {"period_label": "Une facture existe déjà pour cette période."}
            )
        invoice.period_label = new_period
    if notes is not None:
        invoice.notes = notes.strip()
    if label is not None:
        invoice.label = label.strip()

    if lines is not None:
        invoice.lines.all().delete()
        total = ZERO
        any_selected = False
        for i, raw in enumerate(lines):
            selected = bool(raw.get("selected", raw.get("is_selected", True)))
            amount = _parse_line_amount(raw.get("amount", "0"))
            rule_id = raw.get("billing_rule_id")
            rule = (
                ServiceBillingRule.objects.filter(pk=rule_id).first()
                if rule_id
                else None
            )
            line_label = (
                raw.get("label") or (rule.label if rule else "")
            ).strip()
            if selected and not line_label:
                raise ValidationError(
                    {"label": "Chaque ligne facturée doit avoir une désignation."}
                )
            if selected:
                any_selected = True
                total += amount
            formula = raw.get("formula") or (
                rule.formula if rule else BillingFormula.OTHER
            )
            if formula not in BillingFormula.values:
                formula = BillingFormula.OTHER
            BillingInvoiceLine.objects.create(
                invoice=invoice,
                billing_rule=rule,
                formula=formula,
                label=line_label or "Ligne",
                base_amount=(
                    Decimal(str(raw["base_amount"]))
                    if raw.get("base_amount") not in (None, "")
                    else None
                ),
                rate_percent=(
                    Decimal(str(raw["rate_percent"]))
                    if raw.get("rate_percent") not in (None, "")
                    else None
                ),
                amount=amount,
                is_selected=selected,
                sort_order=i,
                notes=(raw.get("notes") or "").strip(),
            )
        if not any_selected:
            raise ValidationError(
                {"lines": "Ajoutez ou sélectionnez au moins une ligne à facturer."}
            )
        invoice.amount = _quantize(total)

    invoice.save()
    return invoice


@transaction.atomic
def post_invoice(*, invoice: BillingInvoice, actor) -> BillingInvoice:
    if invoice.status == CaseBillingChargeStatus.CANCELLED:
        raise ValidationError({"detail": "Cette facture est annulée."})
    if invoice.status == CaseBillingChargeStatus.POSTED and invoice.enterprise_movement_id:
        return invoice

    selected_total = sum(
        (line.amount for line in invoice.lines.filter(is_selected=True)),
        ZERO,
    )
    invoice.amount = _quantize(selected_total)
    if invoice.amount <= 0:
        raise ValidationError({"amount": "Le total facturé doit être positif."})

    category = get_revenue_category_for_case_type(invoice.case.case_type)
    if category is None:
        raise ValidationError(
            {
                "detail": (
                    "Aucune catégorie de recette entreprise pour ce type de service."
                )
            }
        )
    account = get_default_enterprise_account(created_by=actor)
    description = (
        f"{invoice.label or 'Honoraires'} — {invoice.case.reference}"
        f" ({invoice.period_label})"
    )
    movement = EnterpriseMovement.objects.create(
        account=account,
        movement_type=MovementType.INCOME,
        category=category,
        amount=invoice.amount,
        currency=invoice.currency or account.currency,
        description=description[:512],
        reference=f"INV-{invoice.case.reference}-{invoice.pk}"[:128],
        movement_date=invoice.movement_date,
        # Facture validée = recette reconnue (alimente le chiffre d'affaires).
        status=MovementStatus.APPROVED,
        created_by=actor,
    )
    invoice.enterprise_movement = movement
    invoice.status = CaseBillingChargeStatus.POSTED
    invoice.save(
        update_fields=["amount", "enterprise_movement", "status", "updated_at"]
    )
    return invoice


@transaction.atomic
def cancel_invoice(*, invoice: BillingInvoice) -> BillingInvoice:
    if invoice.status == CaseBillingChargeStatus.POSTED:
        raise ValidationError(
            {
                "detail": (
                    "Facture déjà comptabilisée : traitez le mouvement entreprise "
                    "associé si nécessaire."
                )
            }
        )
    invoice.status = CaseBillingChargeStatus.CANCELLED
    invoice.save(update_fields=["status", "updated_at"])
    return invoice
