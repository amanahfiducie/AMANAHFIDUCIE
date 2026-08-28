"""Helpers partagés pour les tests API."""

from assets.models import Asset
from beneficiaries.models import CaseDonor, DonorTrustedPerson
from cases.models import FiduciaryCase
from django.urls import reverse
from mandates.models import Mandate


def complete_minimal_onboarding(api, agent, case_id: int) -> None:
    """Remplit le minimum pour soumettre un dossier MANDAT_FIDUCIAIRE."""
    case = FiduciaryCase.objects.get(pk=case_id)
    donor = case.donors.first()
    if donor is None:
        donor = CaseDonor.objects.create(
            case=case,
            first_name="Moussa",
            last_name="Diallo",
        )
    if not donor.trusted_persons.exists():
        DonorTrustedPerson.objects.create(
            donor=donor,
            first_name="Awa",
            last_name="Diallo",
            phone="+221771234567",
            email="awa@example.com",
        )
    if not case.mandates.exists():
        Mandate.objects.create(
            case=case,
            mandate_type="FAMILY",
            title="Mandat test",
            created_by=agent,
        )
    if not case.assets.exists():
        Asset.objects.create(
            case=case,
            asset_type="CASH",
            label="Liquidités",
            currency="XOF",
            created_by=agent,
        )
    for step in ("donor", "donor_trusted", "mandate", "patrimoine", "review"):
        api.post(
            reverse("case-complete-onboarding-step", kwargs={"pk": case_id}),
            {"step_id": step},
            format="json",
        )
