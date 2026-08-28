from __future__ import annotations

from decimal import Decimal

from assets.models import Asset


def get_case_patrimony_total(case) -> tuple[Decimal, str]:
    """Somme des dernières valorisations des actifs actifs du dossier."""
    total = Decimal("0")
    currency = "XOF"
    assets = Asset.objects.filter(case=case, is_active=True).prefetch_related("valuations")
    for asset in assets:
        latest = asset.latest_valuation
        if latest is None:
            continue
        total += latest.value
        if latest.currency:
            currency = latest.currency
    return total, currency


def compute_beneficiary_patrimony_share_value(
    case,
    share_percent: Decimal | None,
) -> Decimal | None:
    if share_percent is None:
        return None
    total, _currency = get_case_patrimony_total(case)
    if total <= 0:
        return None
    return (total * share_percent / Decimal("100")).quantize(Decimal("0.01"))
