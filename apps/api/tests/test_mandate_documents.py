import pytest
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import RoleAssignment, UserRole
from documents.models import Document
from mandates.models import Mandate

User = get_user_model()


@pytest.fixture
def api():
    return APIClient()


def auth(api: APIClient, user) -> None:
    api.credentials(HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(user).access_token}")


@pytest.fixture
def agent(db):
    user = User.objects.create_user(
        username="agent_mandate_doc",
        password="pw12345678",
        email="agent_mandate_doc@example.com",
    )
    RoleAssignment.objects.create(user=user, role=UserRole.AGENT_FIDUCIAIRE)
    return user


@pytest.mark.django_db
def test_mandate_document_upload(api, agent):
    auth(api, agent)
    case_id = api.post(
        reverse("case-list"),
        {"title": "Dossier mandats PDF"},
        format="json",
    ).json()["id"]
    mandate = Mandate.objects.create(
        case_id=case_id,
        mandate_type="FAMILY",
        title="Mandat de protection",
        reference_number="REF-2024",
        created_by_id=agent.pk,
    )

    upload = api.post(
        reverse("document-upload"),
        {
            "case_id": case_id,
            "mandate_id": mandate.pk,
            "file": SimpleUploadedFile(
                "acte.pdf",
                b"%PDF-1.4",
                content_type="application/pdf",
            ),
        },
        format="multipart",
    )
    assert upload.status_code == 201, upload.content
    data = upload.json()
    assert data["title"] == "MANDAT_FAMILY_Mandat_De_Protection_REF_2024"
    assert data["category"] == "MANDATE"

    doc = Document.objects.get(pk=data["id"])
    assert doc.mandate_id == mandate.pk
    assert doc.current_version.original_filename.endswith(".pdf")


@pytest.mark.django_db
def test_mandate_document_upload_without_mandate_id(api, agent):
    auth(api, agent)
    case_id = api.post(
        reverse("case-list"),
        {"title": "Dossier mandat noms"},
        format="json",
    ).json()["id"]

    upload = api.post(
        reverse("document-upload"),
        {
            "case_id": case_id,
            "mandate_type": "JUDICIAL",
            "mandate_title": "Décision tutelle",
            "mandate_reference_number": "J-99",
            "file": SimpleUploadedFile("decision.pdf", b"%PDF", content_type="application/pdf"),
        },
        format="multipart",
    )
    assert upload.status_code == 201, upload.content
    assert "MANDAT_JUDICIAL" in upload.json()["title"]
    assert "Decision_Tutelle" in upload.json()["title"] or "Décision" not in upload.json()["title"]
