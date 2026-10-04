import pytest
from django.core.cache import cache
from rest_framework.test import APIClient

from apps.accounts.models import User

DEFAULT_PASSWORD = "Cinefilo-2026!"


@pytest.fixture(autouse=True)
def _block_network(monkeypatch):
    """Tests must never reach TMDB (or anything else) over the network."""

    def _blocked(*args, **kwargs):
        raise RuntimeError("Network access is disabled in tests; mock TMDBClient instead.")

    monkeypatch.setattr("requests.sessions.Session.send", _blocked)


@pytest.fixture(autouse=True)
def _clear_cache():
    """Throttle counters live in the cache; isolate them between tests."""
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def api_client() -> APIClient:
    return APIClient()


@pytest.fixture
def user(db) -> User:
    return User.objects.create_user(email="ana@example.com", password=DEFAULT_PASSWORD)


@pytest.fixture
def auth_client(api_client: APIClient, user: User) -> APIClient:
    api_client.force_authenticate(user=user)
    return api_client


@pytest.fixture
def other_user(db) -> User:
    return User.objects.create_user(email="bruno@example.com", password=DEFAULT_PASSWORD)


@pytest.fixture
def other_client(other_user: User) -> APIClient:
    """A second, independent session: used to prove users never see each other's data."""
    client = APIClient()
    client.force_authenticate(user=other_user)
    return client
