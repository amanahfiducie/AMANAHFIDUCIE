"""Catalogue des catégories comptables entreprise SOFIGEPAM."""

from cases.models import CaseType

# Recettes = 5 services métier (alignés sur CaseType)
REVENUE_SERVICE_CATEGORIES = [
    (
        "recette-mandat-fiduciaire",
        "Gestion fiduciaire du patrimoine",
        CaseType.MANDAT_FIDUCIAIRE,
        1,
    ),
    (
        "recette-tutelle-cantonnement",
        "Sécurisation des héritages des mineurs",
        CaseType.TUTELLE_CANTONNEMENT,
        2,
    ),
    (
        "recette-succession",
        "Conseil successoral islamique",
        CaseType.SUCCESSION,
        3,
    ),
    (
        "recette-waqf",
        "Waqf familial & productif",
        CaseType.WAQF,
        4,
    ),
    (
        "recette-zakat-faraid",
        "Zakat & structuration patrimoniale",
        CaseType.ZAKAT_FARAID,
        5,
    ),
]

EXPENSE_CATEGORIES = [
    ("depense-personnel", "Personnel & charges sociales", 10),
    ("depense-locaux", "Loyers & charges locatives", 20),
    ("depense-fournitures", "Fournitures & consommables", 30),
    ("depense-deplacements", "Déplacements & missions", 40),
    ("depense-prestataires", "Honoraires prestataires externes", 50),
    ("depense-telecom-it", "Télécoms & informatique", 60),
    ("depense-assurances", "Assurances", 70),
    ("depense-fiscalite", "Impôts & taxes", 80),
    ("depense-autres", "Autres dépenses", 90),
]

NEUTRAL_CATEGORIES = [
    ("virement-interne", "Virement interne", 100),
]

SERVICE_TYPE_LABELS = dict(CaseType.choices)
