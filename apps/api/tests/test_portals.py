import pytest
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import RoleAssignment, UserRole
from cases.models import FiduciaryCase
from documents.models import Document, DocumentShare

User = get_user_model()


@pytest.fixture
def api():
    return APIClient()


def auth(api: APIClient, user) -> None:
    api.credentials(HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(user).access_token}")


@pytest.fixture
def agent(db):
    user = User.objects.create_user(
        username="agent_portal",
        password="pw12345678",
        email="agent_portal@example.com",
    )
    RoleAssignment.objects.create(user=user, role=UserRole.AGENT_FIDUCIAIRE)
    return user


@pytest.fixture
def family_user(db):
    user = User.objects.create_user(
        username="family_portal",
        password="pw12345678",
        email="family_portal@example.com",
    )
    RoleAssignment.objects.create(user=user, role=UserRole.FAMILLE_TUTEUR)
    return user


@pytest.fixture
def notary_user(db):
    user = User.objects.create_user(
        username="notary_portal",
        password="pw12345678",
        email="notary_portal@example.com",
    )
    RoleAssignment.objects.create(user=user, role=UserRole.NOTAIRE)
    return user


@pytest.mark.django_db
def test_family_portal_sees_only_shared_documents_and_own_cases(
    api, agent, family_user
):
    auth(api, agent)
    case_id = api.post(
        reverse("case-list"),
        {"title": "Dossier portail famille"},
        format="json",
    ).json()["id"]
    case = FiduciaryCase.objects.get(pk=case_id)
    case.stakeholders.create(user=family_user, role="FAMILY")

    doc_shared_id = api.post(
        reverse("document-upload"),
        {
            "case_id": case_id,
            "category": "REPORT",
            "title": "Rapport partagé",
            "file": SimpleUploadedFile("r.pdf", b"pdf", content_type="application/pdf"),
        },
        format="multipart",
    ).json()["id"]
    doc_hidden_id = api.post(
        reverse("document-upload"),
        {
            "case_id": case_id,
            "category": "OTHER",
            "title": "Interne",
            "file": SimpleUploadedFile("i.pdf", b"pdf", content_type="application/pdf"),
        },
        format="multipart",
    ).json()["id"]
    DocumentShare.objects.create(
        document_id=doc_shared_id,
        shared_by=agent,
        shared_with_user=family_user,
    )

    auth(api, family_user)
    listed = api.get(reverse("portal-case-list"))
    assert listed.status_code == 200
    assert len(listed.json()) == 1

    docs = api.get(reverse("portal-case-documents", kwargs={"case_pk": case_id}))
    assert docs.status_code == 200
    doc_ids = {d["id"] for d in docs.json()}
    assert doc_shared_id in doc_ids
    assert doc_hidden_id not in doc_ids

    agent_denied = api.get(reverse("case-list"))
    assert agent_denied.status_code == 200


@pytest.mark.django_db
def test_internal_user_cannot_access_portal(api, agent):
    auth(api, agent)
    response = api.get(reverse("portal-case-list"))
    assert response.status_code == 403


@pytest.mark.django_db
def test_notary_portal_case_access(api, agent, notary_user):
    auth(api, agent)
    case_id = api.post(
        reverse("case-list"),
        {"title": "Dossier notaire"},
        format="json",
    ).json()["id"]
    FiduciaryCase.objects.get(pk=case_id).stakeholders.create(
        user=notary_user, role="NOTARY"
    )

    auth(api, notary_user)
    detail = api.get(reverse("notaire-case-detail", kwargs={"case_pk": case_id}))
    assert detail.status_code == 200
    assert "mandates" in detail.json()
    assert "beneficiaries" not in detail.json()

    other = User.objects.create_user(
        username="other_notary",
        password="pw12345678",
        email="other_notary@example.com",
    )
    RoleAssignment.objects.create(user=other, role=UserRole.NOTAIRE)
    auth(api, other)
    denied = api.get(reverse("notaire-case-detail", kwargs={"case_pk": case_id}))
    assert denied.status_code == 403
