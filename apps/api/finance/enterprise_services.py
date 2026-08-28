from __future__ import annotations

from datetime import date
from decimal import Decimal

from django.db.models import Q, Sum
from django.db.models.functions import Coalesce

from finance.models import (
    DEBIT_TYPES,
    CategoryScope,
    EnterpriseAccount,
    EnterpriseMovement,
    MovementCategory,
    MovementStatus,
    MovementType,
)

MONTH_LABELS_FR = (
    "Jan",
    "Fév",
    "Mar",
    "Avr",
    "Mai",
    "Juin",
    "Juil",
    "Aoû",
    "Sep",
    "Oct",
    "Nov",
    "Déc",
)


def _movement_period_filter(qs, year: int | None = None, month: int | None = None):
    if year:
        qs = qs.filter(movement_date__year=year)
    if month:
        qs = qs.filter(movement_date__month=month)
    return qs


def _invoice_period_filter(qs, year: int | None = None, month: int | None = None):
    """Filtre factures : date de mouvement, avec filet period_label pour le CA annuel."""
    if year and month:
        return qs.filter(movement_date__year=year, movement_date__month=month)
    if year:
        return qs.filter(
            Q(movement_date__year=year)
            | Q(period_label=str(year))
            | Q(period_label__startswith=f"{year}-")
            | Q(period_label__startswith=f"{year}/")
        )
    return qs


def _sync_posted_invoice_movements() -> int:
    """Aligne les mouvements liés aux factures / charges validées (brouillon → approuvé).

    Les factures validées avant le correctif CA laissaient un mouvement DRAFT :
    le CA restait à 0. On répare à la lecture de la synthèse.
    """
    from services.models import BillingInvoice, CaseBillingCharge, CaseBillingChargeStatus

    updated = 0
    invoice_ids = list(
        BillingInvoice.objects.filter(
            status=CaseBillingChargeStatus.POSTED,
            enterprise_movement_id__isnull=False,
        ).values_list("enterprise_movement_id", flat=True)
    )
    charge_ids = list(
        CaseBillingCharge.objects.filter(
            status=CaseBillingChargeStatus.POSTED,
            enterprise_movement_id__isnull=False,
        ).values_list("enterprise_movement_id", flat=True)
    )
    movement_ids = {mid for mid in (*invoice_ids, *charge_ids) if mid}
    if not movement_ids:
        return 0

    # Sync status APPROVED
    updated += (
        EnterpriseMovement.objects.filter(pk__in=movement_ids)
        .exclude(status=MovementStatus.APPROVED)
        .update(status=MovementStatus.APPROVED)
    )

    # Align amounts from invoice (source of truth)
    for inv in BillingInvoice.objects.filter(
        status=CaseBillingChargeStatus.POSTED,
        enterprise_movement_id__isnull=False,
    ).only("amount", "currency", "movement_date", "enterprise_movement_id"):
        EnterpriseMovement.objects.filter(pk=inv.enterprise_movement_id).exclude(
            amount=inv.amount, movement_date=inv.movement_date
        ).update(
            amount=inv.amount,
            currency=inv.currency or "XOF",
            movement_date=inv.movement_date,
            status=MovementStatus.APPROVED,
        )

    return updated


def _posted_invoices_qs(year: int | None = None, month: int | None = None):
    """Factures d'honoraires validées (source de vérité du CA)."""
    from services.models import BillingInvoice, CaseBillingChargeStatus

    qs = BillingInvoice.objects.filter(status=CaseBillingChargeStatus.POSTED)
    return _invoice_period_filter(qs, year=year, month=month)


def _posted_legacy_charges_qs(year: int | None = None, month: int | None = None):
    from services.models import CaseBillingCharge, CaseBillingChargeStatus

    qs = CaseBillingCharge.objects.filter(status=CaseBillingChargeStatus.POSTED)
    return _invoice_period_filter(qs, year=year, month=month)


def _sum_invoice_revenue(year: int | None = None, month: int | None = None) -> Decimal:
    inv_total = _posted_invoices_qs(year=year, month=month).aggregate(
        total=Coalesce(Sum("amount"), Decimal("0"))
    )["total"]
    legacy_total = _posted_legacy_charges_qs(year=year, month=month).aggregate(
        total=Coalesce(Sum("amount"), Decimal("0"))
    )["total"]
    return abs(inv_total) + abs(legacy_total)


def _expense_qs(year: int | None = None, month: int | None = None):
    return _movement_period_filter(
        EnterpriseMovement.objects.filter(
            status=MovementStatus.APPROVED,
            movement_type=MovementType.EXPENSE,
        ),
        year=year,
        month=month,
    )


def _sum_amounts(movements, types: set[str] | None = None) -> Decimal:
    qs = movements
    if types is not None:
        qs = qs.filter(movement_type__in=types)
    total = Decimal("0")
    for m in qs:
        total += abs(m.amount)
    return total


def _revenue_categories_by_case_type() -> dict[str, MovementCategory]:
    cats = MovementCategory.objects.filter(
        scope=CategoryScope.REVENUE,
        is_active=True,
        service_type__isnull=False,
    ).exclude(service_type="")
    return {c.service_type: c for c in cats}


def _revenue_by_service_from_invoices(year: int | None, month: int | None) -> list[dict]:
    """CA par service (type de dossier / catégorie catalogue)."""
    from collections import defaultdict

    by_type: dict[str, Decimal] = defaultdict(lambda: Decimal("0"))
    for row in (
        _posted_invoices_qs(year=year, month=month)
        .values("case__case_type")
        .annotate(total=Coalesce(Sum("amount"), Decimal("0")))
    ):
        by_type[row["case__case_type"] or ""] += abs(row["total"])

    for row in (
        _posted_legacy_charges_qs(year=year, month=month)
        .values("case__case_type")
        .annotate(total=Coalesce(Sum("amount"), Decimal("0")))
    ):
        by_type[row["case__case_type"] or ""] += abs(row["total"])

    cats = _revenue_categories_by_case_type()
    out: list[dict] = []
    for case_type, total in by_type.items():
        if total <= 0:
            continue
        cat = cats.get(case_type)
        out.append(
            {
                "slug": cat.slug if cat else (case_type or "autre").lower(),
                "service_type": case_type,
                "label": cat.label if cat else (case_type or "Autres recettes"),
                "total": str(total),
                "_sort": cat.sort_order if cat else 999,
            }
        )
    out.sort(key=lambda r: (r["_sort"], r["label"]))
    for row in out:
        row.pop("_sort", None)
    return out


def _expense_by_category(qs) -> list[dict]:
    rows = (
        qs.filter(category__scope=CategoryScope.EXPENSE)
        .values("category__slug", "category__label", "category__sort_order")
        .annotate(total=Coalesce(Sum("amount"), Decimal("0")))
        .order_by("category__sort_order", "category__label")
    )
    return [
        {
            "slug": row["category__slug"],
            "label": row["category__label"],
            "total": str(abs(row["total"])),
        }
        for row in rows
        if row["category__slug"]
    ]


def _monthly_revenue_by_category(year: int) -> list[dict]:
    """Séries mensuelles CA par service (12 valeurs)."""
    from collections import defaultdict

    cats = _revenue_categories_by_case_type()
    series: dict[str, dict] = {}

    def _add(case_type: str, month: int, amount: Decimal) -> None:
        cat = cats.get(case_type)
        slug = cat.slug if cat else (case_type or "autre").lower()
        entry = series.setdefault(
            slug,
            {
                "slug": slug,
                "label": cat.label if cat else (case_type or "Autres"),
                "_sort": cat.sort_order if cat else 999,
                "_values": [Decimal("0")] * 12,
            },
        )
        if 1 <= month <= 12:
            entry["_values"][month - 1] += abs(amount)

    inv_rows = (
        _posted_invoices_qs(year=year)
        .values("case__case_type", "movement_date__month")
        .annotate(total=Coalesce(Sum("amount"), Decimal("0")))
    )
    for row in inv_rows:
        _add(row["case__case_type"] or "", row["movement_date__month"], row["total"])

    charge_rows = (
        _posted_legacy_charges_qs(year=year)
        .values("case__case_type", "movement_date__month")
        .annotate(total=Coalesce(Sum("amount"), Decimal("0")))
    )
    for row in charge_rows:
        _add(row["case__case_type"] or "", row["movement_date__month"], row["total"])

    out = sorted(series.values(), key=lambda s: (s["_sort"], s["label"]))
    return [
        {
            "slug": s["slug"],
            "label": s["label"],
            "values": [str(v) for v in s["_values"]],
        }
        for s in out
    ]


def _monthly_by_category_expense(year: int) -> list[dict]:
    rows = (
        EnterpriseMovement.objects.filter(
            status=MovementStatus.APPROVED,
            movement_date__year=year,
            movement_type=MovementType.EXPENSE,
            category__scope=CategoryScope.EXPENSE,
        )
        .values(
            "category__slug",
            "category__label",
            "category__sort_order",
            "movement_date__month",
        )
        .annotate(total=Coalesce(Sum("amount"), Decimal("0")))
    )
    series: dict[str, dict] = {}
    for row in rows:
        slug = row["category__slug"]
        if not slug:
            continue
        entry = series.setdefault(
            slug,
            {
                "slug": slug,
                "label": row["category__label"],
                "_sort": row["category__sort_order"],
                "_values": [Decimal("0")] * 12,
            },
        )
        entry["_values"][row["movement_date__month"] - 1] += abs(row["total"])
    out = sorted(series.values(), key=lambda s: (s["_sort"], s["label"]))
    return [
        {
            "slug": s["slug"],
            "label": s["label"],
            "values": [str(v) for v in s["_values"]],
        }
        for s in out
    ]


def _monthly_trends(year: int) -> list[dict]:
    trends: list[dict] = []
    for month in range(1, 13):
        revenue = _sum_invoice_revenue(year=year, month=month)
        expense = _sum_amounts(_expense_qs(year=year, month=month))
        trends.append(
            {
                "month": month,
                "label": MONTH_LABELS_FR[month - 1],
                "revenue": str(revenue),
                "expense": str(expense),
                "net": str(revenue - expense),
            }
        )
    return trends


def get_default_enterprise_account(*, created_by) -> EnterpriseAccount:
    """Compte unique implicite — pas de gestion multi-comptes côté comptable."""
    account = EnterpriseAccount.objects.filter(is_active=True).order_by("pk").first()
    if account:
        return account
    return EnterpriseAccount.objects.create(
        name="Trésorerie SOFIGEPAM",
        account_type="BANK",
        currency="XOF",
        opening_balance=Decimal("0"),
        created_by=created_by,
    )


def compute_enterprise_account_balance(account: EnterpriseAccount) -> Decimal:
    _sync_posted_invoice_movements()
    balance = account.opening_balance
    for movement in EnterpriseMovement.objects.filter(
        account=account,
        status=MovementStatus.APPROVED,
    ):
        balance += movement.signed_amount
    return balance


def get_enterprise_account_summary(account: EnterpriseAccount) -> dict:
    balance = compute_enterprise_account_balance(account)
    approved = EnterpriseMovement.objects.filter(
        account=account,
        status=MovementStatus.APPROVED,
    )
    expense_total = _sum_amounts(approved.filter(movement_type__in=DEBIT_TYPES))
    # Revenus compta / CA : factures validées (toutes périodes pour le compte)
    income_total = _sum_invoice_revenue()

    return {
        "account_id": account.pk,
        "account_name": account.name,
        "account_type": account.account_type,
        "currency": account.currency,
        "opening_balance": str(account.opening_balance),
        "current_balance": str(balance),
        "approved_income_total": str(income_total),
        "approved_expense_total": str(expense_total),
        "movement_count": account.movements.count(),
        "draft_count": account.movements.filter(status=MovementStatus.DRAFT).count(),
    }


def get_enterprise_performance(
    *,
    year: int | None = None,
    month: int | None = None,
) -> dict:
    """Chiffre d'affaires = somme des factures validées (POSTED) sur la période."""
    if year is None:
        year = date.today().year

    _sync_posted_invoice_movements()

    chiffre_affaires = _sum_invoice_revenue(year=year, month=month)
    expense_qs = _expense_qs(year=year, month=month)
    total_depenses = _sum_amounts(expense_qs)
    recettes_honoraires = chiffre_affaires
    recettes_autres = Decimal("0")
    resultat_net = chiffre_affaires - total_depenses

    revenue_by_service = _revenue_by_service_from_invoices(year=year, month=month)
    expense_by_category = _expense_by_category(expense_qs)
    monthly_trends = _monthly_trends(year) if month is None else []
    revenue_monthly_by_category = (
        _monthly_revenue_by_category(year) if month is None else []
    )
    expense_monthly_by_category = (
        _monthly_by_category_expense(year) if month is None else []
    )

    category_breakdown = [
        *[
            {
                "slug": row["slug"],
                "label": row["label"],
                "movement_type": MovementType.INCOME,
                "total": row["total"],
            }
            for row in revenue_by_service
            if Decimal(row["total"]) > 0
        ],
        *[
            {
                "slug": row["slug"],
                "label": row["label"],
                "movement_type": MovementType.EXPENSE,
                "total": row["total"],
            }
            for row in expense_by_category
            if Decimal(row["total"]) > 0
        ],
    ]

    invoice_count = _posted_invoices_qs(year=year, month=month).count()
    legacy_count = _posted_legacy_charges_qs(year=year, month=month).count()
    movement_count = invoice_count + legacy_count + expense_qs.count()

    return {
        "year": year,
        "month": month,
        "period_label": f"{month:02d}/{year}" if month else str(year),
        "chiffre_affaires": str(chiffre_affaires),
        "recettes": str(chiffre_affaires),
        "recettes_honoraires": str(recettes_honoraires),
        "recettes_autres": str(recettes_autres),
        "total_depenses": str(total_depenses),
        "resultat_net": str(resultat_net),
        "movement_count": movement_count,
        "invoice_count": invoice_count + legacy_count,
        "revenue_source": "invoices",
        "revenue_by_service": revenue_by_service,
        "expense_by_category": expense_by_category,
        "monthly_trends": monthly_trends,
        "revenue_monthly_by_category": revenue_monthly_by_category,
        "expense_monthly_by_category": expense_monthly_by_category,
        "category_breakdown": category_breakdown,
    }


def get_enterprise_financial_summary(
    *,
    year: int | None = None,
    month: int | None = None,
) -> dict:
    accounts = EnterpriseAccount.objects.filter(is_active=True)
    summaries = [get_enterprise_account_summary(a) for a in accounts]
    total_balance = sum(Decimal(s["current_balance"]) for s in summaries)
    currency = summaries[0]["currency"] if summaries else "XOF"
    performance = get_enterprise_performance(year=year, month=month)

    return {
        "entity_name": "SOFIGEPAM",
        "currency": currency,
        "account_count": len(summaries),
        "total_balance": str(total_balance),
        "accounts": summaries,
        "performance": performance,
    }
