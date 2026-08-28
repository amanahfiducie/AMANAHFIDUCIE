from datetime import date
from decimal import Decimal

from django.db import models
from django.db.models import Count, Sum
from django.db.models.functions import Coalesce
from rest_framework.exceptions import ValidationError

from beneficiaries.models import Beneficiary
from beneficiaries.patrimony import get_case_patrimony_total
from cases.permissions import user_can_access_case
from cases.models import FiduciaryCase
from finance.services import get_case_financial_summary

from .models import (
    AmanahManagementProfile,
    CaseInvestmentPolicy,
    Investment,
    InvestmentAssetClass,
    InvestmentParticipant,
    InvestmentValuation,
    PatrimonyInvestmentCategory,
)
from .pigfi_catalog import (
    DEFAULT_CATEGORY_BY_CASE_TYPE,
    DEFAULT_PROFILE_BY_CASE_TYPE,
    INVESTMENT_ELIGIBLE_CASE_TYPES,
)


def _beneficiary_name(beneficiary: Beneficiary) -> str:
    return f"{beneficiary.first_name} {beneficiary.last_name}".strip()


def case_supports_investments(case: FiduciaryCase) -> bool:
    return case.case_type in INVESTMENT_ELIGIBLE_CASE_TYPES


def ensure_case_investment_policy(case: FiduciaryCase) -> CaseInvestmentPolicy:
    existing = CaseInvestmentPolicy.objects.filter(case=case).select_related(
        "patrimony_category",
        "management_profile",
    ).first()
    if existing:
        return existing

    category_code = DEFAULT_CATEGORY_BY_CASE_TYPE.get(case.case_type, "C")
    profile_slug = DEFAULT_PROFILE_BY_CASE_TYPE.get(case.case_type, "amanah-equilibre")

    category = PatrimonyInvestmentCategory.objects.get(code=category_code)
    profile = AmanahManagementProfile.objects.get(slug=profile_slug)

    return CaseInvestmentPolicy.objects.create(
        case=case,
        patrimony_category=category,
        management_profile=profile,
    )


def _decimal(value) -> Decimal:
    if value is None:
        return Decimal("0")
    return Decimal(str(value))


def get_case_planned_investment_amount(case: FiduciaryCase) -> Decimal | None:
    policy = getattr(case, "investment_policy", None)
    if policy is None:
        policy = CaseInvestmentPolicy.objects.filter(case=case).first()
    if policy and policy.planned_investment_amount:
        amount = _decimal(policy.planned_investment_amount)
        return amount if amount > 0 else None
    return None


def get_case_investment_reference_total(case: FiduciaryCase) -> tuple[Decimal, str]:
    planned = get_case_planned_investment_amount(case)
    patrimony_total, currency = get_case_patrimony_total(case)
    if planned is not None:
        return planned, currency

    finance = get_case_financial_summary(case)
    fiduciary_balance = _decimal(finance.get("total_balance"))
    reference_total = patrimony_total if patrimony_total > 0 else fiduciary_balance
    return reference_total, currency


def get_beneficiary_deployed_amount(
    case: FiduciaryCase,
    beneficiary_id: int,
    *,
    exclude_investment_id: int | None = None,
) -> Decimal:
    qs = InvestmentParticipant.objects.filter(
        beneficiary_id=beneficiary_id,
        investment__case=case,
    ).exclude(investment__status=Investment.Status.CLOSED)
    if exclude_investment_id:
        qs = qs.exclude(investment_id=exclude_investment_id)
    total = qs.aggregate(total=Sum("allocated_amount"))["total"]
    return _decimal(total)


def ensure_case_investment_clients(case: FiduciaryCase) -> list[Beneficiary]:
    """Clients d'investissement = bénéficiaires du dossier (si parts individuelles)."""
    return list(Beneficiary.objects.filter(case=case).order_by("id"))


def resolve_beneficiary_share_percent(
    beneficiary: Beneficiary,
    siblings: list[Beneficiary],
) -> Decimal | None:
    """Part effective pour plafonner les investissements."""
    if beneficiary.patrimony_share_percent is not None:
        return _decimal(beneficiary.patrimony_share_percent)

    if len(siblings) == 1:
        return Decimal("100")

    defined = [b for b in siblings if b.patrimony_share_percent is not None]
    undefined = [b for b in siblings if b.patrimony_share_percent is None]
    if not defined:
        return (Decimal("100") / Decimal(len(siblings))).quantize(Decimal("0.0001"))

    remaining = Decimal("100") - sum(
        (_decimal(b.patrimony_share_percent) for b in defined),
        Decimal("0"),
    )
    if remaining <= 0 or not undefined:
        return None
    return (remaining / Decimal(len(undefined))).quantize(Decimal("0.0001"))


def compute_beneficiary_investment_limit(
    case: FiduciaryCase,
    share_percent: Decimal | None,
) -> Decimal | None:
    """Plafond client : enveloppe à investir (Gestion) si définie, sinon patrimoine."""
    if share_percent is None:
        return None
    reference_total, _currency = get_case_investment_reference_total(case)
    if reference_total <= 0:
        return None
    return (reference_total * share_percent / Decimal("100")).quantize(Decimal("0.01"))


def get_case_beneficiary_capital(case: FiduciaryCase) -> dict:
    reference_total, currency = get_case_investment_reference_total(case)
    patrimony_total, _ = get_case_patrimony_total(case)
    finance = get_case_financial_summary(case)
    fiduciary_balance = _decimal(finance.get("total_balance"))

    beneficiaries = ensure_case_investment_clients(case)
    rows = []
    for beneficiary in beneficiaries:
        share_percent = resolve_beneficiary_share_percent(beneficiary, beneficiaries)
        share_value = compute_beneficiary_investment_limit(case, share_percent)
        patrimony_limit = share_value or Decimal("0")
        deployed = get_beneficiary_deployed_amount(case, beneficiary.id)
        available = max(patrimony_limit - deployed, Decimal("0"))
        rows.append(
            {
                "beneficiary_id": beneficiary.id,
                "display_name": _beneficiary_name(beneficiary),
                "patrimony_share_percent": (
                    str(share_percent) if share_percent is not None else None
                ),
                "patrimony_limit": patrimony_limit,
                "deployed_amount": deployed,
                "available_amount": available,
                "currency": currency,
            }
        )

    return {
        "case_id": case.id,
        "patrimony_total": reference_total
        if get_case_planned_investment_amount(case) is not None
        else patrimony_total,
        "fiduciary_balance": fiduciary_balance,
        "currency": currency,
        "beneficiaries": rows,
    }


def validate_investment_participants(
    case: FiduciaryCase,
    amount_invested: Decimal,
    participants_data: list[dict],
    *,
    exclude_investment_id: int | None = None,
) -> None:
    if not participants_data:
        return

    siblings = ensure_case_investment_clients(case)
    siblings_by_id = {b.id: b for b in siblings}

    total_allocated = Decimal("0")
    for row in participants_data:
        allocated = _decimal(row["allocated_amount"])
        if allocated <= 0:
            raise ValidationError(
                {"participants": "Chaque allocation doit être strictement positive."}
            )
        total_allocated += allocated

        try:
            beneficiary = Beneficiary.objects.get(
                pk=row["beneficiary_id"],
                case=case,
            )
        except Beneficiary.DoesNotExist as exc:
            raise ValidationError(
                {"participants": "Bénéficiaire introuvable pour ce dossier."}
            ) from exc

        share_percent = resolve_beneficiary_share_percent(
            beneficiary,
            siblings if beneficiary.id in siblings_by_id else [beneficiary, *siblings],
        )
        limit_value = compute_beneficiary_investment_limit(case, share_percent)
        if limit_value is None or limit_value <= 0:
            raise ValidationError(
                {
                    "participants": (
                        f"Part patrimoniale non définie pour {_beneficiary_name(beneficiary)}."
                    )
                }
            )

        deployed = get_beneficiary_deployed_amount(
            case,
            beneficiary.id,
            exclude_investment_id=exclude_investment_id,
        )
        if deployed + allocated > limit_value:
            raise ValidationError(
                {
                    "participants": (
                        f"Allocation dépassée pour {_beneficiary_name(beneficiary)} "
                        f"(limite {limit_value}, déjà investi {deployed})."
                    )
                }
            )

    if total_allocated != amount_invested:
        raise ValidationError(
            {
                "participants": (
                    f"La somme des parts clients ({total_allocated}) doit égaler "
                    f"le montant investi ({amount_invested})."
                )
            }
        )


def create_investment_participants(
    investment: Investment,
    participants_data: list[dict],
) -> None:
    for row in participants_data:
        category = PatrimonyInvestmentCategory.objects.get(
            pk=row["patrimony_category_id"],
            is_active=True,
        )
        allocated = _decimal(row["allocated_amount"])
        share_percent = row.get("share_percent")
        InvestmentParticipant.objects.create(
            investment=investment,
            beneficiary_id=row["beneficiary_id"],
            patrimony_category=category,
            allocated_amount=allocated,
            share_percent=_decimal(share_percent) if share_percent is not None else None,
        )


def build_allocation_actual(investments) -> dict[str, float]:
    totals: dict[str, Decimal] = {}
    grand_total = Decimal("0")
    for inv in investments:
        if inv.status == Investment.Status.CLOSED:
            continue
        slug = inv.asset_class.slug
        totals[slug] = totals.get(slug, Decimal("0")) + inv.current_value
        grand_total += inv.current_value

    if grand_total <= 0:
        return {}

    return {
        slug: float((amount / grand_total * Decimal("100")).quantize(Decimal("0.1")))
        for slug, amount in totals.items()
    }


def build_category_distribution(investments) -> list[dict]:
    """Répartition par catégorie patrimoniale PIGFI (via participants)."""
    totals: dict[str, Decimal] = {}
    labels: dict[str, str] = {}
    grand_total = Decimal("0")

    for inv in investments:
        if inv.status == Investment.Status.CLOSED:
            continue
        participants = list(inv.participants.select_related("patrimony_category"))
        if participants:
            for participant in participants:
                code = participant.patrimony_category.code
                labels[code] = participant.patrimony_category.label
                totals[code] = totals.get(code, Decimal("0")) + participant.allocated_amount
                grand_total += participant.allocated_amount
        else:
            policy_category = getattr(
                getattr(inv.case, "investment_policy", None),
                "patrimony_category",
                None,
            )
            if policy_category:
                code = policy_category.code
                labels[code] = policy_category.label
                totals[code] = totals.get(code, Decimal("0")) + inv.current_value
                grand_total += inv.current_value

    if grand_total <= 0:
        return []

    return [
        {
            "code": code,
            "label": labels.get(code, code),
            "amount": str(amount),
            "percent": float((amount / grand_total * Decimal("100")).quantize(Decimal("0.1"))),
        }
        for code, amount in sorted(totals.items())
    ]


def _investment_value_as_of(investment: Investment, as_of) -> Decimal:
    """Valeur connue à une date : dernière estimation ≤ date, sinon montant investi."""
    if as_of < investment.start_date:
        return Decimal("0")
    latest = None
    for valuation in investment.valuations.all():
        if valuation.valued_at > as_of:
            continue
        if latest is None or (valuation.valued_at, valuation.id) > (
            latest.valued_at,
            latest.id,
        ):
            latest = valuation
    if latest is not None:
        return latest.value
    return investment.amount_invested


def _collect_evolution_dates(investments) -> list:
    """Dates d'événements : démarrage + estimations."""
    dates: set = set()
    for inv in investments:
        dates.add(inv.start_date)
        for valuation in inv.valuations.all():
            dates.add(valuation.valued_at)
    return sorted(dates)


def _build_valuation_based_evolution_points(investments) -> list[dict]:
    """Évolution de la valeur totale d'un ensemble d'investissements selon les estimations."""
    active = [inv for inv in investments if inv.status != Investment.Status.CLOSED]
    if not active:
        return []

    valuation_dates = {
        valuation.valued_at
        for inv in active
        for valuation in inv.valuations.all()
    }
    dates = _collect_evolution_dates(active)
    points: list[dict] = []
    for as_of in dates:
        total = sum((_investment_value_as_of(inv, as_of) for inv in active), Decimal("0"))
        if total <= 0 and all(as_of < inv.start_date for inv in active):
            continue
        points.append(
            {
                "date": as_of.isoformat(),
                "value": str(total),
                "label": "Estimation" if as_of in valuation_dates else "Montant investi",
            }
        )
    return points


def _sum_category_series_to_general(category_series: list[dict]) -> list[dict]:
    """Construit la courbe d'ensemble comme somme des catégories (avec report)."""
    if not category_series:
        return []

    all_dates = sorted(
        {
            point["date"]
            for series in category_series
            for point in series["points"]
        }
    )
    if not all_dates:
        return []

    # Index date → valeur pour chaque catégorie
    by_slug: dict[str, dict[str, Decimal]] = {}
    for series in category_series:
        by_slug[series["slug"]] = {
            point["date"]: Decimal(str(point["value"]))
            for point in series["points"]
        }

    last_known: dict[str, Decimal] = {slug: Decimal("0") for slug in by_slug}
    points: list[dict] = []
    for date in all_dates:
        total = Decimal("0")
        any_estimation = False
        for slug, values in by_slug.items():
            if date in values:
                last_known[slug] = values[date]
                # Une date présente dans une catégorie = événement d'estimation ou démarrage
                any_estimation = True
            total += last_known[slug]
        points.append(
            {
                "date": date,
                "value": str(total),
                "label": "Somme des catégories" if any_estimation else "Montant investi",
            }
        )
    return points


def build_patrimony_evolution(
    investments,
    *,
    asset_class_slug: str | None = None,
) -> list[dict]:
    """Évolution du patrimoine selon les estimations — filtrable par classe d'actif."""
    active = [
        inv
        for inv in investments
        if inv.status != Investment.Status.CLOSED
    ]
    if asset_class_slug:
        active = [inv for inv in active if inv.asset_class.slug == asset_class_slug]
    return _build_valuation_based_evolution_points(active)


def build_patrimony_evolution_by_asset_class(investments) -> list[dict]:
    """Une courbe par classe d'actif ; l'ensemble = somme des catégories."""
    active = [
        inv
        for inv in investments
        if inv.status != Investment.Status.CLOSED
    ]
    by_slug: dict[str, list] = {}
    labels: dict[str, str] = {}
    for inv in active:
        slug = inv.asset_class.slug
        labels[slug] = inv.asset_class.label
        by_slug.setdefault(slug, []).append(inv)

    series = [
        {
            "slug": slug,
            "label": labels[slug],
            "points": _build_valuation_based_evolution_points(by_slug[slug]),
        }
        for slug in sorted(by_slug.keys(), key=lambda s: labels[s])
        if by_slug[slug]
    ]
    general_points = _sum_category_series_to_general(series)
    if general_points:
        series.append(
            {
                "slug": "general",
                "label": "Ensemble du patrimoine",
                "points": general_points,
            }
        )
    return series


def build_invested_vs_available(case: FiduciaryCase, total_invested_value: Decimal) -> dict:
    planned = get_case_planned_investment_amount(case)
    reference_total, currency = get_case_investment_reference_total(case)
    available = max(reference_total - total_invested_value, Decimal("0"))
    invested_percent = (
        float((total_invested_value / reference_total * Decimal("100")).quantize(Decimal("0.1")))
        if reference_total > 0
        else 0.0
    )

    return {
        "patrimony_total": str(reference_total),
        "planned_investment_amount": str(planned) if planned is not None else None,
        "invested_amount": str(total_invested_value),
        "available_amount": str(available),
        "estimated_uninvested": str(available),
        "invested_percent": invested_percent,
        "currency": currency,
    }


def build_participant_share_slices(investment: Investment) -> list[dict]:
    participants = list(
        investment.participants.select_related("beneficiary", "patrimony_category")
    )
    if not participants:
        return []

    total = sum((p.allocated_amount for p in participants), Decimal("0"))
    if total <= 0:
        return []

    return [
        {
            "beneficiary_id": p.beneficiary_id,
            "beneficiary_name": _beneficiary_name(p.beneficiary),
            "category_code": p.patrimony_category.code,
            "category_label": p.patrimony_category.label,
            "amount": str(p.allocated_amount),
            "percent": float(
                (p.allocated_amount / total * Decimal("100")).quantize(Decimal("0.1"))
            ),
        }
        for p in participants
    ]


def _prefetch_investments(case: FiduciaryCase):
    return list(
        Investment.objects.filter(case=case)
        .select_related("asset_class", "created_by", "case")
        .prefetch_related(
            "participants__beneficiary",
            "participants__patrimony_category",
            "valuations",
        )
        .order_by("-start_date", "-created_at")
    )


def build_case_investment_dashboard(case: FiduciaryCase) -> dict:
    policy = ensure_case_investment_policy(case)
    investments = _prefetch_investments(case)

    active_investments = [
        inv for inv in investments if inv.status != Investment.Status.CLOSED
    ]
    total_value = sum((inv.current_value for inv in active_investments), Decimal("0"))
    total_invested = sum((inv.amount_invested for inv in active_investments), Decimal("0"))
    total_distributed = sum(
        (inv.distributed_income for inv in active_investments), Decimal("0")
    )
    latent_gain = total_value - total_invested

    yields = [
        inv.annual_yield_percent
        for inv in active_investments
        if inv.annual_yield_percent is not None
    ]
    annual_yield = None
    if yields:
        annual_yield = float(sum(yields) / len(yields))

    compliance_scores = [
        inv.sharia_compliance_score
        for inv in active_investments
        if inv.sharia_compliance_score is not None
    ]
    sharia_score = policy.sharia_compliance_score
    if compliance_scores:
        avg = sum(compliance_scores) / len(compliance_scores)
        sharia_score = avg

    watchlist = [
        {
            "id": inv.id,
            "label": inv.label,
            "reason": "Purification requise"
            if inv.requires_purification
            else "Conformité à surveiller",
        }
        for inv in active_investments
        if inv.requires_purification
        or (
            inv.sharia_compliance_score is not None
            and inv.sharia_compliance_score < Decimal("80")
        )
    ]

    purification_total = sum(
        (
            inv.purification_amount or Decimal("0")
            for inv in active_investments
            if inv.requires_purification
        ),
        Decimal("0"),
    )

    beneficiaries = case.beneficiaries.count()
    heirs_count = Beneficiary.objects.filter(case=case, is_minor=False).count()
    indivision_risk = "LOW"
    if heirs_count > 3:
        indivision_risk = "MEDIUM"
    if heirs_count > 6:
        indivision_risk = "HIGH"

    category_distribution = build_category_distribution(active_investments)
    patrimony_evolution = build_patrimony_evolution(active_investments)
    patrimony_evolution_by_asset_class = build_patrimony_evolution_by_asset_class(
        active_investments
    )
    invested_vs_available = build_invested_vs_available(case, total_value)

    investments_with_shares = []
    for inv in active_investments:
        slices = build_participant_share_slices(inv)
        if slices:
            investments_with_shares.append(
                {
                    "investment_id": inv.id,
                    "label": inv.label,
                    "participants": slices,
                }
            )

    return {
        "case_id": case.id,
        "case_reference": case.reference,
        "case_title": case.title,
        "case_type": case.case_type,
        "policy": policy,
        "investments": investments,
        "summary": {
            "total_value": total_value,
            "asset_count": len(active_investments),
            "beneficiary_count": beneficiaries,
            "annual_yield_percent": annual_yield,
            "distributed_income": total_distributed,
            "latent_gain": latent_gain,
            "sharia_compliance_score": float(sharia_score) if sharia_score else None,
            "watchlist_count": len(watchlist),
            "purification_total": purification_total,
            "heirs_count": heirs_count,
            "indivision_risk": indivision_risk,
            "allocation_actual": build_allocation_actual(active_investments),
            "allocation_target": policy.patrimony_category.allocation_targets,
        },
        "watchlist": watchlist,
        "charts": {
            "category_distribution": category_distribution,
            "patrimony_evolution": patrimony_evolution,
            "patrimony_evolution_by_asset_class": patrimony_evolution_by_asset_class,
            "invested_vs_available": invested_vs_available,
            "participant_shares": investments_with_shares,
        },
    }


def build_investments_management(user) -> dict:
    overview = build_investments_overview(user)
    investments = (
        Investment.objects.filter(
            models.Q(case__case_type__in=INVESTMENT_ELIGIBLE_CASE_TYPES)
            | models.Q(case__isnull=True),
            parent__isnull=True,
        )
        .exclude(status=Investment.Status.CLOSED)
        .select_related("case", "asset_class")
        .prefetch_related(
            "allocations",
            "allocations__case",
            "participants__beneficiary",
            "participants__patrimony_category",
        )
        .order_by("-start_date", "-created_at")
    )

    items = []
    for inv in investments:
        if inv.case_id is not None and not user_can_access_case(user, inv.case):
            continue
        # Enveloppes sans dossier : visibles pour tout agent ayant accès aux investissements.
        items.append(
            {
                "investment": inv,
                "participant_shares": build_participant_share_slices(inv),
            }
        )

    return {
        **overview,
        "management_investments": items,
    }


def build_investments_overview(user) -> dict:
    cases = (
        FiduciaryCase.objects.filter(case_type__in=INVESTMENT_ELIGIBLE_CASE_TYPES)
        .annotate(
            investment_count=Count(
                "investments",
                filter=~models.Q(investments__status=Investment.Status.CLOSED),
            ),
            total_value=Coalesce(
                Sum(
                    "investments__current_value",
                    filter=~models.Q(investments__status=Investment.Status.CLOSED),
                ),
                Decimal("0"),
            ),
        )
        .order_by("-updated_at")
    )

    accessible_cases = [case for case in cases if user_can_access_case(user, case)]

    categories = PatrimonyInvestmentCategory.objects.filter(is_active=True)
    profiles = AmanahManagementProfile.objects.filter(is_active=True)
    asset_classes = InvestmentAssetClass.objects.filter(is_active=True)

    return {
        "cases": accessible_cases,
        "categories": categories,
        "profiles": profiles,
        "asset_classes": asset_classes,
        "totals": {
            "case_count": len(accessible_cases),
            "total_value": sum((c.total_value for c in accessible_cases), Decimal("0")),
            "investment_count": sum((c.investment_count for c in accessible_cases), 0),
        },
    }


def serialize_case_overview(case) -> dict:
    planned = None
    if isinstance(case, FiduciaryCase):
        planned_amount = get_case_planned_investment_amount(case)
        if planned_amount is not None:
            planned = str(planned_amount)
    return {
        "id": case.id,
        "reference": case.reference,
        "title": case.title,
        "case_type": case.case_type,
        "investment_count": int(getattr(case, "investment_count", 0) or 0),
        "total_value": str(getattr(case, "total_value", 0) or 0),
        "planned_investment_amount": planned,
    }


def _serialize_management_investment(row: dict) -> dict:
    inv = row["investment"]
    allocated = inv.allocated_amount()
    progress = inv.allocation_progress_percent()
    complete = inv.is_allocation_complete()
    case = inv.case
    return {
        "id": inv.id,
        "case_id": inv.case_id,
        "case_reference": case.reference if case else None,
        "case_title": case.title if case else None,
        "label": inv.label,
        "amount_invested": str(inv.amount_invested),
        "current_value": str(inv.current_value),
        "latent_gain": str(inv.latent_gain),
        "status": inv.status,
        "start_date": inv.start_date.isoformat(),
        "asset_class_slug": inv.asset_class.slug,
        "asset_class_label": inv.asset_class.label,
        "annual_yield_percent": (
            str(inv.annual_yield_percent) if inv.annual_yield_percent is not None else None
        ),
        "participant_shares": row["participant_shares"],
        "allocated_amount": str(allocated),
        "allocation_progress_percent": round(progress, 1),
        "is_allocation_complete": complete,
        "is_envelope": inv.is_envelope,
        "allocations": _serialize_investment_allocations(inv),
    }


def _serialize_investment_allocations(inv: Investment) -> list[dict]:
    if inv.is_envelope:
        return [
            {
                "id": child.id,
                "case_id": child.case_id,
                "case_reference": child.case.reference if child.case else None,
                "case_title": child.case.title if child.case else None,
                "amount_invested": str(child.amount_invested),
            }
            for child in inv.allocations.exclude(status=Investment.Status.CLOSED).select_related(
                "case"
            )
        ]
    if inv.case_id is not None:
        return [
            {
                "id": inv.id,
                "case_id": inv.case_id,
                "case_reference": inv.case.reference if inv.case else None,
                "case_title": inv.case.title if inv.case else None,
                "amount_invested": str(inv.amount_invested),
            }
        ]
    return []


def resolve_investment_envelope(investment: Investment) -> Investment:
    """Remonte à l'enveloppe parente si l'on cible une allocation enfant."""
    if investment.parent_id is None:
        return investment
    return (
        Investment.objects.select_related("asset_class", "created_by", "case")
        .prefetch_related(
            "allocations",
            "allocations__case",
            "valuations",
            "valuations__created_by",
            "participants__beneficiary",
            "participants__patrimony_category",
        )
        .get(pk=investment.parent_id)
    )


def serialize_investment_valuation(valuation: InvestmentValuation) -> dict:
    author = None
    if valuation.created_by:
        author = (
            f"{valuation.created_by.first_name} {valuation.created_by.last_name}".strip()
            or valuation.created_by.username
        )
    return {
        "id": valuation.id,
        "value": str(valuation.value),
        "currency": valuation.currency,
        "valued_at": valuation.valued_at.isoformat(),
        "notes": valuation.notes or "",
        "created_by_name": author,
        "created_at": valuation.created_at.isoformat(),
    }


def _subtract_months(day: date, months: int) -> date:
    import calendar

    month = day.month - months
    year = day.year
    while month <= 0:
        month += 12
        year -= 1
    max_day = calendar.monthrange(year, month)[1]
    return date(year, month, min(day.day, max_day))


def _investment_value_on(investment: Investment, day: date) -> Decimal:
    value = investment.amount_invested
    for valuation in investment.valuations.order_by("valued_at", "created_at"):
        if valuation.valued_at <= day:
            value = valuation.value
        else:
            break
    return value


def _investment_activity_start(investment: Investment) -> date:
    """Début de l'activité : date de début ou première estimation enregistrée."""
    activity_start = investment.start_date
    first_valuation = investment.valuations.order_by("valued_at", "created_at").first()
    if first_valuation:
        activity_start = min(activity_start, first_valuation.valued_at)
    return activity_start


def build_investment_valuation_evolution(
    investment: Investment,
    *,
    months: int = 12,
) -> dict:
    """Courbe sur 12 mois glissants, ou depuis le début si l'activité a moins d'un an."""
    from django.utils import timezone

    today = timezone.localdate()
    window_end = today
    rolling_start = _subtract_months(today, months)
    activity_start = _investment_activity_start(investment)
    window_start = max(rolling_start, activity_start)
    from_activity_start = window_start > rolling_start

    points: list[dict] = []
    if window_start <= investment.start_date <= window_end:
        points.append(
            {
                "date": investment.start_date.isoformat(),
                "value": str(investment.amount_invested),
                "label": "Montant investi",
            }
        )

    for valuation in investment.valuations.order_by("valued_at", "created_at"):
        if valuation.valued_at < window_start or valuation.valued_at > window_end:
            continue
        points.append(
            {
                "date": valuation.valued_at.isoformat(),
                "value": str(valuation.value),
                "label": "Estimation",
                "valuation_id": valuation.id,
            }
        )

    points.sort(key=lambda item: item["date"])

    if points:
        start_value = Decimal(points[0]["value"])
        end_value = Decimal(points[-1]["value"])
    else:
        start_value = _investment_value_on(investment, window_start)
        end_value = investment.current_value

    if start_value:
        change_percent = ((end_value - start_value) / start_value * Decimal("100")).quantize(
            Decimal("0.01")
        )
    else:
        change_percent = Decimal("0")

    return {
        "window_months": months,
        "window_start": window_start.isoformat(),
        "window_end": window_end.isoformat(),
        "activity_start": activity_start.isoformat(),
        "from_activity_start": from_activity_start,
        "start_value": str(start_value),
        "end_value": str(end_value if points else investment.current_value),
        "change_percent": str(change_percent),
        "points": points,
    }


def record_investment_valuation(
    investment: Investment,
    *,
    value: Decimal,
    valued_at,
    notes: str = "",
    user=None,
) -> InvestmentValuation:
    envelope = resolve_investment_envelope(investment)
    valuation = InvestmentValuation.objects.create(
        investment=envelope,
        value=value,
        currency=envelope.currency,
        valued_at=valued_at,
        notes=notes or "",
        created_by=user,
    )
    envelope.current_value = value
    envelope.save(update_fields=["current_value", "updated_at"])
    return valuation


def create_investment_envelope(
    *,
    user,
    asset_class: InvestmentAssetClass,
    label: str,
    amount_invested: Decimal,
    start_date,
    reference: str = "",
    notes: str = "",
    risk_summary: str = "",
    annual_yield_percent=None,
    current_value: Decimal | None = None,
    status: str = Investment.Status.PENDING_VALIDATION,
) -> Investment:
    value = current_value if current_value is not None else amount_invested
    return Investment.objects.create(
        case=None,
        parent=None,
        asset_class=asset_class,
        label=label,
        reference=reference or "",
        notes=notes or "",
        risk_summary=risk_summary or "",
        amount_invested=amount_invested,
        current_value=value,
        start_date=start_date,
        status=status,
        annual_yield_percent=annual_yield_percent,
        created_by=user,
    )


def allocate_investment_to_case(
    *,
    envelope: Investment,
    case: FiduciaryCase,
    amount: Decimal,
    user,
) -> Investment:
    if envelope.parent_id is not None:
        raise ValidationError("Seule une enveloppe peut recevoir des allocations.")
    if not envelope.is_envelope and envelope.case_id is not None:
        raise ValidationError(
            "Cet investissement est déjà rattaché à un dossier."
        )
    if amount <= 0:
        raise ValidationError({"amount": "Le montant doit être strictement positif."})

    remaining = envelope.amount_invested - envelope.allocated_amount()
    if amount > remaining + Decimal("0.009"):
        raise ValidationError(
            {
                "amount": (
                    f"Allocation trop élevée : reste {remaining} sur "
                    f"{envelope.amount_invested}."
                )
            }
        )

    # Si enveloppe legacy avec case déjà posé, on la convertit en enveloppe pure.
    if envelope.case_id is not None:
        envelope.case = None
        envelope.save(update_fields=["case", "updated_at"])

    return Investment.objects.create(
        case=case,
        parent=envelope,
        asset_class=envelope.asset_class,
        label=envelope.label,
        reference=envelope.reference,
        notes=envelope.notes,
        risk_summary=envelope.risk_summary,
        amount_invested=amount,
        current_value=amount,
        start_date=envelope.start_date,
        maturity_date=envelope.maturity_date,
        status=envelope.status,
        annual_yield_percent=envelope.annual_yield_percent,
        currency=envelope.currency,
        created_by=user,
    )


def build_investments_global_dashboard(user) -> dict:
    mgmt = build_investments_management(user)
    rows = mgmt["management_investments"]
    investments = [row["investment"] for row in rows]

    uninvested_patrimony = Decimal("0")
    total_planned_envelope = Decimal("0")
    remaining_planned_envelope = Decimal("0")
    case_linked = list(
        Investment.objects.filter(
            case_id__isnull=False,
            case__case_type__in=INVESTMENT_ELIGIBLE_CASE_TYPES,
        )
        .exclude(status=Investment.Status.CLOSED)
        .select_related("asset_class", "case")
        .prefetch_related("valuations")
    )
    for case in mgmt["cases"]:
        if isinstance(case, FiduciaryCase):
            case_invested = sum(
                (
                    inv.current_value
                    for inv in case_linked
                    if inv.case_id == case.id
                ),
                Decimal("0"),
            )
            planned = get_case_planned_investment_amount(case)
            if planned is not None:
                total_planned_envelope += planned
                remaining_planned_envelope += max(planned - case_invested, Decimal("0"))
            else:
                cap = build_invested_vs_available(case, case_invested)
                uninvested_patrimony += _decimal(cap["available_amount"])

    non_invested_for_distribution = (
        remaining_planned_envelope
        if total_planned_envelope > 0
        else uninvested_patrimony
    )

    total_invested = sum((inv.amount_invested for inv in case_linked), Decimal("0"))
    total_current = sum((inv.current_value for inv in case_linked), Decimal("0"))
    latent_gain = total_current - total_invested
    total_gains = sum(
        (max(inv.current_value - inv.amount_invested, Decimal("0")) for inv in case_linked),
        Decimal("0"),
    )
    total_losses = sum(
        (
            abs(min(inv.current_value - inv.amount_invested, Decimal("0")))
            for inv in case_linked
        ),
        Decimal("0"),
    )

    by_class: dict[str, dict] = {}
    for inv in case_linked:
        slug = inv.asset_class.slug
        entry = by_class.setdefault(
            slug,
            {"slug": slug, "label": inv.asset_class.label, "amount": Decimal("0")},
        )
        entry["amount"] += inv.current_value

    distribution_total = total_current + non_invested_for_distribution
    distribution = []
    if distribution_total > 0:
        for entry in sorted(by_class.values(), key=lambda e: e["label"]):
            distribution.append(
                {
                    "code": entry["slug"],
                    "label": entry["label"],
                    "amount": str(entry["amount"]),
                    "percent": float(
                        (entry["amount"] / distribution_total * Decimal("100")).quantize(
                            Decimal("0.1")
                        )
                    ),
                }
            )
        if non_invested_for_distribution > 0:
            distribution.append(
                {
                    "code": "non-investi",
                    "label": "Non investi",
                    "amount": str(non_invested_for_distribution),
                    "percent": float(
                        (
                            non_invested_for_distribution
                            / distribution_total
                            * Decimal("100")
                        ).quantize(Decimal("0.1"))
                    ),
                }
            )

    evolution_series = build_patrimony_evolution_by_asset_class(case_linked)

    return {
        "cases": mgmt["cases"],
        "asset_classes": mgmt["asset_classes"],
        "totals": mgmt["totals"],
        "stats": {
            "total_invested": str(total_invested),
            "total_current_value": str(total_current),
            "latent_gain": str(latent_gain),
            "total_gains": str(total_gains),
            "total_losses": str(total_losses),
            "total_planned_envelope": str(total_planned_envelope),
            "remaining_planned_envelope": str(remaining_planned_envelope),
            "uninvested_amount": str(
                remaining_planned_envelope
                if total_planned_envelope > 0
                else uninvested_patrimony
            ),
            "currency": "XOF",
        },
        "distribution": distribution,
        "patrimony_evolution_by_asset_class": evolution_series,
        "management_investments": [_serialize_management_investment(r) for r in rows],
    }


def _build_category_dossier_allocation(investments: list[Investment]) -> dict:
    """Somme et répartition des montants alloués aux dossiers pour une catégorie."""
    by_case: dict[int, dict] = {}
    total_allocated = Decimal("0")

    for inv in investments:
        if inv.is_envelope:
            children = inv.allocations.exclude(status=Investment.Status.CLOSED).select_related(
                "case"
            )
            for child in children:
                if not child.case_id:
                    continue
                amount = child.amount_invested
                total_allocated += amount
                entry = by_case.setdefault(
                    child.case_id,
                    {
                        "case_id": child.case_id,
                        "case_reference": child.case.reference if child.case else None,
                        "case_title": child.case.title if child.case else None,
                        "amount": Decimal("0"),
                    },
                )
                entry["amount"] += amount
        elif inv.case_id:
            amount = inv.amount_invested
            total_allocated += amount
            entry = by_case.setdefault(
                inv.case_id,
                {
                    "case_id": inv.case_id,
                    "case_reference": inv.case.reference if inv.case else None,
                    "case_title": inv.case.title if inv.case else None,
                    "amount": Decimal("0"),
                },
            )
            entry["amount"] += amount

    dossiers = sorted(by_case.values(), key=lambda row: row["amount"], reverse=True)
    return {
        "total_allocated": str(total_allocated),
        "dossier_count": len(dossiers),
        "dossiers": [
            {
                "case_id": row["case_id"],
                "case_reference": row["case_reference"],
                "case_title": row["case_title"],
                "amount": str(row["amount"]),
            }
            for row in dossiers
        ],
    }


def build_asset_class_dashboard(user, slug: str) -> dict:
    asset_class = InvestmentAssetClass.objects.filter(slug=slug, is_active=True).first()
    if not asset_class:
        return None

    mgmt = build_investments_management(user)
    class_rows = [
        row
        for row in mgmt["management_investments"]
        if row["investment"].asset_class.slug == slug
    ]
    investments = [row["investment"] for row in class_rows]

    total_invested = sum((inv.amount_invested for inv in investments), Decimal("0"))
    total_current = sum((inv.current_value for inv in investments), Decimal("0"))
    latent_gain = total_current - total_invested
    total_gains = sum(
        (max(inv.latent_gain, Decimal("0")) for inv in investments),
        Decimal("0"),
    )
    total_losses = sum(
        (abs(min(inv.latent_gain, Decimal("0"))) for inv in investments),
        Decimal("0"),
    )

    eligible_cases = []
    for case in mgmt["cases"]:
        if not isinstance(case, FiduciaryCase):
            continue
        policy = getattr(case, "investment_policy", None)
        targets = {}
        if policy and policy.patrimony_category:
            targets = policy.patrimony_category.allocation_targets or {}
        if slug in targets or not targets:
            eligible_cases.append(case)

    dossier_allocation = _build_category_dossier_allocation(investments)
    total_allocated = Decimal(dossier_allocation["total_allocated"])
    unallocated_amount = max(total_invested - total_allocated, Decimal("0"))
    incomplete_allocation_count = sum(
        1 for inv in investments if not inv.is_allocation_complete()
    )
    complete_allocation_count = len(investments) - incomplete_allocation_count
    active_count = sum(
        1 for inv in investments if inv.status == Investment.Status.ACTIVE
    )
    allocation_progress_percent = (
        float((total_allocated / total_invested) * Decimal("100"))
        if total_invested > 0
        else 0.0
    )
    performance_percent = (
        float((latent_gain / total_invested) * Decimal("100"))
        if total_invested > 0
        else 0.0
    )

    return {
        "asset_class": asset_class,
        "stats": {
            "investment_count": len(investments),
            "active_count": active_count,
            "total_invested": str(total_invested),
            "total_current_value": str(total_current),
            "total_allocated": str(total_allocated),
            "unallocated_amount": str(unallocated_amount),
            "latent_gain": str(latent_gain),
            "total_gains": str(total_gains),
            "total_losses": str(total_losses),
            "performance_percent": round(performance_percent, 1),
            "allocation_progress_percent": round(allocation_progress_percent, 1),
            "dossier_count": dossier_allocation["dossier_count"],
            "incomplete_allocation_count": incomplete_allocation_count,
            "complete_allocation_count": complete_allocation_count,
            "target_weight_min": asset_class.weight_min,
            "target_weight_max": asset_class.weight_max,
            "currency": "XOF",
            "dossier_allocation": dossier_allocation,
        },
        "investments": [_serialize_management_investment(r) for r in class_rows],
        "cases": eligible_cases,
        "patrimony_evolution": build_patrimony_evolution(investments),
    }
