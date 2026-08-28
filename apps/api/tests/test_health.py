import pytest
from django.urls import reverse
from rest_framework.test import APIClient


@pytest.fixture
def api_client():
    return APIClient()


@pytest.mark.django_db
def test_api_root_lists_links(api_client):
    response = api_client.get(reverse("api-root"))
    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "SOFIGEPAM Connect API"
    assert "health" in body["links"]
    assert "swagger" in body["links"]


@pytest.mark.django_db
def test_health_ok(api_client):
    url = reverse("health")
    response = api_client.get(url)
    assert response.status_code == 200
    assert response.json() == {"status": "OK"}
