"""Production settings (Railway): required variables, hosts/origins, HTTPS and static files.

Each case imports `config.settings.production` in a subprocess with a controlled
environment, so pytest's own settings are untouched. Variables set to "" are not filled in
from a local `.env` (python-dotenv never overrides an existing variable).
"""

import json
import os
import re
import secrets
import subprocess
import sys
from pathlib import Path

import pytest

from config.settings.env import parse_database_url

BACKEND_DIR = Path(__file__).resolve().parents[2]

PRODUCTION_ENV = {
    "DJANGO_SETTINGS_MODULE": "config.settings.production",
    "SECRET_KEY": secrets.token_urlsafe(50),
    "ALLOWED_HOSTS": "api.example.com",
    "DATABASE_URL": "postgresql://user:p%40ss@db.internal:5432/railway",
    "CORS_ALLOWED_ORIGINS": "https://movieverse.vercel.app",
    "CSRF_TRUSTED_ORIGINS": "https://movieverse.vercel.app",
    "RAILWAY_PUBLIC_DOMAIN": "",
    "DEBUG": "true",  # must be ignored
}

DUMP = """
import json
from django.conf import settings
import django
django.setup()
print(json.dumps({
    "DEBUG": settings.DEBUG,
    "ALLOWED_HOSTS": settings.ALLOWED_HOSTS,
    "CORS_ALLOWED_ORIGINS": settings.CORS_ALLOWED_ORIGINS,
    "CSRF_TRUSTED_ORIGINS": settings.CSRF_TRUSTED_ORIGINS,
    "DB": {k: settings.DATABASES["default"].get(k) for k in ("HOST", "NAME", "PASSWORD")},
    "SECURE_SSL_REDIRECT": settings.SECURE_SSL_REDIRECT,
    "SECURE_PROXY_SSL_HEADER": list(settings.SECURE_PROXY_SSL_HEADER),
    "SECURE_REDIRECT_EXEMPT": settings.SECURE_REDIRECT_EXEMPT,
    "SESSION_COOKIE_SECURE": settings.SESSION_COOKIE_SECURE,
    "CSRF_COOKIE_SECURE": settings.CSRF_COOKIE_SECURE,
    "STATICFILES": settings.STORAGES["staticfiles"]["BACKEND"],
    "MIDDLEWARE": settings.MIDDLEWARE,
}))
"""


def run(args: list[str], **overrides: str) -> subprocess.CompletedProcess:
    env = {**os.environ, **PRODUCTION_ENV, **overrides}
    return subprocess.run(
        [sys.executable, *args],
        cwd=BACKEND_DIR,
        env=env,
        capture_output=True,
        text=True,
        timeout=60,
    )


def production_settings(**overrides: str) -> dict:
    result = run(["-c", DUMP], **overrides)
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout.strip().splitlines()[-1])


def test_production_is_secure_and_reads_everything_from_the_environment():
    settings = production_settings()

    assert settings["DEBUG"] is False
    assert settings["ALLOWED_HOSTS"] == ["api.example.com", "healthcheck.railway.app"]
    assert settings["CORS_ALLOWED_ORIGINS"] == ["https://movieverse.vercel.app"]
    assert settings["CSRF_TRUSTED_ORIGINS"] == ["https://movieverse.vercel.app"]
    assert settings["DB"]["HOST"] == "db.internal"
    assert settings["DB"]["NAME"] == "railway"
    assert settings["DB"]["PASSWORD"] == "p@ss"
    assert settings["SECURE_SSL_REDIRECT"] is True
    assert settings["SECURE_PROXY_SSL_HEADER"] == ["HTTP_X_FORWARDED_PROTO", "https"]
    assert settings["SESSION_COOKIE_SECURE"] is True
    assert settings["CSRF_COOKIE_SECURE"] is True
    assert settings["STATICFILES"] == "whitenoise.storage.CompressedManifestStaticFilesStorage"
    assert "whitenoise.middleware.WhiteNoiseMiddleware" in settings["MIDDLEWARE"]


def test_the_healthcheck_is_never_redirected_to_https():
    exempt = production_settings()["SECURE_REDIRECT_EXEMPT"]
    assert any(re.search(pattern, "api/v1/health") for pattern in exempt)
    assert not any(re.search(pattern, "api/v1/movies/search") for pattern in exempt)


def test_railway_public_domain_is_a_host_and_a_trusted_origin():
    settings = production_settings(RAILWAY_PUBLIC_DOMAIN="movieverse-api.up.railway.app")

    assert "movieverse-api.up.railway.app" in settings["ALLOWED_HOSTS"]
    assert "https://movieverse-api.up.railway.app" in settings["CSRF_TRUSTED_ORIGINS"]


def test_without_frontend_origins_no_cross_origin_request_is_allowed():
    settings = production_settings(CORS_ALLOWED_ORIGINS="", CSRF_TRUSTED_ORIGINS="")

    assert settings["CORS_ALLOWED_ORIGINS"] == []  # no localhost fallback in production


@pytest.mark.parametrize(
    ("variable", "value", "message"),
    [
        ("SECRET_KEY", "", "SECRET_KEY must be set"),
        ("SECRET_KEY", "too-short", "SECRET_KEY must be set"),
        ("ALLOWED_HOSTS", "", "ALLOWED_HOSTS must be set"),
        ("DATABASE_URL", "", "Missing required environment variable: DATABASE_URL"),
    ],
)
def test_required_variables_fail_fast(variable, value, message):
    result = run(["-c", DUMP], **{variable: value})

    assert result.returncode != 0
    assert message in result.stderr


def test_django_deploy_checks_pass():
    # Only HSTS preload (W021) is silenced, on purpose; any other warning fails.
    result = run(["manage.py", "check", "--deploy", "--fail-level", "WARNING"])

    assert result.returncode == 0, result.stdout + result.stderr


def test_database_url_query_params_become_driver_options():
    config = parse_database_url(
        "postgresql://u:p@host.proxy.rlwy.net:41234/railway?sslmode=require"
    )

    assert config["OPTIONS"] == {"sslmode": "require"}
    assert config["PORT"] == "41234"
    assert "OPTIONS" not in parse_database_url("postgres://u:p@db:5432/movieverse")
