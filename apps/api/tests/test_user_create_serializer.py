import pytest
from accounts.serializers import UserCreateSerializer


@pytest.mark.django_db
def test_user_create_serializer_auto_username():
    s = UserCreateSerializer(
        data={
            "email": "agent@example.com",
            "password": "pw12345678",
            "phone": "+221771234567",
            "roles": ["AGENT_FIDUCIAIRE"],
        }
    )
    assert s.is_valid(), s.errors
    user = s.save()
    assert user.username.startswith("F")
    assert len(user.username) == 7
    assert user.profile.phone


@pytest.mark.django_db
def test_user_create_requires_phone():
    s = UserCreateSerializer(
        data={
            "email": "agent@example.com",
            "password": "pw12345678",
            "roles": ["AGENT_FIDUCIAIRE"],
        }
    )
    assert not s.is_valid()
    assert "phone" in s.errors
