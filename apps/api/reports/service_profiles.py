"""Profils de rapport selon le type de service (CaseType)."""

from __future__ import annotations

from cases.models import CaseType

# Sections possibles : finance, patrimony, investments, people, mandates,
# waqf, zakat, faraid, minors_focus

SERVICE_REPORT_PROFILES: dict[str, dict] = {
    CaseType.MANDAT_FIDUCIAIRE: {
        "code": CaseType.MANDAT_FIDUCIAIRE,
        "report_name": "Rapport de gestion du mandat fiduciaire",
        "subtitle": (
            "Reddition de comptes : patrimoine confié, liquidités, "
            "investissements et bénéficiaires."
        ),
        "people_label": "Bénéficiaires",
        "donor_label": "Donateurs / constituants",
        "mandate_label": "Mandats",
        "sections": {
            "finance": True,
            "patrimony": True,
            "investments": True,
            "people": True,
            "mandates": True,
            "waqf": False,
            "zakat": False,
            "faraid": False,
            "genealogy": False,
            "minors_focus": False,
        },
        "kpis": [
            "patrimony_total",
            "liquidities",
            "invested_amount",
            "annual_yield_percent",
        ],
    },
    CaseType.TUTELLE_CANTONNEMENT: {
        "code": CaseType.TUTELLE_CANTONNEMENT,
        "report_name": "Rapport de tutelle / cantonnement",
        "subtitle": (
            "Suivi des biens cantonnés, protection des mineurs, "
            "placements et reddition au juge / tuteur."
        ),
        "people_label": "Protégés / bénéficiaires",
        "donor_label": "Constituants",
        "mandate_label": "Mandats de tutelle",
        "sections": {
            "finance": True,
            "patrimony": True,
            "investments": True,
            "people": True,
            "mandates": True,
            "waqf": False,
            "zakat": False,
            "faraid": False,
            "genealogy": False,
            "minors_focus": True,
        },
        "kpis": [
            "patrimony_total",
            "liquidities",
            "invested_amount",
            "minors_count",
        ],
    },
    CaseType.SUCCESSION: {
        "code": CaseType.SUCCESSION,
        "report_name": "Rapport de conseil successoral",
        "subtitle": (
            "Évaluation du patrimoine successoral, arbres généalogiques, "
            "famille / héritiers et partage farāʾiḍ."
        ),
        "people_label": "Famille / héritiers",
        "donor_label": "Défunt / de cujus",
        "mandate_label": "Actes & mandats",
        "sections": {
            "finance": False,
            "patrimony": True,
            "investments": False,
            "people": True,
            "mandates": True,
            "waqf": False,
            "zakat": False,
            "faraid": True,
            "genealogy": True,
            "minors_focus": False,
        },
        "kpis": [
            "patrimony_total",
            "heirs_count",
            "faraid_share_total",
            "period_patrimony_net",
        ],
    },
    CaseType.WAQF: {
        "code": CaseType.WAQF,
        "report_name": "Rapport de gestion du waqf",
        "subtitle": (
            "Objet du waqf, règles de répartition, patrimoine immobilisé "
            "et flux de la période."
        ),
        "people_label": "Bénéficiaires du waqf",
        "donor_label": "Waqif / constituants",
        "mandate_label": "Actes de waqf",
        "sections": {
            "finance": True,
            "patrimony": True,
            "investments": False,
            "people": True,
            "mandates": True,
            "waqf": True,
            "zakat": False,
            "faraid": False,
            "genealogy": False,
            "minors_focus": False,
        },
        "kpis": [
            "patrimony_total",
            "liquidities",
            "period_net_flow",
            "beneficiaries_count",
        ],
    },
    CaseType.ZAKAT_FARAID: {
        "code": CaseType.ZAKAT_FARAID,
        "report_name": "Rapport zakat & farāʾiḍ",
        "subtitle": (
            "Assiette zakatable, zakat due, et répartition farāʾiḍ "
            "des ayants droit."
        ),
        "people_label": "Ayants droit",
        "donor_label": "Assujettis / constituants",
        "mandate_label": "Mandats",
        "sections": {
            "finance": False,
            "patrimony": True,
            "investments": False,
            "people": True,
            "mandates": False,
            "waqf": False,
            "zakat": True,
            "faraid": True,
            "genealogy": False,
            "minors_focus": False,
        },
        "kpis": [
            "zakatable_wealth",
            "zakat_due",
            "heirs_count",
            "patrimony_total",
        ],
    },
}

DEFAULT_SERVICE_PROFILE = {
    "code": "",
    "report_name": "Rapport de gestion",
    "subtitle": "Synthèse du dossier pour la période.",
    "people_label": "Bénéficiaires",
    "donor_label": "Donateurs",
    "mandate_label": "Mandats",
    "sections": {
        "finance": True,
        "patrimony": True,
        "investments": False,
        "people": True,
        "mandates": True,
        "waqf": False,
        "zakat": False,
        "faraid": False,
        "genealogy": False,
        "minors_focus": False,
    },
    "kpis": ["patrimony_total", "liquidities", "period_net_flow", "beneficiaries_count"],
}


def get_service_report_profile(case_type: str | None) -> dict:
    if not case_type:
        return dict(DEFAULT_SERVICE_PROFILE)
    profile = SERVICE_REPORT_PROFILES.get(case_type)
    if not profile:
        return {**DEFAULT_SERVICE_PROFILE, "code": case_type}
    # Copie superficielle pour ne pas muter le catalogue
    return {
        **profile,
        "sections": dict(profile["sections"]),
        "kpis": list(profile["kpis"]),
    }


def section_enabled(profile: dict, section: str) -> bool:
    return bool((profile.get("sections") or {}).get(section))
