from unittest.mock import patch

import pytest
from django.db import DatabaseError


@pytest.mark.django_db
def test_health_returns_ok_with_database(api_client):
    response = api_client.get("/api/v1/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "ok"}


@pytest.mark.django_db
def test_health_returns_503_when_database_is_down(api_client):
    with patch("apps.common.views.connection.cursor", side_effect=DatabaseError("down")):
        response = api_client.get("/api/v1/health")

    assert response.status_code == 503
    assert response.json()["database"] == "unavailable"
