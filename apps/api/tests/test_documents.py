import pytest
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import RoleAssignment, UserRole
from documents.models import Document, DocumentAccessAction, DocumentAccessLog

User = get_user_model()


@pytest.fixture
def api():
    return APIClient()


def auth(api: APIClient, user) -> None:
    api.credentials(HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(user).access_token}")


@pytest.fixture
def agent(db):
    user = User.objects.create_user(
        username="agent_doc",
        password="pw12345678",
        email="agent_doc@example.com",
    )
    RoleAssignment.objects.create(user=user, role=UserRole.AGENT_FIDUCIAIRE)
    return user


@pytest.mark.django_db
def test_upload_list_download_url_and_share(api, agent):
    auth(api, agent)
    case_id = api.post(
        reverse("case-list"),
        {"title": "Dossier documents"},
        format="json",
    ).json()["id"]

    upload = api.post(
        reverse("document-upload"),
        {
            "case_id": case_id,
            "category": "MANDATE",
            "title": "Mandat signé",
            "file": SimpleUploadedFile(
                "mandat.pdf",
                b"%PDF-1.4 test content",
                content_type="application/pdf",
            ),
        },
        format="multipart",
    )
    assert upload.status_code == 201, upload.content
    doc_id = upload.json()["id"]

    listed = api.get(reverse("case-document-list", kwargs={"case_pk": case_id}))
    assert listed.status_code == 200
    assert len(listed.json()) == 1

    case_detail = api.get(reverse("case-detail", kwargs={"pk": case_id}))
    assert case_detail.status_code == 200
    docs = case_detail.json()["documents"]
    assert len(docs) == 1
    assert docs[0]["title"] == "Mandat signé"
    assert docs[0]["category"] == "MANDATE"

    detail = api.get(reverse("document-detail", kwargs={"pk": doc_id}))
    assert detail.status_code == 200
    assert DocumentAccessLog.objects.filter(
        document_id=doc_id, action=DocumentAccessAction.VIEW
    ).exists()

    download = api.get(reverse("document-download-url", kwargs={"pk": doc_id}))
    assert download.status_code == 200
    assert "url" in download.json()
    assert download.json()["expires_in"] > 0
    assert DocumentAccessLog.objects.filter(
        document_id=doc_id, action=DocumentAccessAction.DOWNLOAD
    ).exists()

    preview = api.get(reverse("document-preview-url", kwargs={"pk": doc_id}))
    assert preview.status_code == 200
    assert "url" in preview.json()
    assert "inline=1" in preview.json()["url"]
    assert DocumentAccessLog.objects.filter(
        document_id=doc_id, action=DocumentAccessAction.VIEW
    ).exists()

    other = User.objects.create_user(
        username="notaire1",
        password="pw12345678",
        email="notaire1@example.com",
    )
    share = api.post(
        reverse("document-share", kwargs={"pk": doc_id}),
        {"shared_with_user_id": other.pk, "message": "Pour relecture"},
        format="json",
    )
    assert share.status_code == 201, share.content
    assert DocumentAccessLog.objects.filter(
        document_id=doc_id, action=DocumentAccessAction.SHARE
    ).exists()


@pytest.mark.django_db
def test_signed_download_with_token(api, agent):
    auth(api, agent)
    case_id = api.post(
        reverse("case-list"),
        {"title": "Download token"},
        format="json",
    ).json()["id"]
    doc_id = api.post(
        reverse("document-upload"),
        {
            "case_id": case_id,
            "category": "OTHER",
            "title": "Piece jointe",
            "file": SimpleUploadedFile("note.txt", b"hello", content_type="text/plain"),
        },
        format="multipart",
    ).json()["id"]

    url_response = api.get(reverse("document-download-url", kwargs={"pk": doc_id}))
    download_url = url_response.json()["url"]

    preview_response = api.get(reverse("document-preview-url", kwargs={"pk": doc_id}))
    preview_url = preview_response.json()["url"]
    assert "inline=1" in preview_url

    api.credentials()
    file_response = api.get(download_url)
    assert file_response.status_code == 200
    body = b"".join(file_response.streaming_content)
    assert body == b"hello"

    inline_response = api.get(preview_url)
    assert inline_response.status_code == 200
    assert inline_response.get("Content-Disposition", "").startswith("inline")
