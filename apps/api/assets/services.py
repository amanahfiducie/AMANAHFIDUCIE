from __future__ import annotations

import calendar
from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal

from django.db.models import Sum

from assets.models import (
    Asset,
    AssetEvent,
    AssetEventStatus,
    AssetEventType,
    ValuationFrequency,
)
from cases.models import CaseStakeholder
from notifications.models import Notification, NotificationType
from notifications.services import notify_user

FREQUENCY_MONTHS: dict[str, int] = {
    ValuationFrequency.MONTHLY: 1,
    ValuationFrequency.QUARTERLY: 3,
    ValuationFrequency.SEMIANNUAL: 6,
    ValuationFrequency.ANNUAL: 12,
    ValuationFrequency.BIENNIAL: 24,
}


def _add_months(start: date, months: int) -> date:
    month_index = start.month - 1 + months
    year = start.year + month_index // 12
    month = month_index % 12 + 1
    last_day = calendar.monthrange(year, month)[1]
    day = min(start.day, last_day)
    return date(year, month, day)


def compute_next_valuation_due(frequency: str, from_date: date) -> date | None:
    months = FREQUENCY_MONTHS.get(frequency)
    if not months:
        return None
    return _add_months(from_date, months)


def refresh_asset_valuation_schedule(asset: Asset, *, anchor: date | None = None) -> None:
    """Recalcule la prochaine échéance à partir de la dernière valorisation (ou aujourd'hui)."""
    latest = asset.latest_valuation
    base = anchor or (latest.valued_at if latest else date.today())
    asset.valuation_next_due = compute_next_valuation_due(
        asset.valuation_frequency,
        base,
    )
    asset.save(update_fields=["valuation_next_due", "updated_at"])


def _valuation_reminder_recipients(case):
    from django.contrib.auth import get_user_model

    User = get_user_model()
    user_ids: set[int] = set()
    if case.created_by_id:
        user_ids.add(case.created_by_id)
    if case.assigned_to_id:
        user_ids.add(case.assigned_to_id)
    for sh in CaseStakeholder.objects.filter(case=case).select_related("user"):
        if sh.user_id:
            user_ids.add(sh.user_id)
    if not user_ids:
        return []
    return list(User.objects.filter(pk__in=user_ids))


def _recent_valuation_reminder_exists(*, user_id: int, case_id: int, asset_id: int) -> bool:
    week_ago = date.today() - timedelta(days=7)
    return Notification.objects.filter(
        user_id=user_id,
        case_id=case_id,
        notification_type=NotificationType.ASSET_VALUATION_DUE,
        metadata_json__asset_id=asset_id,
        created_at__date__gte=week_ago,
    ).exists()


def notify_asset_valuation_reminder(asset: Asset, *, overdue: bool = False) -> int:
    """Notifie les parties prenantes qu'une réévaluation est due ou proche."""
    if not asset.valuation_next_due:
        return 0
    case = asset.case
    due_str = asset.valuation_next_due.isoformat()
    if overdue:
        title = f"Réévaluation en retard : {asset.label}"
        body = (
            f"L'échéance du {due_str} est dépassée. "
            "Merci d'enregistrer une nouvelle valorisation."
        )
    else:
        title = f"Rappel réévaluation : {asset.label}"
        body = f"Réévaluation prévue le {due_str}."
    action_path = f"/dossiers/{case.pk}/patrimoine/actifs/{asset.pk}"
    sent = 0
    for user in _valuation_reminder_recipients(case):
        if _recent_valuation_reminder_exists(
            user_id=user.pk,
            case_id=case.pk,
            asset_id=asset.pk,
        ):
            continue
        note = notify_user(
            user,
            title=title,
            body=body,
            case=case,
            notification_type=NotificationType.ASSET_VALUATION_DUE,
            action_path=action_path,
            metadata={"asset_id": asset.pk, "due_date": due_str},
        )
        if note:
            sent += 1
    return sent


def process_due_valuation_reminders(case) -> int:
    """Crée des rappels pour les actifs dont l'échéance est atteinte ou dépassée."""
    today = date.today()
    total = 0
    assets = case.assets.filter(
        is_active=True,
        valuation_next_due__isnull=False,
        valuation_next_due__lte=today,
    )
    for asset in assets:
        if asset.valuation_frequency not in FREQUENCY_MONTHS:
            continue
        total += notify_asset_valuation_reminder(
            asset,
            overdue=asset.valuation_next_due < today,
        )
    return total


def _money_str(value: Decimal) -> str:
    return str(value.quantize(Decimal("0.01")))


def _sum_active_asset_events(case, event_type: str) -> Decimal:
    total = AssetEvent.objects.filter(
        asset__case=case,
        asset__is_active=True,
        event_type=event_type,
        status=AssetEventStatus.ACTIVE,
        amount__isnull=False,
    ).aggregate(s=Sum("amount"))["s"]
    return total if total is not None else Decimal("0")


def get_case_patrimony_summary(case) -> dict:
    """Résumé patrimonial d’un dossier (valeurs = dernière valorisation par actif)."""
    assets = (
        Asset.objects.filter(case=case, is_active=True)
        .prefetch_related("valuations", "risks")
        .order_by("asset_type", "label")
    )

    by_type: dict[str, dict] = defaultdict(
        lambda: {"count": 0, "total_value": Decimal("0"), "currency": "XOF"}
    )
    total_value = Decimal("0")
    primary_currency = "XOF"
    asset_rows = []

    for asset in assets:
        latest = asset.latest_valuation
        value = latest.value if latest else Decimal("0")
        currency = latest.currency if latest else asset.currency
        if latest:
            primary_currency = currency

        total_value += value
        bucket = by_type[asset.asset_type]
        bucket["count"] += 1
        bucket["total_value"] += value
        bucket["currency"] = currency

        asset_rows.append(
            {
                "id": asset.pk,
                "label": asset.label,
                "asset_type": asset.asset_type,
                "latest_value": str(value),
                "currency": currency,
                "risk_count": asset.risks.count(),
            }
        )

    total_gains = _sum_active_asset_events(case, AssetEventType.GAIN)
    total_expenses = _sum_active_asset_events(case, AssetEventType.EXPENSE)
    net_benefit = total_gains - total_expenses

    onboarding = case.onboarding_data if isinstance(case.onboarding_data, dict) else {}

    def _text(key: str) -> str:
        raw = onboarding.get(key)
        return raw.strip() if isinstance(raw, str) else ""

    return {
        "case_id": case.pk,
        "case_reference": case.reference,
        "asset_count": len(asset_rows),
        "total_estimated_value": str(total_value),
        "currency": primary_currency,
        "total_gains": _money_str(total_gains),
        "total_expenses": _money_str(total_expenses),
        "net_benefit": _money_str(net_benefit),
        "objectives": _text("patrimony_objectives"),
        "remarks": _text("patrimony_remarks"),
        "observations": _text("patrimony_observations"),
        "by_type": {
            asset_type: {
                "count": data["count"],
                "total_value": str(data["total_value"]),
                "currency": data["currency"],
            }
            for asset_type, data in sorted(by_type.items())
        },
        "assets": asset_rows,
    }


def build_case_patrimony_evolution(case) -> list[dict]:
    """
    Courbe d'évolution du patrimoine (somme des dernières valorisations
    connues par actif à chaque date de valorisation).
    """
    assets = list(
        Asset.objects.filter(case=case, is_active=True).prefetch_related("valuations")
    )
    if not assets:
        return []

    by_asset: dict[int, list[tuple[date, Decimal]]] = {}
    date_set: set[date] = set()
    currency = "XOF"

    for asset in assets:
        series: list[tuple[date, Decimal]] = []
        for val in sorted(
            asset.valuations.all(),
            key=lambda v: (v.valued_at, v.created_at),
        ):
            series.append((val.valued_at, val.value))
            date_set.add(val.valued_at)
            currency = val.currency or currency
        by_asset[asset.pk] = series

    points: list[dict] = []
    for d in sorted(date_set):
        total = Decimal("0")
        any_value = False
        for series in by_asset.values():
            last: Decimal | None = None
            for valued_at, value in series:
                if valued_at <= d:
                    last = value
                else:
                    break
            if last is not None:
                total += last
                any_value = True
        if any_value:
            points.append(
                {
                    "date": d.isoformat(),
                    "value": str(total),
                    "currency": currency,
                }
            )
    return points
