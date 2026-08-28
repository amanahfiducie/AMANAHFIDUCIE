"""Parcours d'enregistrement d'un dossier — étapes selon le type."""

from __future__ import annotations

from dataclasses import dataclass

from beneficiaries.models import DonorTrustedPerson
from cases.models import CaseType, FiduciaryCase

STEP_STATUS_COMPLETED = "completed"
STEP_STATUS_SKIPPED = "skipped"
STEP_STATUS_PENDING = "pending"

# Étapes reportables — complétion ultérieure depuis le dossier ou la reprise d'enregistrement.
SKIPPABLE_STEP_IDS = frozenset(
    {
        "identification",
        "donor",
        "donor_trusted",
        "mandate",
        "beneficiaries",
        "patrimoine",
        "waqf_intention",
        "documents",
    }
)


@dataclass(frozen=True)
class OnboardingStepDef:
    id: str
    label: str
    description: str
    required: bool = True


CASE_TYPE_META: dict[str, dict] = {
    CaseType.TUTELLE_CANTONNEMENT: {
        "label": "Tutelle / cantonnement",
        "description": "Protection et gestion du patrimoine de mineurs ou héritiers sous tutelle.",
        "default_mandate_type": "JUDICIAL",
    },
    CaseType.MANDAT_FIDUCIAIRE: {
        "label": "Mandat fiduciaire",
        "description": "Mandat de gestion patrimoniale judiciaire, notarial, familial ou contractuel.",
        "default_mandate_type": "FAMILY",
    },
    CaseType.WAQF: {
        "label": "Waqf familial ou productif",
        "description": "Constitution et administration d'un waqf — capital préservé, revenus organisés.",
        "default_mandate_type": "WAQF",
    },
    CaseType.SUCCESSION: {
        "label": "Conseil successoral islamique",
        "description": (
            "Évaluation du patrimoine à partager, puis accompagnement au partage "
            "des héritages selon les parts successorales (farāʾiḍ) et les principes du Coran."
        ),
        "default_mandate_type": "FAMILY",
    },
    CaseType.ZAKAT_FARAID: {
        "label": "Zakat & farāʾiḍ",
        "description": "Calcul charaïque, inventaire patrimonial et recommandations de répartition.",
        "default_mandate_type": "FAMILY",
    },
}

COMMON_STEPS: tuple[OnboardingStepDef, ...] = (
    OnboardingStepDef(
        "identification",
        "Identification",
        "Référence, intitulé et contexte du dossier fiduciaire.",
    ),
    OnboardingStepDef(
        "donor",
        "Donateur",
        "Identité du donateur / constituant (nom, pièce, coordonnées).",
    ),
    OnboardingStepDef(
        "donor_trusted",
        "Personnes de confiance",
        "Proches ou mandataires de confiance du donateur (nom, téléphone, e-mail).",
    ),
    OnboardingStepDef(
        "mandate",
        "Mandat",
        "Acte ou décision autorisant la prise en charge (type, dates, autorité).",
    ),
)

STEP_BENEFICIARIES = OnboardingStepDef(
    "beneficiaries",
    "Héritiers / bénéficiaires",
    "Ajoutez chaque héritier et attribuez-lui un tuteur (nouveau ou déjà enregistré dans le dossier).",
)
STEP_PATRIMOINE = OnboardingStepDef(
    "patrimoine",
    "Patrimoine initial",
    "Inventaire des actifs : immobilier, financier, commercial ou agricole.",
)
STEP_WAQF = OnboardingStepDef(
    "waqf_intention",
    "Intention du waqf",
    "Finalité, bénéficiaires spirituels ou sociaux, règles souhaitées.",
)
STEP_DOCUMENTS = OnboardingStepDef(
    "documents",
    "Pièces justificatives",
    "Mandat, identité, titres de propriété, relevés bancaires (si disponibles).",
    required=False,
)
STEP_REVIEW = OnboardingStepDef(
    "review",
    "Synthèse & soumission",
    "Vérification puis envoi pour revue interne.",
)

STEP_SUCCESSION_HEIRS = OnboardingStepDef(
    "beneficiaries",
    "Arbre généalogique",
    "Construisez l'arbre en enregistrant chaque membre de la famille et ses liens (père, mère, conjoint, etc.).",
)
STEP_SUCCESSION_PATRIMOINE = OnboardingStepDef(
    "patrimoine",
    "Évaluation du patrimoine",
    "Estimez chaque bien séparément avec son justificatif PDF, puis déduisez dettes et charges.",
)

ONBOARDING_STEPS_BY_TYPE: dict[str, tuple[OnboardingStepDef, ...]] = {
    CaseType.TUTELLE_CANTONNEMENT: (
        *COMMON_STEPS,
        STEP_BENEFICIARIES,
        STEP_PATRIMOINE,
        STEP_DOCUMENTS,
        STEP_REVIEW,
    ),
    CaseType.MANDAT_FIDUCIAIRE: (
        *COMMON_STEPS,
        OnboardingStepDef(
            "beneficiaries",
            "Bénéficiaires",
            "Parties concernées par le mandat (si applicable).",
            required=False,
        ),
        STEP_PATRIMOINE,
        STEP_DOCUMENTS,
        STEP_REVIEW,
    ),
    CaseType.WAQF: (
        *COMMON_STEPS,
        STEP_WAQF,
        STEP_BENEFICIARIES,
        STEP_PATRIMOINE,
        STEP_DOCUMENTS,
        STEP_REVIEW,
    ),
    CaseType.SUCCESSION: (
        OnboardingStepDef(
            "identification",
            "Identification",
            "Référence, intitulé et contexte du dossier successoral.",
        ),
        OnboardingStepDef(
            "donor",
            "Le défunt (de cujus)",
            "Identité du défunt, pièces d'état civil et situation matrimoniale.",
        ),
        OnboardingStepDef(
            "donor_trusted",
            "Témoins",
            "Témoins de la succession (prénom, nom, coordonnées) — au moins un témoin.",
        ),
        OnboardingStepDef(
            "mandate",
            "Mandat / cadre juridique",
            "Acte notarié, certificat d'hérédité ou décision autorisant l'intervention.",
        ),
        STEP_SUCCESSION_HEIRS,
        STEP_SUCCESSION_PATRIMOINE,
        STEP_DOCUMENTS,
        STEP_REVIEW,
    ),
    CaseType.ZAKAT_FARAID: (
        *COMMON_STEPS,
        STEP_BENEFICIARIES,
        STEP_PATRIMOINE,
        STEP_DOCUMENTS,
        STEP_REVIEW,
    ),
}


def get_steps_for_type(case_type: str) -> tuple[OnboardingStepDef, ...]:
    return ONBOARDING_STEPS_BY_TYPE.get(
        case_type,
        ONBOARDING_STEPS_BY_TYPE[CaseType.MANDAT_FIDUCIAIRE],
    )


def get_onboarding_step_label(case_type: str, step_id: str) -> str | None:
    """Libellé français d'une étape d'enregistrement pour affichage liste / UI."""
    if step_id == "type":
        return "Type de dossier"
    for step in get_steps_for_type(case_type):
        if step.id == step_id:
            return step.label
    return None


def serialize_schema() -> dict:
    types = []
    for value, meta in CASE_TYPE_META.items():
        steps = get_steps_for_type(value)
        types.append(
            {
                "id": value,
                "label": meta["label"],
                "description": meta["description"],
                "default_mandate_type": meta["default_mandate_type"],
                "steps": [
                    {
                        "id": s.id,
                        "label": s.label,
                        "description": s.description,
                        "required": s.required,
                        "skippable": s.id in SKIPPABLE_STEP_IDS,
                    }
                    for s in steps
                ],
            }
        )
    return {"case_types": types}


def _onboarding_data(case: FiduciaryCase) -> dict:
    data = case.onboarding_data
    return data if isinstance(data, dict) else {}


def _completed_steps(case: FiduciaryCase) -> set[str]:
    raw = _onboarding_data(case).get("completed_steps", [])
    return set(raw) if isinstance(raw, list) else set()


def _skipped_steps(case: FiduciaryCase) -> set[str]:
    raw = _onboarding_data(case).get("skipped_steps", [])
    return set(raw) if isinstance(raw, list) else set()


def _step_data_satisfied(case: FiduciaryCase, step_id: str) -> bool:
    if step_id == "identification":
        return bool(case.title.strip())
    if step_id == "donor":
        return case.donors.exists()
    if step_id == "donor_trusted":
        return DonorTrustedPerson.objects.filter(donor__case=case).exists()
    if step_id == "mandate":
        return case.mandates.exists()
    if step_id == "beneficiaries":
        return case.beneficiaries.exists()
    if step_id == "patrimoine":
        return case.assets.exists()
    if step_id == "waqf_intention":
        data = _onboarding_data(case)
        legacy = data.get("waqf_intention", "")
        if isinstance(legacy, str) and len(legacy.strip()) >= 20:
            return True
        objet = data.get("waqf_object", "")
        rules = data.get("waqf_distribution_rules", "")
        return (
            isinstance(objet, str)
            and len(objet.strip()) >= 10
            and isinstance(rules, str)
            and len(rules.strip()) >= 10
        )
    if step_id == "documents":
        from documents.models import Document

        return Document.objects.filter(case=case, deleted_at__isnull=True).exists()
    if step_id == "review":
        return False
    return False


def get_step_status(case: FiduciaryCase, step_id: str) -> str:
    if _step_data_satisfied(case, step_id):
        return STEP_STATUS_COMPLETED
    if step_id in _skipped_steps(case):
        return STEP_STATUS_SKIPPED
    if step_id in _completed_steps(case):
        return STEP_STATUS_COMPLETED
    return STEP_STATUS_PENDING


def _build_pending_tasks(case: FiduciaryCase, steps: tuple[OnboardingStepDef, ...]) -> list[dict]:
    tasks: list[dict] = []
    for step in steps:
        if step.id == "review":
            continue
        status = get_step_status(case, step.id)
        if status == STEP_STATUS_SKIPPED or (
            step.required and status == STEP_STATUS_PENDING
        ):
            tasks.append(
                {
                    "id": step.id,
                    "label": step.label,
                    "status": status,
                    "required": step.required,
                }
            )
    return tasks


def get_onboarding_progress(case: FiduciaryCase) -> dict:
    steps = get_steps_for_type(case.case_type)
    step_status = []
    for step in steps:
        status = get_step_status(case, step.id)
        step_status.append(
            {
                "id": step.id,
                "label": step.label,
                "description": step.description,
                "required": step.required,
                "skippable": step.id in SKIPPABLE_STEP_IDS,
                "status": status,
                "completed": status == STEP_STATUS_COMPLETED,
                "skipped": status == STEP_STATUS_SKIPPED,
            }
        )

    pending_tasks = _build_pending_tasks(case, steps)

    submittable_steps = [s for s in steps if s.id != "review" and s.required]
    can_submit = case.status == "DRAFT" and all(
        get_step_status(case, s.id) != STEP_STATUS_PENDING for s in submittable_steps
    )

    all_fully_completed = all(
        get_step_status(case, s.id) == STEP_STATUS_COMPLETED
        for s in steps
        if s.id != "review"
    )
    completed = case.onboarding_completed_at is not None or (
        all_fully_completed and not pending_tasks
    )

    current = case.onboarding_step
    if not current or current == "type":
        for s in step_status:
            if s["status"] == STEP_STATUS_PENDING and s["required"]:
                current = s["id"]
                break
        else:
            current = "review"

    return {
        "case_type": case.case_type,
        "case_type_label": CASE_TYPE_META.get(case.case_type, {}).get("label", case.case_type),
        "current_step": current,
        "steps": step_status,
        "pending_tasks": pending_tasks,
        "completed": completed,
        "can_submit": can_submit,
        "onboarding_data": _onboarding_data(case),
    }


def validate_onboarding_complete(case: FiduciaryCase) -> list[str]:
    errors: list[str] = []
    steps = get_steps_for_type(case.case_type)
    for step in steps:
        if step.id == "review" or not step.required:
            continue
        if get_step_status(case, step.id) == STEP_STATUS_PENDING:
            errors.append(
                f"Étape obligatoire non traitée : {step.label}. "
                "Complétez-la ou reportez-la à plus tard."
            )
    return errors


def mark_step_skipped(case: FiduciaryCase, step_id: str) -> None:
    if step_id not in SKIPPABLE_STEP_IDS:
        raise ValueError(f"L'étape {step_id} ne peut pas être reportée.")
    data = dict(_onboarding_data(case))
    skipped = set(data.get("skipped_steps", []))
    skipped.add(step_id)
    data["skipped_steps"] = sorted(skipped)
    completed = set(data.get("completed_steps", []))
    completed.discard(step_id)
    data["completed_steps"] = sorted(completed)
    case.onboarding_data = data


def mark_step_advanced(case: FiduciaryCase, step_id: str) -> None:
    data = dict(_onboarding_data(case))
    skipped = set(data.get("skipped_steps", []))
    completed = set(data.get("completed_steps", []))
    if _step_data_satisfied(case, step_id) or step_id == "review":
        skipped.discard(step_id)
        completed.add(step_id)
    data["skipped_steps"] = sorted(skipped)
    data["completed_steps"] = sorted(completed)
    case.onboarding_data = data
