import pytest
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import RoleAssignment, UserRole
from beneficiaries.models import CaseDonor
from documents.models import Document

User = get_user_model()


@pytest.fixture
def api():
    return APIClient()


def auth(api: APIClient, user) -> None:
    api.credentials(HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(user).access_token}")


@pytest.fixture
def agent(db):
    user = User.objects.create_user(
        username="agent_donor_doc",
        password="pw12345678",
        email="agent_donor_doc@example.com",
    )
    RoleAssignment.objects.create(user=user, role=UserRole.AGENT_FIDUCIAIRE)
    return user


@pytest.mark.django_db
def test_donor_identity_upload_renames_file(api, agent):
    auth(api, agent)
    case_id = api.post(
        reverse("case-list"),
        {"title": "Dossier donateur pièces"},
        format="json",
    ).json()["id"]
    donor = CaseDonor.objects.create(
        case_id=case_id,
        first_name="Amadou",
        last_name="Diop",
    )

    upload = api.post(
        reverse("document-upload"),
        {
            "case_id": case_id,
            "donor_id": donor.pk,
            "identity_kind": "CNI",
            "file": SimpleUploadedFile(
                "cni_recto.pdf",
                b"%PDF-1.4",
                content_type="application/pdf",
            ),
        },
        format="multipart",
    )
    assert upload.status_code == 201, upload.content
    data = upload.json()
    assert data["title"] == "CNI_Amadou_DIOP"

    doc = Document.objects.get(pk=data["id"])
    assert doc.identity_kind == "CNI"
    assert doc.donor_id == donor.pk
    version = doc.current_version
    assert version.original_filename == "CNI_Amadou_DIOP.pdf"

    upload_en = api.post(
        reverse("document-upload"),
        {
            "case_id": case_id,
            "donor_id": donor.pk,
            "identity_kind": "EN",
            "file": SimpleUploadedFile(
                "extrait.pdf",
                b"%PDF",
                content_type="application/pdf",
            ),
        },
        format="multipart",
    )
    assert upload_en.status_code == 201, upload_en.content
    assert upload_en.json()["title"] == "EN_Amadou_DIOP"
    assert Document.objects.filter(case_id=case_id, donor=donor).count() == 2


@pytest.mark.django_db
def test_donor_identity_upload_without_donor_id_uses_names(api, agent):
    auth(api, agent)
    case_id = api.post(
        reverse("case-list"),
        {"title": "Dossier noms"},
        format="json",
    ).json()["id"]

    upload = api.post(
        reverse("document-upload"),
        {
            "case_id": case_id,
            "identity_kind": "EN",
            "donor_first_name": "Fatou",
            "donor_last_name": "Sarr",
            "file": SimpleUploadedFile("naiss.pdf", b"%PDF", content_type="application/pdf"),
        },
        format="multipart",
    )
    assert upload.status_code == 201, upload.content
    assert upload.json()["title"] == "EN_Fatou_SARR"
