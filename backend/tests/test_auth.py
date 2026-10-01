import pytest

from apps.accounts.models import User

from .conftest import DEFAULT_PASSWORD

REGISTER_URL = "/api/v1/auth/register"
LOGIN_URL = "/api/v1/auth/login"
REFRESH_URL = "/api/v1/auth/refresh"
LOGOUT_URL = "/api/v1/auth/logout"
ME_URL = "/api/v1/auth/me"

pytestmark = pytest.mark.django_db


def login(api_client, email="ana@example.com", password=DEFAULT_PASSWORD):
    return api_client.post(LOGIN_URL, {"email": email, "password": password}, format="json")


# ---------------------------------------------------------------- register


def test_register_creates_user(api_client):
    response = api_client.post(
        REGISTER_URL, {"email": "Nuevo@Example.com ", "password": DEFAULT_PASSWORD}, format="json"
    )

    assert response.status_code == 201
    body = response.json()
    assert body["email"] == "nuevo@example.com"
    assert set(body) == {"id", "email"}
    user = User.objects.get(email="nuevo@example.com")
    assert user.check_password(DEFAULT_PASSWORD)
    assert user.password != DEFAULT_PASSWORD


def test_register_rejects_duplicated_email_case_insensitive(api_client, user):
    response = api_client.post(
        REGISTER_URL, {"email": "ANA@example.com", "password": DEFAULT_PASSWORD}, format="json"
    )

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "EMAIL_ALREADY_REGISTERED"
    assert User.objects.count() == 1


@pytest.mark.parametrize(
    "payload",
    [
        {"email": "no-es-un-email", "password": DEFAULT_PASSWORD},
        {"email": "", "password": DEFAULT_PASSWORD},
        {"email": "a@example.com"},
        {"password": DEFAULT_PASSWORD},
    ],
)
def test_register_validates_email_and_required_fields(api_client, payload):
    response = api_client.post(REGISTER_URL, payload, format="json")

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"
    assert User.objects.count() == 0


@pytest.mark.parametrize("password", ["corta1", "12345678901", "password123"])
def test_register_rejects_weak_passwords(api_client, password):
    response = api_client.post(
        REGISTER_URL, {"email": "a@example.com", "password": password}, format="json"
    )

    assert response.status_code == 400
    assert "password" in response.json()["error"]["details"]
    assert User.objects.count() == 0


# ---------------------------------------------------------------- login


def test_login_returns_tokens_and_user(api_client, user):
    response = login(api_client, email="ANA@example.com")

    assert response.status_code == 200
    body = response.json()
    assert body["access"] and body["refresh"]
    assert body["user"] == {"id": user.id, "email": "ana@example.com"}


def test_login_with_wrong_password_returns_401(api_client, user):
    response = login(api_client, password="incorrecta-123")

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "AUTHENTICATION_FAILED"
    assert response.json()["error"]["message"] == "Email o contraseña incorrectos."
    assert "access" not in response.json()


def test_login_with_unknown_email_returns_401(api_client, db):
    response = login(api_client, email="nadie@example.com")

    assert response.status_code == 401


def test_login_inactive_user_returns_401(api_client, user):
    user.is_active = False
    user.save()

    assert login(api_client).status_code == 401


# ---------------------------------------------------------------- me / tokens


def test_me_returns_authenticated_user(api_client, user):
    access = login(api_client).json()["access"]
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")

    response = api_client.get(ME_URL)

    assert response.status_code == 200
    assert response.json() == {"id": user.id, "email": user.email}


def test_me_without_token_returns_401(api_client, db):
    response = api_client.get(ME_URL)

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "NOT_AUTHENTICATED"


def test_me_with_invalid_token_returns_401(api_client, db):
    api_client.credentials(HTTP_AUTHORIZATION="Bearer not-a-real-token")

    response = api_client.get(ME_URL)

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "TOKEN_INVALID"


def test_refresh_returns_new_access_token(api_client, user):
    refresh = login(api_client).json()["refresh"]

    response = api_client.post(REFRESH_URL, {"refresh": refresh}, format="json")

    assert response.status_code == 200
    assert response.json()["access"]


def test_logout_blacklists_refresh_token(api_client, user):
    tokens = login(api_client).json()
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")

    response = api_client.post(LOGOUT_URL, {"refresh": tokens["refresh"]}, format="json")
    assert response.status_code == 204

    reused = api_client.post(REFRESH_URL, {"refresh": tokens["refresh"]}, format="json")
    assert reused.status_code == 401


def test_logout_requires_authentication(api_client, db):
    response = api_client.post(LOGOUT_URL, {"refresh": "x"}, format="json")

    assert response.status_code == 401


def test_logout_with_invalid_refresh_returns_400(auth_client):
    response = auth_client.post(LOGOUT_URL, {"refresh": "invalid"}, format="json")

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "TOKEN_INVALID"


def test_user_model_str_and_superuser(db):
    admin = User.objects.create_superuser(email="Admin@Example.com", password=DEFAULT_PASSWORD)

    assert str(admin) == "admin@example.com"
    assert admin.is_staff and admin.is_superuser
