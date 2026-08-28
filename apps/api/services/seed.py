from decimal import Decimal

from cases.models import CaseType
from services.models import BillingFormula, BillingPeriodicity, ServiceBillingRule, ServiceOffer

# Politique Tarifaire Institutionnelle SOFIGEPAM v1.0
# (Conseil d'Administration / Comité Éthique et Conformité Charaïque)

M = Decimal("1000000")  # 1 million FCFA

SERVICE_SEED = [
    {
        "case_type": CaseType.TUTELLE_CANTONNEMENT,
        "name": "Gestion fiduciaire des patrimoines des mineurs",
        "description": (
            "Politique tarifaire §IV — administration fiduciaire des mineurs : "
            "honoraires annuels AUM par tranche et constitution de mandat "
            "(tutelle judiciaire / notarial)."
        ),
        "sort_order": 1,
        "rules": [
            {
                "formula": BillingFormula.MANAGEMENT_FEE_AUM,
                "label": "Honoraires annuels de gestion — jusqu'à 100 M FCFA",
                "description": "§IV.1 — 3,00 % des AUM (tranche ≤ 100 millions FCFA).",
                "rate_percent": Decimal("3.000"),
                "base_min": Decimal("0"),
                "base_max": 100 * M,
                "periodicity": BillingPeriodicity.ANNUAL,
                "sort_order": 1,
            },
            {
                "formula": BillingFormula.MANAGEMENT_FEE_AUM,
                "label": "Honoraires annuels de gestion — 100 à 500 M FCFA",
                "description": "§IV.1 — 2,50 % des AUM (tranche 100–500 millions FCFA).",
                "rate_percent": Decimal("2.500"),
                "base_min": 100 * M + Decimal("0.01"),
                "base_max": 500 * M,
                "periodicity": BillingPeriodicity.ANNUAL,
                "sort_order": 2,
            },
            {
                "formula": BillingFormula.MANAGEMENT_FEE_AUM,
                "label": "Honoraires annuels de gestion — 500 M à 1 Md FCFA",
                "description": "§IV.1 — 2,00 % des AUM (tranche 500 millions–1 milliard FCFA).",
                "rate_percent": Decimal("2.000"),
                "base_min": 500 * M + Decimal("0.01"),
                "base_max": 1000 * M,
                "periodicity": BillingPeriodicity.ANNUAL,
                "sort_order": 3,
            },
            {
                "formula": BillingFormula.MANAGEMENT_FEE_AUM,
                "label": "Honoraires annuels de gestion — plus de 1 Md FCFA",
                "description": "§IV.1 — 1,50 % des AUM (tranche > 1 milliard FCFA).",
                "rate_percent": Decimal("1.500"),
                "base_min": 1000 * M + Decimal("0.01"),
                "base_max": None,
                "periodicity": BillingPeriodicity.ANNUAL,
                "sort_order": 4,
            },
            {
                "formula": BillingFormula.OPENING_FEE,
                "label": "Constitution — tutelle judiciaire",
                "description": "§IV.2 — Honoraires de constitution du mandat (tutelle judiciaire).",
                "fixed_amount": Decimal("750000"),
                "fixed_amount_min": Decimal("500000"),
                "fixed_amount_max": Decimal("1000000"),
                "periodicity": BillingPeriodicity.ONCE,
                "sort_order": 5,
            },
            {
                "formula": BillingFormula.OPENING_FEE,
                "label": "Constitution — mandat notarial",
                "description": "§IV.2 — Honoraires de constitution du mandat notarial.",
                "fixed_amount": Decimal("1125000"),
                "fixed_amount_min": Decimal("750000"),
                "fixed_amount_max": Decimal("1500000"),
                "periodicity": BillingPeriodicity.ONCE,
                "sort_order": 6,
            },
            {
                "formula": BillingFormula.PERFORMANCE_FEE,
                "label": "Commission de performance",
                "description": (
                    "§VII — 10 % à 20 % des profits nets ; aucune commission "
                    "en cas de perte ou d'objectifs non atteints."
                ),
                "rate_percent": Decimal("15.000"),
                "rate_min_percent": Decimal("10.000"),
                "rate_max_percent": Decimal("20.000"),
                "periodicity": BillingPeriodicity.ON_PROFIT,
                "sort_order": 7,
            },
        ],
    },
    {
        "case_type": CaseType.MANDAT_FIDUCIAIRE,
        "name": "Family Office islamique & mandat fiduciaire",
        "description": (
            "Politique tarifaire §V / §IV — Family Office et gestion fiduciaire : "
            "honoraires AUM par tranche, constitution de mandat et performance."
        ),
        "sort_order": 2,
        "rules": [
            {
                "formula": BillingFormula.MANAGEMENT_FEE_AUM,
                "label": "Honoraires annuels de gestion — jusqu'à 100 M FCFA",
                "description": "§IV.1 — 3,00 % des AUM.",
                "rate_percent": Decimal("3.000"),
                "base_min": Decimal("0"),
                "base_max": 100 * M,
                "periodicity": BillingPeriodicity.ANNUAL,
                "sort_order": 1,
            },
            {
                "formula": BillingFormula.MANAGEMENT_FEE_AUM,
                "label": "Honoraires annuels de gestion — 100 à 500 M FCFA",
                "description": "§IV.1 — 2,50 % des AUM.",
                "rate_percent": Decimal("2.500"),
                "base_min": 100 * M + Decimal("0.01"),
                "base_max": 500 * M,
                "periodicity": BillingPeriodicity.ANNUAL,
                "sort_order": 2,
            },
            {
                "formula": BillingFormula.MANAGEMENT_FEE_AUM,
                "label": "Honoraires annuels de gestion — 500 M à 1 Md FCFA",
                "description": "§IV.1 — 2,00 % des AUM.",
                "rate_percent": Decimal("2.000"),
                "base_min": 500 * M + Decimal("0.01"),
                "base_max": 1000 * M,
                "periodicity": BillingPeriodicity.ANNUAL,
                "sort_order": 3,
            },
            {
                "formula": BillingFormula.MANAGEMENT_FEE_AUM,
                "label": "Honoraires annuels de gestion — plus de 1 Md FCFA",
                "description": "§IV.1 — 1,50 % des AUM.",
                "rate_percent": Decimal("1.500"),
                "base_min": 1000 * M + Decimal("0.01"),
                "base_max": None,
                "periodicity": BillingPeriodicity.ANNUAL,
                "sort_order": 4,
            },
            {
                "formula": BillingFormula.OPENING_FEE,
                "label": "Constitution — mandat notarial",
                "description": "§IV.2 — Honoraires de constitution du mandat notarial.",
                "fixed_amount": Decimal("1125000"),
                "fixed_amount_min": Decimal("750000"),
                "fixed_amount_max": Decimal("1500000"),
                "periodicity": BillingPeriodicity.ONCE,
                "sort_order": 5,
            },
            {
                "formula": BillingFormula.PERFORMANCE_FEE,
                "label": "Commission de performance",
                "description": "§VII — 10 % à 20 % des profits nets halal.",
                "rate_percent": Decimal("15.000"),
                "rate_min_percent": Decimal("10.000"),
                "rate_max_percent": Decimal("20.000"),
                "periodicity": BillingPeriodicity.ON_PROFIT,
                "sort_order": 6,
            },
        ],
    },
    {
        "case_type": CaseType.SUCCESSION,
        "name": "Conseil successoral islamique (Farāʾiḍ)",
        "description": (
            "Politique tarifaire §IX — diagnostic, calcul des parts, "
            "assistance notariale et structuration waqf successoral."
        ),
        "sort_order": 3,
        "rules": [
            {
                "formula": BillingFormula.MISSION_FEE,
                "label": "Diagnostic successoral",
                "description": "§IX.3 — Diagnostic successoral.",
                "fixed_amount": Decimal("300000"),
                "periodicity": BillingPeriodicity.ONCE,
                "sort_order": 1,
            },
            {
                "formula": BillingFormula.MISSION_FEE,
                "label": "Calcul des parts successorales",
                "description": "§IX.3 — Calcul des quotes-parts Farāʾiḍ.",
                "fixed_amount": Decimal("750000"),
                "fixed_amount_min": Decimal("500000"),
                "fixed_amount_max": Decimal("1000000"),
                "periodicity": BillingPeriodicity.ONCE,
                "sort_order": 2,
            },
            {
                "formula": BillingFormula.MISSION_FEE,
                "label": "Assistance notariale au partage",
                "description": "§IX.4 — Accompagnement du partage / assistance notariale.",
                "fixed_amount": Decimal("1500000"),
                "fixed_amount_min": Decimal("1000000"),
                "fixed_amount_max": Decimal("2000000"),
                "periodicity": BillingPeriodicity.ONCE,
                "sort_order": 3,
            },
            {
                "formula": BillingFormula.MISSION_FEE,
                "label": "Structuration d'un Waqf successoral",
                "description": "§IX.4 — Structuration d'un Waqf successoral.",
                "fixed_amount": Decimal("2250000"),
                "fixed_amount_min": Decimal("1500000"),
                "fixed_amount_max": Decimal("3000000"),
                "periodicity": BillingPeriodicity.ONCE,
                "sort_order": 4,
            },
        ],
    },
    {
        "case_type": CaseType.WAQF,
        "name": "Structuration et gouvernance des Waqf",
        "description": (
            "Politique tarifaire §X — faisabilité, création, gestion annuelle "
            "des actifs waqf (1,5 %–2,5 %) et reporting inclus."
        ),
        "sort_order": 4,
        "rules": [
            {
                "formula": BillingFormula.MISSION_FEE,
                "label": "Étude de faisabilité",
                "description": "§X.3 — Étude de faisabilité du Waqf.",
                "fixed_amount": Decimal("500000"),
                "periodicity": BillingPeriodicity.ONCE,
                "sort_order": 1,
            },
            {
                "formula": BillingFormula.OPENING_FEE,
                "label": "Création du Waqf",
                "description": "§X.3 / §IV.2 — Création et constitution du Waqf familial.",
                "fixed_amount": Decimal("1500000"),
                "fixed_amount_min": Decimal("1000000"),
                "fixed_amount_max": Decimal("2000000"),
                "periodicity": BillingPeriodicity.ONCE,
                "sort_order": 2,
            },
            {
                "formula": BillingFormula.MANAGEMENT_FEE_AUM,
                "label": "Gestion annuelle du Waqf",
                "description": "§X.3 — Gestion annuelle 1,5 % à 2,5 % des actifs (défaut 2 %).",
                "rate_percent": Decimal("2.000"),
                "rate_min_percent": Decimal("1.500"),
                "rate_max_percent": Decimal("2.500"),
                "periodicity": BillingPeriodicity.ANNUAL,
                "sort_order": 3,
            },
            {
                "formula": BillingFormula.PERFORMANCE_FEE,
                "label": "Commission — Fonds Waqf / immobilier locatif",
                "description": "§VII — 10 % des profits nets (Fonds Waqf / immobilier locatif).",
                "rate_percent": Decimal("10.000"),
                "rate_min_percent": Decimal("10.000"),
                "rate_max_percent": Decimal("10.000"),
                "periodicity": BillingPeriodicity.ON_PROFIT,
                "sort_order": 4,
            },
        ],
    },
    {
        "case_type": CaseType.ZAKAT_FARAID,
        "name": "Évaluation et gestion de la Zakat",
        "description": (
            "Politique tarifaire §VIII — évaluation Zakat personnes physiques "
            "et entreprises, rapport et certificat de conformité charaïque."
        ),
        "sort_order": 5,
        "rules": [
            {
                "formula": BillingFormula.MISSION_FEE,
                "label": "Zakat personnes physiques — jusqu'à 50 M FCFA",
                "description": "§VIII.3 — Honoraires d'évaluation (patrimoine ≤ 50 M).",
                "fixed_amount": Decimal("250000"),
                "base_min": Decimal("0"),
                "base_max": 50 * M,
                "periodicity": BillingPeriodicity.ONCE,
                "sort_order": 1,
            },
            {
                "formula": BillingFormula.MISSION_FEE,
                "label": "Zakat personnes physiques — 50 à 200 M FCFA",
                "description": "§VIII.3 — Honoraires d'évaluation (50–200 M).",
                "fixed_amount": Decimal("500000"),
                "base_min": 50 * M + Decimal("0.01"),
                "base_max": 200 * M,
                "periodicity": BillingPeriodicity.ONCE,
                "sort_order": 2,
            },
            {
                "formula": BillingFormula.MISSION_FEE,
                "label": "Zakat personnes physiques — plus de 200 M FCFA",
                "description": "§VIII.3 — Honoraires d'évaluation (> 200 M).",
                "fixed_amount": Decimal("875000"),
                "fixed_amount_min": Decimal("750000"),
                "fixed_amount_max": Decimal("1000000"),
                "base_min": 200 * M + Decimal("0.01"),
                "base_max": None,
                "periodicity": BillingPeriodicity.ONCE,
                "sort_order": 3,
            },
            {
                "formula": BillingFormula.MISSION_FEE,
                "label": "Zakat entreprises — PME",
                "description": "§VIII.4 — Évaluation Zakat PME.",
                "fixed_amount": Decimal("1000000"),
                "periodicity": BillingPeriodicity.ONCE,
                "sort_order": 4,
            },
            {
                "formula": BillingFormula.MISSION_FEE,
                "label": "Zakat entreprises — structurée",
                "description": "§VIII.4 — Évaluation Zakat entreprise structurée.",
                "fixed_amount": Decimal("2500000"),
                "fixed_amount_min": Decimal("2000000"),
                "fixed_amount_max": Decimal("3000000"),
                "periodicity": BillingPeriodicity.ONCE,
                "sort_order": 5,
            },
        ],
    },
]


def seed_service_catalog(*, reset_rules: bool = False) -> None:
    for item in SERVICE_SEED:
        offer, _ = ServiceOffer.objects.update_or_create(
            case_type=item["case_type"],
            defaults={
                "name": item["name"],
                "description": item["description"],
                "sort_order": item["sort_order"],
                "is_active": True,
            },
        )
        if reset_rules:
            # _raw_delete évite les cascades vers des tables pas encore migrées
            # (ex. BillingInvoiceLine ajoutée après le seed politique tarifaire).
            ServiceBillingRule.objects.filter(service_id=offer.pk)._raw_delete(
                using=ServiceBillingRule.objects.db
            )
        if offer.billing_rules.exists():
            continue
        for rule in item["rules"]:
            ServiceBillingRule.objects.create(
                service=offer,
                formula=rule["formula"],
                label=rule["label"],
                description=rule.get("description", ""),
                rate_percent=rule.get("rate_percent"),
                rate_min_percent=rule.get("rate_min_percent"),
                rate_max_percent=rule.get("rate_max_percent"),
                fixed_amount=rule.get("fixed_amount"),
                fixed_amount_min=rule.get("fixed_amount_min"),
                fixed_amount_max=rule.get("fixed_amount_max"),
                base_min=rule.get("base_min"),
                base_max=rule.get("base_max"),
                periodicity=rule["periodicity"],
                sort_order=rule.get("sort_order", 0),
                is_active=True,
                currency="XOF",
                notes="Politique Tarifaire Institutionnelle SOFIGEPAM v1.0",
            )
