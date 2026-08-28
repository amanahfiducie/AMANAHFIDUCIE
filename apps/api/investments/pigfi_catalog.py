"""Catalogue PIGFI — Politique d'investissement AMANAH FIDUCIE."""

from cases.models import CaseType

ASSET_CLASSES = [
    (
        "immobilier",
        "Immobilier",
        "Immeubles locatifs, bureaux, entrepôts, foncier stratégique.",
        30,
        60,
        1,
    ),
    (
        "sukuk",
        "Sukuk",
        "Sukuk souverains et corporate investment grade.",
        20,
        40,
        2,
    ),
    (
        "actions-halal",
        "Actions conformes à la Charia",
        "Indices islamiques, ETF islamiques, sociétés conformes.",
        10,
        40,
        3,
    ),
    (
        "or",
        "Métaux précieux (Or)",
        "Or physique ou ETF adossés à l'or.",
        5,
        15,
        4,
    ),
    (
        "liquidites",
        "Liquidités",
        "Comptes islamiques et dépôts compatibles.",
        5,
        20,
        5,
    ),
    (
        "activites-revenus",
        "Activités génératrices de revenus",
        "Exploitations productives conformes (waqf, activités récurrentes).",
        10,
        30,
        6,
    ),
]

PATRIMONY_CATEGORIES = [
    {
        "code": "A",
        "label": "Patrimoines de mineurs",
        "objective": "Protection maximale du capital confié.",
        "target_yield_min": "4.00",
        "target_yield_max": "6.00",
        "allocation_targets": {
            "liquidites": 20,
            "sukuk": 40,
            "immobilier": 30,
            "or": 10,
        },
        "default_case_types": [CaseType.TUTELLE_CANTONNEMENT],
        "sort_order": 1,
    },
    {
        "code": "B",
        "label": "Patrimoines successoraux",
        "objective": "Conservation et génération de revenus.",
        "target_yield_min": "5.00",
        "target_yield_max": "8.00",
        "allocation_targets": {
            "immobilier": 40,
            "sukuk": 30,
            "actions-halal": 20,
            "liquidites": 10,
        },
        "default_case_types": [CaseType.SUCCESSION],
        "sort_order": 2,
    },
    {
        "code": "C",
        "label": "Patrimoines familiaux de long terme",
        "objective": "Croissance patrimoniale durable.",
        "target_yield_min": "6.00",
        "target_yield_max": "10.00",
        "allocation_targets": {
            "immobilier": 35,
            "actions-halal": 35,
            "sukuk": 20,
            "or": 5,
            "liquidites": 5,
        },
        "default_case_types": [CaseType.MANDAT_FIDUCIAIRE],
        "sort_order": 3,
    },
    {
        "code": "D",
        "label": "Patrimoines destinés à un Waqf",
        "objective": "Revenus pérennes pour la cause waqf.",
        "target_yield_min": "5.00",
        "target_yield_max": "7.00",
        "allocation_targets": {
            "immobilier": 50,
            "activites-revenus": 25,
            "sukuk": 15,
            "liquidites": 10,
        },
        "default_case_types": [CaseType.WAQF],
        "sort_order": 4,
    },
]

MANAGEMENT_PROFILES = [
    {
        "slug": "amanah-protection",
        "label": "AMANAH PROTECTION (Hifz)",
        "code_ar": "Hifz",
        "description": "Préservation du capital — rendement prudent.",
        "target_yield_min": "4.00",
        "target_yield_max": "5.00",
        "linked_category_code": "A",
        "sort_order": 1,
    },
    {
        "slug": "amanah-equilibre",
        "label": "AMANAH ÉQUILIBRE (Tanmiyah)",
        "code_ar": "Tanmiyah",
        "description": "Équilibre conservation / croissance.",
        "target_yield_min": "6.00",
        "target_yield_max": "8.00",
        "linked_category_code": "B",
        "sort_order": 2,
    },
    {
        "slug": "amanah-croissance",
        "label": "AMANAH CROISSANCE (Istithmār)",
        "code_ar": "Istithmār",
        "description": "Valorisation patrimoniale de long terme.",
        "target_yield_min": "8.00",
        "target_yield_max": "10.00",
        "linked_category_code": "C",
        "sort_order": 3,
    },
    {
        "slug": "amanah-waqf",
        "label": "AMANAH WAQF (Ta'bīd al-Manfa'ah)",
        "code_ar": "Ta'bīd al-Manfa'ah",
        "description": "Génération permanente de revenus pour le waqf.",
        "target_yield_min": "5.00",
        "target_yield_max": "7.00",
        "linked_category_code": "D",
        "sort_order": 4,
    },
]

INVESTMENT_ELIGIBLE_CASE_TYPES = {
    CaseType.MANDAT_FIDUCIAIRE,
    CaseType.TUTELLE_CANTONNEMENT,
}

DEFAULT_CATEGORY_BY_CASE_TYPE = {
    CaseType.TUTELLE_CANTONNEMENT: "A",
    CaseType.MANDAT_FIDUCIAIRE: "C",
    CaseType.SUCCESSION: "B",
    CaseType.WAQF: "D",
}

DEFAULT_PROFILE_BY_CASE_TYPE = {
    CaseType.TUTELLE_CANTONNEMENT: "amanah-protection",
    CaseType.MANDAT_FIDUCIAIRE: "amanah-croissance",
    CaseType.SUCCESSION: "amanah-equilibre",
    CaseType.WAQF: "amanah-waqf",
}
