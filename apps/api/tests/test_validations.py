import pytest
from accounts.models import RoleAssignment, UserRole
from auditlog.models import AuditLog
from django.contrib.auth import get_user_model
from django.urls import reverse
from finance.models import FinancialMovement, MovementStatus, MovementType
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken
from validations.models import ValidationRequestStatus

User = get_user_model()


@pytest.fixture
def api():
    return APIClient()


def auth(api: APIClient, user) -> None:
    api.credentials(HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(user).access_token}")


@pytest.fixture
def agent(db):
    user = User.objects.create_user(
        username="agent_val",
        password="pw12345678",
        email="agent_val@example.com",
    )
    RoleAssignment.objects.create(user=user, role=UserRole.AGENT_FIDUCIAIRE)
    return user


@pytest.fixture
def direction_user(db):
    user = User.objects.create_user(
        username="direction_val",
        password="pw12345678",
        email="direction_val@example.com",
    )
    RoleAssignment.objects.create(user=user, role=UserRole.DIRECTION)
    return user


@pytest.fixture
def charia_user(db):
    user = User.objects.create_user(
        username="charia_val",
        password="pw12345678",
        email="charia_val@example.com",
    )
    RoleAssignment.objects.create(user=user, role=UserRole.COMITE_CHARAIQUE)
    return user


@pytest.fixture
def juridique_user(db):
    user = User.objects.create_user(
        username="juridique_val",
        password="pw12345678",
        email="juridique_val@example.com",
    )
    RoleAssignment.objects.create(user=user, role=UserRole.JURIDIQUE_CONFORMITE)
    return user


@pytest.fixture
def comptable_user(db):
    user = User.objects.create_user(
        username="comptable_val",
        password="pw12345678",
        email="comptable_val@example.com",
    )
    RoleAssignment.objects.create(user=user, role=UserRole.COMPTABLE_FIDUCIAIRE)
    return user


@pytest.mark.django_db
def test_movement_validation_queue_approve_and_audit(api, agent, comptable_user):
    auth(api, agent)
    case_id = api.post(
        reverse("case-list"),
        {"title": "Validation mouvement"},
        format="json",
    ).json()["id"]
    account_id = api.post(
        reverse("case-account-list", kwargs={"case_pk": case_id}),
        {"name": "Compte", "opening_balance": "500000.00"},
        format="json",
    ).json()["id"]
    movement_id = api.post(
        reverse("account-movement-list", kwargs={"account_pk": account_id}),
        {
            "movement_type": MovementType.INCOME,
            "amount": "100000.00",
            "movement_date": "2026-05-10",
            "reference": "VIR-VAL",
        },
        format="json",
    ).json()["id"]

    submit = api.post(
        reverse("movement-submit-validation", kwargs={"pk": movement_id}),
    )
    assert submit.status_code == 200
    assert submit.json()["status"] == MovementStatus.PENDING_VALIDATION

    auth(api, comptable_user)
    queue = api.get(reverse("validation-my-queue"))
    assert queue.status_code == 200
    assert len(queue.json()) == 1
    validation_id = queue.json()[0]["id"]
    assert queue.json()[0]["financial_movement"] == movement_id

    approve = api.post(
        reverse("validation-approve", kwargs={"pk": validation_id}),
        {"comment": "Conforme"},
        format="json",
    )
    assert approve.status_code == 200
    assert approve.json()["status"] == ValidationRequestStatus.APPROVED
    assert AuditLog.objects.filter(action="VALIDATION_APPROVED").exists()

    movement = FinancialMovement.objects.get(pk=movement_id)
    assert movement.status == MovementStatus.APPROVED

    summary = api.get(reverse("case-financial-summary", kwargs={"case_pk": case_id}))
    assert summary.json()["total_balance"] == "600000.00"


@pytest.mark.django_db
def test_validation_reject_and_request_changes(api, agent, comptable_user):
    auth(api, agent)
    case_id = api.post(
        reverse("case-list"),
        {"title": "Rejet validation"},
        format="json",
    ).json()["id"]
    account_id = api.post(
        reverse("case-account-list", kwargs={"case_pk": case_id}),
        {"name": "Compte"},
        format="json",
    ).json()["id"]
    movement_id = api.post(
        reverse("account-movement-list", kwargs={"account_pk": account_id}),
        {
            "movement_type": MovementType.EXPENSE,
            "amount": "50000.00",
            "movement_date": "2026-05-11",
        },
        format="json",
    ).json()["id"]
    api.post(reverse("movement-submit-validation", kwargs={"pk": movement_id}))

    auth(api, comptable_user)
    validation_id = api.get(reverse("validation-my-queue")).json()[0]["id"]

    reject = api.post(
        reverse("validation-reject", kwargs={"pk": validation_id}),
        {"comment": "Justificatif manquant"},
        format="json",
    )
    assert reject.status_code == 200
    assert reject.json()["status"] == ValidationRequestStatus.REJECTED
    assert FinancialMovement.objects.get(pk=movement_id).status == MovementStatus.REJECTED

    movement_id2 = api.post(
        reverse("account-movement-list", kwargs={"account_pk": account_id}),
        {
            "movement_type": MovementType.EXPENSE,
            "amount": "25000.00",
            "movement_date": "2026-05-12",
        },
        format="json",
    ).json()["id"]
    auth(api, agent)
    api.post(reverse("movement-submit-validation", kwargs={"pk": movement_id2}))
    auth(api, comptable_user)
    validation_id2 = api.get(reverse("validation-my-queue")).json()[0]["id"]
    changes = api.post(
        reverse("validation-request-changes", kwargs={"pk": validation_id2}),
        {"comment": "Corriger la référence"},
        format="json",
    )
    assert changes.status_code == 200
    assert changes.json()["status"] == ValidationRequestStatus.REQUEST_CHANGES
    assert FinancialMovement.objects.get(pk=movement_id2).status == MovementStatus.DRAFT


@pytest.mark.django_db
def test_create_validation_manually(api, agent):
    auth(api, agent)
    case_id = api.post(
        reverse("case-list"),
        {"title": "Validation manuelle"},
        format="json",
    ).json()["id"]
    created = api.post(
        reverse("validation-list"),
        {
            "case_id": case_id,
            "validation_type": "LEGAL",
            "subject_type": "OTHER",
            "title": "Revue mandat",
            "summary": "Contrôle juridique préalable",
        },
        format="json",
    )
    assert created.status_code == 201, created.content

    detail = api.get(reverse("validation-detail", kwargs={"pk": created.json()["id"]}))
    assert detail.status_code == 200
    assert len(detail.json()["steps"]) == 1
    assert detail.json()["steps"][0]["assigned_role"] == UserRole.JURIDIQUE_CONFORMITE


@pytest.mark.django_db
def test_case_review_validation_four_step_workflow(
    api, agent, direction_user, charia_user, juridique_user
):
    auth(api, agent)
    case_id = api.post(
        reverse("case-list"),
        {"title": "Circuit validation", "assigned_to": agent.pk},
        format="json",
    ).json()["id"]

    created = api.post(
        reverse("case-validation-list", kwargs={"case_pk": case_id}),
        {
            "title": "Ouverture mandat patrimonial",
            "summary": "Demande de validation du dossier avant activation.",
            "subject_type": "CASE",
        },
        format="json",
    )
    assert created.status_code == 201, created.content
    validation_id = created.json()["id"]
    assert len(created.json()["steps"]) == 4
    assert created.json()["steps"][0]["step_label"] == "Chargé du dossier"

    queue = api.get(reverse("validation-my-queue"))
    assert queue.status_code == 200
    assert len(queue.json()) == 1

    approve_agent = api.post(
        reverse("validation-approve", kwargs={"pk": validation_id}),
        {"comment": "Dossier complet, pièces conformes."},
        format="json",
    )
    assert approve_agent.status_code == 200
    assert approve_agent.json()["status"] == "IN_PROGRESS"
    assert approve_agent.json()["current_step"]["assigned_role"] == UserRole.DIRECTION

    auth(api, direction_user)
    assert len(api.get(reverse("validation-my-queue")).json()) == 1
    approve_dir = api.post(
        reverse("validation-approve", kwargs={"pk": validation_id}),
        {"comment": "Accord direction — alignement stratégique OK."},
        format="json",
    )
    assert approve_dir.status_code == 200
    assert approve_dir.json()["current_step"]["assigned_role"] == UserRole.COMITE_CHARAIQUE

    auth(api, charia_user)
    approve_charia = api.post(
        reverse("validation-approve", kwargs={"pk": validation_id}),
        {"comment": "Conforme aux principes charaïques."},
        format="json",
    )
    assert approve_charia.status_code == 200
    assert approve_charia.json()["current_step"]["assigned_role"] == UserRole.JURIDIQUE_CONFORMITE

    auth(api, juridique_user)
    approve_jur = api.post(
        reverse("validation-approve", kwargs={"pk": validation_id}),
        {"comment": "Avis juridique favorable."},
        format="json",
    )
    assert approve_jur.status_code == 200
    assert approve_jur.json()["status"] == "APPROVED"

    history = api.get(reverse("case-validation-list", kwargs={"case_pk": case_id}))
    assert history.status_code == 200
    assert history.json()[0]["status"] == "APPROVED"

    auth(api, agent)
    ok_without_obs = api.post(
        reverse("case-validation-list", kwargs={"case_pk": case_id}),
        {"title": "Test obs optionnelle", "summary": ""},
        format="json",
    )
    vid2 = ok_without_obs.json()["id"]
    approved_empty = api.post(
        reverse("validation-approve", kwargs={"pk": vid2}),
        {"comment": ""},
        format="json",
    )
    assert approved_empty.status_code == 200
    assert approved_empty.json()["status"] == "IN_PROGRESS"

@pytest.mark.django_db
def test_case_review_reject_returns_to_selected_role(
    api, agent, direction_user, charia_user
):
    auth(api, agent)
    case_id = api.post(
        reverse("case-list"),
        {"title": "Renvoi correction", "assigned_to": agent.pk},
        format="json",
    ).json()["id"]
    validation_id = api.post(
        reverse("case-validation-list", kwargs={"case_pk": case_id}),
        {
            "title": "Circuit à renvoyer",
            "summary": "Test renvoi",
            "subject_type": "CASE",
        },
        format="json",
    ).json()["id"]

    api.post(
        reverse("validation-approve", kwargs={"pk": validation_id}),
        {"comment": "OK chargé"},
        format="json",
    )
    auth(api, direction_user)
    api.post(
        reverse("validation-approve", kwargs={"pk": validation_id}),
        {"comment": "OK direction"},
        format="json",
    )

    auth(api, charia_user)
    # Sans destinataire → erreur
    missing = api.post(
        reverse("validation-reject", kwargs={"pk": validation_id}),
        {"comment": "Non conforme"},
        format="json",
    )
    assert missing.status_code == 400
    assert any(
        d.get("field") == "return_to_role" for d in missing.json().get("details", [])
    )

    rejected = api.post(
        reverse("validation-reject", kwargs={"pk": validation_id}),
        {
            "comment": "Corriger les pièces manquantes",
            "return_to_role": UserRole.AGENT_FIDUCIAIRE,
        },
        format="json",
    )
    assert rejected.status_code == 200, rejected.content
    body = rejected.json()
    assert body["status"] == "PENDING"
    assert body["current_step"]["assigned_role"] == UserRole.AGENT_FIDUCIAIRE

    auth(api, agent)
    queue = api.get(reverse("validation-my-queue"))
    assert any(v["id"] == validation_id for v in queue.json())

    retransmit = api.post(
        reverse("validation-approve", kwargs={"pk": validation_id}),
        {"comment": "Pièces complétées, retransmission."},
        format="json",
    )
    assert retransmit.status_code == 200
    assert retransmit.json()["current_step"]["assigned_role"] == UserRole.DIRECTION
