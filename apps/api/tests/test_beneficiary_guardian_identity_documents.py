import pytest
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import RoleAssignment, UserRole
from beneficiaries.models import Beneficiary, Guardian
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
        username="agent_ben_doc",
        password="pw12345678",
        email="agent_ben_doc@example.com",
    )
    RoleAssignment.objects.create(user=user, role=UserRole.AGENT_FIDUCIAIRE)
    return user


@pytest.mark.django_db
def test_beneficiary_identity_upload(api, agent):
    auth(api, agent)
    case_id = api.post(
        reverse("case-list"),
        {"title": "Dossier héritier pièces"},
        format="json",
    ).json()["id"]
    beneficiary = Beneficiary.objects.create(
        case_id=case_id,
        first_name="Awa",
        last_name="Ndiaye",
    )

    upload = api.post(
        reverse("document-upload"),
        {
            "case_id": case_id,
            "beneficiary_id": beneficiary.pk,
            "identity_kind": "CNI",
            "file": SimpleUploadedFile(
                "cni.pdf",
                b"%PDF-1.4",
                content_type="application/pdf",
            ),
        },
        format="multipart",
    )
    assert upload.status_code == 201, upload.content
    data = upload.json()
    assert data["title"] == "CNI_BEN_Awa_NDIAYE"

    doc = Document.objects.get(pk=data["id"])
    assert doc.beneficiary_id == beneficiary.pk
    assert doc.current_version.original_filename == "CNI_BEN_Awa_NDIAYE.pdf"


@pytest.mark.django_db
def test_guardian_identity_upload(api, agent):
    auth(api, agent)
    case_id = api.post(
        reverse("case-list"),
        {"title": "Dossier tuteur pièces"},
        format="json",
    ).json()["id"]
    guardian = Guardian.objects.create(
        case_id=case_id,
        first_name="Moussa",
        last_name="Fall",
    )

    upload = api.post(
        reverse("document-upload"),
        {
            "case_id": case_id,
            "guardian_id": guardian.pk,
            "identity_kind": "PASSPORT",
            "file": SimpleUploadedFile(
                "passeport.pdf",
                b"%PDF",
                content_type="application/pdf",
            ),
        },
        format="multipart",
    )
    assert upload.status_code == 201, upload.content
    assert upload.json()["title"] == "PASSPORT_TUT_Moussa_FALL"

    doc = Document.objects.get(pk=upload.json()["id"])
    assert doc.guardian_id == guardian.pk
