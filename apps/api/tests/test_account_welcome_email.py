import pytest
from django.contrib.auth import get_user_model

from accounts.emails import _email_cases_access_block, send_case_profile_invite_email
from accounts.models import RoleAssignment, UserRole
from cases.models import CaseOrigin, CaseStakeholder, FiduciaryCase, StakeholderRole

User = get_user_model()


@pytest.mark.django_db
def test_cases_block_lists_stakeholder_dossiers():
    admin = User.objects.create_user("adm", "a@t.com", "pw12345678")
    RoleAssignment.objects.create(user=admin, role=UserRole.SUPER_ADMIN)
    case = FiduciaryCase.objects.create(
        reference="REF-2026-00001",
        title="Patrimoine Diallo",
        case_origin=CaseOrigin.NOTARY,
        created_by=admin,
        status="DRAFT",
    )
    ext = User.objects.create_user("T_moussa_ba_2", "m@t.com", "pw12345678")
    CaseStakeholder.objects.create(case=case, user=ext, role=StakeholderRole.FAMILY)

    html, text = _email_cases_access_block(
        user_id=ext.pk,
        highlight_reference="REF-2026-00001",
        extra_profile_type="guardian",
    )
    assert "REF-2026-00001" in html
    assert "Patrimoine Diallo" in html
    assert "Tuteur" in html
    assert "REF-2026-00001" in text


@pytest.mark.django_db
def test_send_case_invite_includes_credentials(monkeypatch):
    sent: dict = {}

    def capture(**kwargs):
        sent.update(kwargs)

    monkeypatch.setattr(
        "accounts.emails._send_simple_email",
        lambda **kw: sent.update({"subject": kw["subject"], "body": kw["text_body"]}),
    )
    send_case_profile_invite_email(
        user_id=1,
        to_email="user@example.com",
        display_name="Moussa Ba",
        case_reference="REF-1",
        case_title="Test",
        username="T_moussa_ba_1",
        profile_type="guardian",
        phone="+221771234567",
        temporary_password="Abcdef12!",
        added_to_existing_account=False,
    )
    assert sent["subject"]
    assert "T_moussa_ba_1" in sent["body"]
    assert "Abcdef12!" in sent["body"]
