from __future__ import annotations

import calendar
import io
from datetime import date
from decimal import Decimal

from django.core.files.base import ContentFile
from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from cases.models import FiduciaryCase, TimelineEventType
from cases.services import record_timeline_event
from reports.models import (
    GenerationJobStatus,
    Report,
    ReportGenerationJob,
    ReportStatus,
    ReportType,
)
from reports.service_profiles import get_service_report_profile, section_enabled


def _report_type_label(report_type: str) -> str:
    try:
        return ReportType(report_type).label
    except ValueError:
        return report_type


def _money(value) -> str:
    if value is None:
        return "0"
    if isinstance(value, Decimal):
        return str(value.quantize(Decimal("0.01")))
    return str(value)


def _dec(value) -> Decimal:
    try:
        return Decimal(str(value or "0"))
    except Exception:  # noqa: BLE001
        return Decimal("0")


def default_period_for_report_type(
    report_type: str,
    *,
    today: date | None = None,
) -> tuple[date, date]:
    """Période par défaut : mois courant (mensuel) ou année civile (annuel / autres)."""
    today = today or timezone.localdate()
    if report_type == ReportType.MONTHLY_MANAGEMENT_REPORT:
        start = today.replace(day=1)
        last_day = calendar.monthrange(today.year, today.month)[1]
        end = today.replace(day=last_day)
        return start, end
    start = date(today.year, 1, 1)
    end = date(today.year, 12, 31)
    return start, end


def resolve_report_period(
    report_type: str,
    period_start: date | None,
    period_end: date | None,
) -> tuple[date, date]:
    if period_start and period_end:
        if period_end < period_start:
            period_start, period_end = period_end, period_start
        return period_start, period_end
    return default_period_for_report_type(report_type)


def _period_label(period_start: date, period_end: date) -> str:
    months_fr = (
        "",
        "janvier",
        "février",
        "mars",
        "avril",
        "mai",
        "juin",
        "juillet",
        "août",
        "septembre",
        "octobre",
        "novembre",
        "décembre",
    )
    if (
        period_start.day == 1
        and period_end.day
        == calendar.monthrange(period_end.year, period_end.month)[1]
        and period_start.month == period_end.month
        and period_start.year == period_end.year
    ):
        return f"{months_fr[period_start.month]} {period_start.year}"
    if (
        period_start.month == 1
        and period_start.day == 1
        and period_end.month == 12
        and period_end.day == 31
        and period_start.year == period_end.year
    ):
        return f"année {period_start.year}"
    return f"{period_start.strftime('%d/%m/%Y')} – {period_end.strftime('%d/%m/%Y')}"


def _finance_period_flows(case: FiduciaryCase, period_start: date, period_end: date) -> dict:
    from finance.models import DEBIT_TYPES, FinancialMovement, MovementStatus, MovementType

    qs = FinancialMovement.objects.filter(
        account__case=case,
        account__is_active=True,
        status=MovementStatus.APPROVED,
        movement_date__gte=period_start,
        movement_date__lte=period_end,
    )
    income = Decimal("0")
    expense = Decimal("0")
    for row in qs.values("movement_type").annotate(total=Sum("amount")):
        amount = row["total"] or Decimal("0")
        mtype = row["movement_type"]
        if mtype == MovementType.INCOME:
            income += amount
        elif mtype in DEBIT_TYPES:
            expense += amount

    movements = list(
        qs.select_related("account", "category")
        .order_by("-movement_date")[:30]
        .values(
            "id",
            "movement_date",
            "movement_type",
            "amount",
            "description",
            "account__name",
            "category__label",
        )
    )
    return {
        "income_total": _money(income),
        "expense_total": _money(expense),
        "net_flow": _money(income - expense),
        "movement_count": qs.count(),
        "movements": [
            {
                "id": m["id"],
                "date": m["movement_date"].isoformat() if m["movement_date"] else None,
                "type": m["movement_type"],
                "amount": _money(m["amount"]),
                "label": m["description"] or "",
                "account": m["account__name"] or "",
                "category": m["category__label"] or "",
            }
            for m in movements
        ],
    }


def _patrimony_period_events(
    case: FiduciaryCase, period_start: date, period_end: date
) -> dict:
    from assets.models import AssetEvent, AssetEventStatus, AssetEventType

    qs = AssetEvent.objects.filter(
        asset__case=case,
        asset__is_active=True,
        status=AssetEventStatus.ACTIVE,
        event_date__gte=period_start,
        event_date__lte=period_end,
        amount__isnull=False,
    )
    gains = qs.filter(event_type=AssetEventType.GAIN).aggregate(s=Sum("amount"))["s"]
    expenses = qs.filter(event_type=AssetEventType.EXPENSE).aggregate(s=Sum("amount"))["s"]
    gains = gains or Decimal("0")
    expenses = expenses or Decimal("0")
    return {
        "period_gains": _money(gains),
        "period_expenses": _money(expenses),
        "period_net": _money(gains - expenses),
    }


def _investment_snapshot(case: FiduciaryCase) -> dict | None:
    from investments.services import (
        build_case_investment_dashboard,
        case_supports_investments,
    )

    if not case_supports_investments(case):
        return None

    try:
        dash = build_case_investment_dashboard(case)
    except Exception:  # noqa: BLE001 — dossier sans politique / catalogue
        return None

    policy = dash.get("policy")
    summary = dash.get("summary") or {}
    charts = dash.get("charts") or {}
    investments = dash.get("investments") or []

    policy_payload = None
    if policy is not None:
        cat = getattr(policy, "patrimony_category", None)
        policy_payload = {
            "planned_investment_amount": _money(
                getattr(policy, "planned_investment_amount", None)
            ),
            "management_profile": {
                "code": getattr(getattr(policy, "management_profile", None), "code", ""),
                "label": getattr(getattr(policy, "management_profile", None), "label", ""),
            },
            "patrimony_category": {
                "code": getattr(cat, "code", ""),
                "label": getattr(cat, "label", ""),
                "allocation_targets": getattr(cat, "allocation_targets", {}) or {},
                "target_yield_min": str(getattr(cat, "target_yield_min", "") or ""),
                "target_yield_max": str(getattr(cat, "target_yield_max", "") or ""),
            },
        }

    invested_by_class: dict[str, Decimal] = {}
    positions = []
    for inv in investments:
        if getattr(inv, "status", None) == "CLOSED":
            continue
        slug = getattr(getattr(inv, "asset_class", None), "slug", "") or "autre"
        label = getattr(getattr(inv, "asset_class", None), "label", slug)
        amount = _dec(getattr(inv, "current_value", None) or getattr(inv, "amount_invested", 0))
        invested = _dec(getattr(inv, "amount_invested", 0))
        invested_by_class[slug] = invested_by_class.get(slug, Decimal("0")) + invested
        positions.append(
            {
                "id": inv.pk,
                "label": inv.label,
                "asset_class_slug": slug,
                "asset_class_label": label,
                "amount_invested": _money(invested),
                "current_value": _money(amount),
                "status": inv.status,
                "annual_yield_percent": (
                    float(inv.annual_yield_percent)
                    if inv.annual_yield_percent is not None
                    else None
                ),
            }
        )

    allocation_rows = []
    targets = (policy_payload or {}).get("patrimony_category", {}).get(
        "allocation_targets", {}
    ) or {}
    planned = _dec((policy_payload or {}).get("planned_investment_amount"))
    for slug, pct in targets.items():
        target_pct = float(pct or 0)
        target_amount = (planned * Decimal(str(target_pct)) / Decimal("100")) if planned else Decimal("0")
        invested_amt = invested_by_class.get(slug, Decimal("0"))
        allocation_rows.append(
            {
                "slug": slug,
                "target_percent": target_pct,
                "target_amount": _money(target_amount),
                "invested_amount": _money(invested_amt),
                "remaining_amount": _money(max(target_amount - invested_amt, Decimal("0"))),
            }
        )

    return {
        "policy": policy_payload,
        "summary": {
            "total_value": _money(summary.get("total_value")),
            "asset_count": summary.get("asset_count", 0),
            "annual_yield_percent": summary.get("annual_yield_percent"),
            "distributed_income": _money(summary.get("distributed_income")),
            "latent_gain": _money(summary.get("latent_gain")),
            "sharia_compliance_score": summary.get("sharia_compliance_score"),
            "allocation_actual": summary.get("allocation_actual") or {},
            "allocation_target": summary.get("allocation_target") or {},
        },
        "charts": {
            "category_distribution": charts.get("category_distribution") or [],
            "patrimony_evolution": charts.get("patrimony_evolution") or [],
            "patrimony_evolution_by_asset_class": charts.get(
                "patrimony_evolution_by_asset_class"
            )
            or [],
            "invested_vs_available": charts.get("invested_vs_available") or {},
        },
        "allocation_rows": allocation_rows,
        "positions": positions[:40],
    }


def _serialize_family_member(b) -> dict:
    return {
        "id": b.pk,
        "first_name": b.first_name or "",
        "last_name": b.last_name or "",
        "date_of_birth": b.date_of_birth.isoformat() if b.date_of_birth else None,
        "is_minor": bool(b.is_minor),
        "nationality": b.nationality or "",
        "identification_number": getattr(b, "identification_number", "") or "",
        "notes": b.notes or "",
        "donor": b.donor_id,
        "donor_name": (
            f"{b.donor.first_name} {b.donor.last_name}".strip()
            if b.donor_id
            else None
        ),
        "guardian": b.guardian_id,
        "guardian_name": (
            f"{b.guardian.first_name} {b.guardian.last_name}".strip()
            if b.guardian_id
            else None
        ),
        "relation_to_donor": b.relation_to_donor or "",
        "relation_to_donor_label": (
            b.get_relation_to_donor_display() if b.relation_to_donor else ""
        ),
        "gender": b.gender or "",
        "father": b.father_id,
        "mother": b.mother_id,
        "father_name": (
            f"{b.father.first_name} {b.father.last_name}".strip()
            if b.father_id
            else None
        ),
        "mother_name": (
            f"{b.mother.first_name} {b.mother.last_name}".strip()
            if b.mother_id
            else None
        ),
        "patrimony_share_percent": (
            str(b.patrimony_share_percent)
            if b.patrimony_share_percent is not None
            else None
        ),
    }


def _infer_deceased_gender(members: list) -> str | None:
    """Heuristique : si une seule épouse → défunt H ; un seul époux → défunte F."""
    spouses = [m for m in members if getattr(m, "relation_to_donor", "") == "SPOUSE"]
    if len(spouses) == 1:
        g = getattr(spouses[0], "gender", "") or ""
        if g == "F":
            return "M"
        if g == "M":
            return "F"
    return None


def _genealogy_snapshot(case: FiduciaryCase) -> dict | None:
    """Arbres succession : base, décisions comité, partage final."""
    from beneficiaries.models import Beneficiary

    members_qs = (
        Beneficiary.objects.filter(case=case)
        .select_related("donor", "guardian", "father", "mother")
        .order_by("last_name", "first_name")
    )
    members = list(members_qs)
    family_members = [_serialize_family_member(b) for b in members]

    donor = case.donors.order_by("id").first()
    deceased_name = "Le défunt"
    if donor is not None:
        deceased_name = (
            f"{donor.first_name} {donor.last_name}".strip() or "Le défunt"
        )

    deceased_gender = _infer_deceased_gender(members)

    decisions: list[dict] = []
    review_status = None
    review_status_label = None
    currency = "XOF"
    try:
        from faraid.models import FaraidCommitteeReview, FaraidReviewStatus

        review = getattr(case, "faraid_review", None)
        if review is None:
            review = FaraidCommitteeReview.objects.filter(case=case).first()
        if review is not None:
            review_status = review.status
            review_status_label = review.get_status_display()
            currency = review.currency or "XOF"
            for d in review.heir_decisions.select_related("beneficiary").all():
                decisions.append(
                    {
                        "id": d.pk,
                        "beneficiary": d.beneficiary_id,
                        "full_name": d.full_name,
                        "relationship_label": d.relationship_label or "",
                        "faraid_role": d.faraid_role or "",
                        "status": d.status,
                        "share_fraction": (
                            str(d.share_fraction)
                            if d.share_fraction is not None
                            else None
                        ),
                        "share_amount": (
                            _money(d.share_amount)
                            if d.share_amount is not None
                            else None
                        ),
                        "committee_notes": d.committee_notes or "",
                        "rejection_justification": d.rejection_justification or "",
                    }
                )
            is_final = review.status == FaraidReviewStatus.FINALIZED
        else:
            is_final = False
    except Exception:  # noqa: BLE001
        is_final = False

    has_decisions = len(decisions) > 0
    return {
        "deceased_name": deceased_name,
        "deceased_gender": deceased_gender,
        "family_members": family_members,
        "member_count": len(family_members),
        "decisions": decisions,
        "review_status": review_status,
        "review_status_label": review_status_label,
        "currency": currency,
        "trees": {
            "base": True,
            "with_decisions": has_decisions,
            "final_share": is_final,
        },
    }


def _waqf_snapshot(case: FiduciaryCase) -> dict | None:
    profile = getattr(case, "waqf_profile", None)
    if profile is None:
        try:
            from waqf.models import WaqfProfile

            profile = WaqfProfile.objects.filter(case=case).first()
        except Exception:  # noqa: BLE001
            return None
    if profile is None:
        return None
    return {
        "waqf_type": profile.waqf_type,
        "waqf_type_label": profile.get_waqf_type_display(),
        "waqf_object": profile.waqf_object or "",
        "waqf_distribution_rules": profile.waqf_distribution_rules or "",
    }


def _zakat_snapshot(case: FiduciaryCase, period_start: date, period_end: date) -> dict | None:
    try:
        from zakat.models import ZakatAssessment
    except Exception:  # noqa: BLE001
        return None

    years = list(range(period_start.year, period_end.year + 1))
    qs = ZakatAssessment.objects.filter(case=case, assessment_year__in=years).order_by(
        "-assessment_year"
    )
    rows = list(qs[:10])
    if not rows:
        rows = list(
            ZakatAssessment.objects.filter(case=case).order_by("-assessment_year")[:5]
        )
    if not rows:
        return {"assessments": [], "latest": None}
    assessments = [
        {
            "year": a.assessment_year,
            "nisab_amount": _money(a.nisab_amount),
            "zakatable_wealth": _money(a.zakatable_wealth),
            "zakat_due": _money(a.zakat_due),
            "currency": a.currency,
            "status": a.status,
            "status_label": a.get_status_display(),
            "notes": a.notes or "",
        }
        for a in rows
    ]
    return {"assessments": assessments, "latest": assessments[0]}


def _faraid_snapshot(case: FiduciaryCase) -> dict | None:
    try:
        from faraid.models import FaraidCommitteeReview, FaraidHeir, FaraidHeirDecision
    except Exception:  # noqa: BLE001
        return None

    heirs = list(case.faraid_heirs.all()[:40]) if hasattr(case, "faraid_heirs") else []
    if not heirs:
        heirs = list(FaraidHeir.objects.filter(case=case)[:40])

    heir_rows = [
        {
            "full_name": h.full_name,
            "relationship_label": h.relationship_label or "",
            "share_fraction": str(h.share_fraction),
            "share_percent": float(h.share_fraction * 100),
        }
        for h in heirs
    ]
    share_total = sum((float(h.share_fraction) for h in heirs), 0.0)

    review = None
    decisions: list[dict] = []
    try:
        review_obj = FaraidCommitteeReview.objects.filter(case=case).first()
        if review_obj:
            review = {
                "status": review_obj.status,
                "status_label": review_obj.get_status_display(),
                "net_estate": _money(getattr(review_obj, "net_estate", None)),
                "notes": getattr(review_obj, "committee_notes", "")
                or getattr(review_obj, "notes", "")
                or "",
            }
            for d in review_obj.heir_decisions.all()[:40]:
                decisions.append(
                    {
                        "full_name": d.full_name,
                        "relationship_label": d.relationship_label or "",
                        "status": d.status,
                        "share_fraction": (
                            str(d.share_fraction) if d.share_fraction is not None else ""
                        ),
                        "share_amount": (
                            _money(d.share_amount) if d.share_amount is not None else ""
                        ),
                    }
                )
    except Exception:  # noqa: BLE001
        pass

    return {
        "heirs_count": len(heir_rows),
        "share_total": round(share_total, 4),
        "heirs": heir_rows,
        "review": review,
        "decisions": decisions,
    }


def build_period_report_snapshot(
    case: FiduciaryCase,
    *,
    period_start: date,
    period_end: date,
    report_type: str,
) -> dict:
    """Snapshot JSON-sérialisable figé dans metadata_json — adapté au type de service."""
    from assets.services import get_case_patrimony_summary
    from finance.services import get_case_financial_summary

    profile = get_service_report_profile(case.case_type)
    sections = profile["sections"]

    finance = None
    finance_flows = None
    if section_enabled(profile, "finance"):
        finance = get_case_financial_summary(case)
        finance_flows = _finance_period_flows(case, period_start, period_end)

    patrimony = None
    patrimony_period = None
    by_type_slices: list[dict] = []
    if section_enabled(profile, "patrimony"):
        patrimony = get_case_patrimony_summary(case)
        patrimony_period = _patrimony_period_events(case, period_start, period_end)
        by_type_slices = [
            {
                "code": asset_type,
                "label": asset_type.replace("_", " ").title(),
                "amount": data["total_value"],
                "count": data["count"],
                "percent": 0,
            }
            for asset_type, data in (patrimony.get("by_type") or {}).items()
        ]
        total_pat = _dec(patrimony.get("total_estimated_value"))
        if total_pat > 0:
            for slice_row in by_type_slices:
                slice_row["percent"] = round(
                    float(_dec(slice_row["amount"]) / total_pat * 100), 1
                )

    investments = None
    if section_enabled(profile, "investments"):
        investments = _investment_snapshot(case)

    waqf = _waqf_snapshot(case) if section_enabled(profile, "waqf") else None
    zakat = (
        _zakat_snapshot(case, period_start, period_end)
        if section_enabled(profile, "zakat")
        else None
    )
    faraid = _faraid_snapshot(case) if section_enabled(profile, "faraid") else None
    genealogy = (
        _genealogy_snapshot(case) if section_enabled(profile, "genealogy") else None
    )

    donors = list(case.donors.all()[:20]) if section_enabled(profile, "people") else []
    beneficiaries = (
        list(case.beneficiaries.all()[:50]) if section_enabled(profile, "people") else []
    )
    mandates = (
        list(case.mandates.all()[:20]) if section_enabled(profile, "mandates") else []
    )
    minors = [b for b in beneficiaries if getattr(b, "is_minor", False)]

    assigned = getattr(case, "assigned_to", None)
    assigned_name = ""
    if assigned is not None:
        assigned_name = (
            (assigned.get_full_name() or "").strip() or assigned.get_username()
        )

    invested_vs = (investments or {}).get("charts", {}).get("invested_vs_available") or {}
    latest_zakat = (zakat or {}).get("latest") or {}
    currency = (
        (finance or {}).get("currency")
        or (patrimony or {}).get("currency")
        or latest_zakat.get("currency")
        or "XOF"
    )

    kpis_all = {
        "patrimony_total": (patrimony or {}).get("total_estimated_value", "0"),
        "liquidities": (finance or {}).get("total_balance", "0"),
        "invested_percent": invested_vs.get("invested_percent", 0),
        "invested_amount": invested_vs.get("invested_amount", "0"),
        "available_amount": invested_vs.get("available_amount", "0"),
        "annual_yield_percent": (investments or {})
        .get("summary", {})
        .get("annual_yield_percent"),
        "currency": currency or "XOF",
        "period_net_flow": (finance_flows or {}).get("net_flow", "0"),
        "period_patrimony_net": (patrimony_period or {}).get("period_net", "0"),
        "beneficiaries_count": len(beneficiaries),
        "minors_count": len(minors),
        "heirs_count": (faraid or {}).get("heirs_count", 0),
        "faraid_share_total": (faraid or {}).get("share_total", 0),
        "zakatable_wealth": latest_zakat.get("zakatable_wealth", "0"),
        "zakat_due": latest_zakat.get("zakat_due", "0"),
    }
    kpis = dict(kpis_all)

    snapshot: dict = {
        "version": 2,
        "generated_at": timezone.now().isoformat(),
        "report_type": report_type,
        "service": profile,
        "period": {
            "start": period_start.isoformat(),
            "end": period_end.isoformat(),
            "label": _period_label(period_start, period_end),
        },
        "case": {
            "id": case.pk,
            "reference": case.reference,
            "title": case.title,
            "case_type": case.case_type or "",
            "case_type_label": case.get_case_type_display() if case.case_type else "",
            "status": case.status or "",
            "status_label": case.get_status_display() if case.status else "",
            "description": case.description or "",
            "assigned_to_name": assigned_name,
        },
        "kpis": kpis,
        "people": {
            "label": profile["people_label"],
            "donor_label": profile["donor_label"],
            "donors_count": len(donors),
            "beneficiaries_count": len(beneficiaries),
            "minors_count": len(minors),
            "mandates_count": len(mandates),
            "donors": [
                {
                    "name": f"{getattr(d, 'first_name', '')} {getattr(d, 'last_name', '')}".strip()
                    or str(d),
                }
                for d in donors
            ],
            "beneficiaries": [
                {
                    "name": f"{b.first_name} {b.last_name}".strip(),
                    "is_minor": bool(getattr(b, "is_minor", False)),
                }
                for b in beneficiaries
            ],
            "mandates": [
                {"title": m.title, "status": getattr(m, "status", "")}
                for m in mandates
            ],
        },
    }

    if sections.get("finance") and finance is not None:
        snapshot["finance"] = {
            **finance,
            "period_flows": finance_flows,
        }
    if sections.get("patrimony") and patrimony is not None:
        snapshot["patrimony"] = {
            **{k: v for k, v in patrimony.items() if k != "assets"},
            "by_type_slices": by_type_slices,
            "period_events": patrimony_period,
            "assets": (patrimony.get("assets") or [])[:40],
        }
    if sections.get("investments"):
        snapshot["investments"] = investments
    if sections.get("waqf"):
        snapshot["waqf"] = waqf
    if sections.get("zakat"):
        snapshot["zakat"] = zakat
    if sections.get("faraid"):
        snapshot["faraid"] = faraid
    if sections.get("genealogy"):
        snapshot["genealogy"] = genealogy

    return snapshot


def build_report_context(case: FiduciaryCase) -> dict:
    """Compatibilité legacy — synthèse légère sans période."""
    assets = list(case.assets.all()[:50])
    beneficiaries = list(case.beneficiaries.all()[:50])
    mandates = list(case.mandates.all()[:20])
    donors = list(case.donors.all()[:10])
    return {
        "reference": case.reference,
        "title": case.title,
        "case_type": case.get_case_type_display() if case.case_type else "",
        "status": case.get_status_display() if case.status else "",
        "description": case.description or "",
        "generated_at": timezone.now().strftime("%d/%m/%Y %H:%M UTC"),
        "donors_count": len(donors),
        "beneficiaries_count": len(beneficiaries),
        "mandates_count": len(mandates),
        "assets_count": len(assets),
        "beneficiaries": [f"- {b.first_name} {b.last_name}" for b in beneficiaries],
        "assets": [f"- {a.label} ({a.get_asset_type_display()})" for a in assets],
        "mandates": [f"- {m.title}" for m in mandates],
    }


def _safe_filename_part(value: str, *, max_len: int = 80) -> str:
    """Nettoie un segment de nom de fichier (accents conservés, caractères interdits retirés)."""
    import re
    import unicodedata

    text = unicodedata.normalize("NFC", (value or "").strip())
    text = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "", text)
    text = re.sub(r"\s+", "_", text)
    text = re.sub(r"_+", "_", text).strip("._")
    return (text[:max_len] or "document")


def report_pdf_filename(report: Report) -> str:
    """Nom de fichier PDF : {nom_du_service}_{nom_du_dossier}.pdf"""
    case = report.case
    snap = report.metadata_json if isinstance(report.metadata_json, dict) else {}
    service = snap.get("service") if isinstance(snap.get("service"), dict) else {}

    service_name = (
        (service.get("report_name") or "").strip()
        or get_service_report_profile(getattr(case, "case_type", None)).get("report_name")
        or (
            case.get_case_type_display()
            if hasattr(case, "get_case_type_display")
            else ""
        )
        or "Rapport"
    )
    dossier_name = (getattr(case, "title", None) or "").strip() or getattr(
        case, "reference", ""
    ) or "dossier"

    return f"{_safe_filename_part(service_name)}_{_safe_filename_part(dossier_name)}.pdf"


def render_report_pdf(report: Report) -> bytes:
    """PDF A4 premium (cartes, graphiques, arbres) — aligné sur l'aperçu HTML."""
    from reports.pdf_brand import PDF_ENGINE
    from reports.pdf_premium import render_premium_report_pdf

    snapshot = report.metadata_json if isinstance(report.metadata_json, dict) else {}
    if not snapshot.get("version"):
        # Ancien brouillon sans snapshot
        case = report.case
        start, end = resolve_report_period(
            report.report_type, report.period_start, report.period_end
        )
        snapshot = build_period_report_snapshot(
            case,
            period_start=start,
            period_end=end,
            report_type=report.report_type,
        )

    pdf_bytes = render_premium_report_pdf(report, snapshot)
    if isinstance(report.metadata_json, dict):
        meta = dict(report.metadata_json)
        meta["pdf_engine"] = PDF_ENGINE
        report.metadata_json = meta
    return pdf_bytes


def generate_report_file(report: Report) -> ReportGenerationJob:
    job = report.generation_job
    job.status = GenerationJobStatus.RUNNING
    job.started_at = timezone.now()
    job.save(update_fields=["status", "started_at"])

    try:
        start, end = resolve_report_period(
            report.report_type, report.period_start, report.period_end
        )
        if report.period_start != start or report.period_end != end:
            report.period_start = start
            report.period_end = end
            report.save(update_fields=["period_start", "period_end", "updated_at"])

        snapshot = build_period_report_snapshot(
            report.case,
            period_start=start,
            period_end=end,
            report_type=report.report_type,
        )
        report.metadata_json = snapshot
        report.save(update_fields=["metadata_json", "updated_at"])

        pdf_bytes = render_report_pdf(report)
        filename = report_pdf_filename(report)
        report.file.save(filename, ContentFile(pdf_bytes), save=True)
        report.status = ReportStatus.DRAFT
        report.save(update_fields=["status", "file", "metadata_json", "updated_at"])
        job.status = GenerationJobStatus.COMPLETED
        job.finished_at = timezone.now()
        job.error_message = ""
    except Exception as exc:  # noqa: BLE001 — journaliser l'échec de génération
        job.status = GenerationJobStatus.FAILED
        job.finished_at = timezone.now()
        job.error_message = str(exc)[:2000]
        job.save(update_fields=["status", "finished_at", "error_message"])
        raise

    job.save(update_fields=["status", "finished_at", "error_message"])
    return job


def default_report_title(
    report_type: str,
    period_start: date | None,
    period_end: date | None,
    *,
    case_type: str | None = None,
) -> str:
    start, end = resolve_report_period(report_type, period_start, period_end)
    label = _period_label(start, end)
    profile = get_service_report_profile(case_type)
    base = profile.get("report_name") or _report_type_label(report_type)
    if report_type == ReportType.ANNUAL_MANAGEMENT_REPORT and "annuel" not in base.lower():
        base = base.replace("Rapport de", "Rapport annuel de", 1)
    return f"{base} — {label}"


@transaction.atomic
def create_report_draft(
    *,
    case: FiduciaryCase,
    report_type: str,
    title: str,
    generated_by,
    template=None,
    period_start=None,
    period_end=None,
) -> Report:
    start, end = resolve_report_period(report_type, period_start, period_end)
    if not (title or "").strip():
        title = default_report_title(
            report_type, start, end, case_type=case.case_type
        )

    report = Report.objects.create(
        case=case,
        template=template,
        report_type=report_type,
        title=title.strip(),
        status=ReportStatus.DRAFT,
        period_start=start,
        period_end=end,
        generated_by=generated_by,
    )
    ReportGenerationJob.objects.create(report=report)
    generate_report_file(report)
    record_timeline_event(
        case=case,
        event_type=TimelineEventType.UPDATED,
        message=f"Rapport généré (brouillon) : {report.title}",
        actor=generated_by,
        metadata={
            "report_id": report.pk,
            "report_type": report_type,
            "case_type": case.case_type or "",
            "period_start": start.isoformat(),
            "period_end": end.isoformat(),
        },
    )
    return report
