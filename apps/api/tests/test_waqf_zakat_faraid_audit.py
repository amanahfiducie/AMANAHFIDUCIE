import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import RoleAssignment, UserRole
from auditlog.models import AuditLog
from cases.models import CaseType

User = get_user_model()


@pytest.fixture
def api():
    return APIClient()


def auth(api: APIClient, user) -> None:
    api.credentials(HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(user).access_token}")


@pytest.fixture
def agent(db):
    user = User.objects.create_user(
        username="agent_modules",
        password="pw12345678",
        email="agent_modules@example.com",
    )
    RoleAssignment.objects.create(user=user, role=UserRole.AGENT_FIDUCIAIRE)
    return user


@pytest.fixture
def auditeur(db):
    user = User.objects.create_user(
        username="auditeur_modules",
        password="pw12345678",
        email="auditeur_modules@example.com",
    )
    RoleAssignment.objects.create(user=user, role=UserRole.AUDITEUR)
    return user


def _create_case(api: APIClient, case_type: str) -> int:
    res = api.post(
        reverse("case-list"),
        {"title": f"Dossier {case_type}", "case_type": case_type},
        format="json",
    )
    assert res.status_code == 201, res.content
    return res.json()["id"]


@pytest.mark.django_db
def test_waqf_profile_get_and_patch(api, agent):
    auth(api, agent)
    case_id = _create_case(api, CaseType.WAQF)

    get_res = api.get(reverse("case-waqf", kwargs={"case_pk": case_id}))
    assert get_res.status_code == 200, get_res.content
    assert get_res.json()["waqf_type"] == "FAMILY"

    patch_res = api.patch(
        reverse("case-waqf", kwargs={"case_pk": case_id}),
        {
            "waqf_type": "PRODUCTIVE",
            "waqf_object": "Terrain agricole",
            "waqf_distribution_rules": "Revenus aux ayants droit",
        },
        format="json",
    )
    assert patch_res.status_code == 200, patch_res.content
    assert patch_res.json()["waqf_type"] == "PRODUCTIVE"
    assert patch_res.json()["waqf_object"] == "Terrain agricole"


@pytest.mark.django_db
def test_zakat_and_faraid(api, agent):
    auth(api, agent)
    case_id = _create_case(api, CaseType.ZAKAT_FARAID)

    zakat = api.post(
        reverse("case-zakat-list", kwargs={"case_pk": case_id}),
        {
            "assessment_year": 2026,
            "zakatable_wealth": "5000000.00",
            "zakat_due": "125000.00",
            "currency": "XOF",
        },
        format="json",
    )
    assert zakat.status_code == 201, zakat.content
    assert zakat.json()["assessment_year"] == 2026

    list_zakat = api.get(reverse("case-zakat-list", kwargs={"case_pk": case_id}))
    assert list_zakat.status_code == 200
    assert len(list_zakat.json()) == 1

    heir = api.post(
        reverse("case-faraid-list", kwargs={"case_pk": case_id}),
        {
            "full_name": "Amina Diallo",
            "relationship_label": "fille",
            "share_fraction": "0.5",
        },
        format="json",
    )
    assert heir.status_code == 201, heir.content
    assert heir.json()["full_name"] == "Amina Diallo"

    list_heirs = api.get(reverse("case-faraid-list", kwargs={"case_pk": case_id}))
    assert list_heirs.status_code == 200
    assert len(list_heirs.json()) == 1


@pytest.mark.django_db
def test_audit_logs_global_and_per_case(api, agent, auditeur):
    auth(api, agent)
    case_id = _create_case(api, CaseType.MANDAT_FIDUCIAIRE)
    AuditLog.objects.create(
        action="CASE_CREATED",
        entity_type="FiduciaryCase",
        entity_id=str(case_id),
        case_id=case_id,
        actor=agent,
        actor_role="AGENT_FIDUCIAIRE",
    )

    auth(api, auditeur)
    case_logs = api.get(reverse("case-audit-log-list", kwargs={"case_pk": case_id}))
    assert case_logs.status_code == 200, case_logs.content
    assert len(case_logs.json()) >= 1

    global_logs = api.get(reverse("audit-log-list"))
    assert global_logs.status_code == 200, global_logs.content
    assert any(entry["case"] == case_id for entry in global_logs.json())


@pytest.mark.django_db
def test_finance_overview_lists(api, agent):
    auth(api, agent)
    case_id = _create_case(api, CaseType.MANDAT_FIDUCIAIRE)
    account = api.post(
        reverse("case-account-list", kwargs={"case_pk": case_id}),
        {
            "name": "Compte audit",
            "account_number": "OV-1",
            "currency": "XOF",
            "opening_balance": "1000.00",
        },
        format="json",
    )
    assert account.status_code == 201
    account_id = account.json()["id"]

    movement = api.post(
        reverse("account-movement-list", kwargs={"account_pk": account_id}),
        {
            "movement_type": "INCOME",
            "amount": "100.00",
            "description": "Test",
            "movement_date": "2026-05-01",
        },
        format="json",
    )
    assert movement.status_code == 201

    accounts = api.get(reverse("finance-account-list"))
    assert accounts.status_code == 200
    assert len(accounts.json()) >= 1

    movements = api.get(reverse("finance-movement-list") + "?status=DRAFT")
    assert movements.status_code == 200
    assert any(m["case_id"] == case_id for m in movements.json())
