"""Helpers to read typed configuration from environment variables."""

import os
from urllib.parse import parse_qs, unquote, urlparse

from django.core.exceptions import ImproperlyConfigured


def env_str(name: str, default: str | None = None) -> str:
    value = os.environ.get(name)
    if value is None or value == "":
        if default is None:
            raise ImproperlyConfigured(f"Missing required environment variable: {name}")
        return default
    return value


def env_bool(name: str, default: bool = False) -> bool:
    value = os.environ.get(name)
    if value is None or value == "":
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def env_int(name: str, default: int) -> int:
    value = os.environ.get(name)
    if value is None or value == "":
        return default
    try:
        return int(value)
    except ValueError as exc:
        raise ImproperlyConfigured(f"{name} must be an integer") from exc


def env_list(name: str, default: str = "") -> list[str]:
    raw = os.environ.get(name) or default
    return [item.strip() for item in raw.split(",") if item.strip()]


def parse_database_url(url: str) -> dict:
    """Convert a `postgres://user:pass@host:port/name[?sslmode=require]` URL into Django
    DATABASES config. Query params (e.g. Railway's public URL `sslmode`) become driver options."""
    parsed = urlparse(url)
    if parsed.scheme not in {"postgres", "postgresql", "pgsql"}:
        raise ImproperlyConfigured("DATABASE_URL must use the postgres:// scheme")
    name = parsed.path.lstrip("/")
    if not name:
        raise ImproperlyConfigured("DATABASE_URL must include a database name")
    options = {key: values[-1] for key, values in parse_qs(parsed.query).items()}
    config = {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": unquote(name),
        "USER": unquote(parsed.username or ""),
        "PASSWORD": unquote(parsed.password or ""),
        "HOST": parsed.hostname or "",
        "PORT": str(parsed.port or ""),
        "CONN_MAX_AGE": 60,
        "CONN_HEALTH_CHECKS": True,  # drop connections the database closed while idle
    }
    if options:
        config["OPTIONS"] = options
    return config
