"""Production settings (Railway behind its HTTPS proxy). Every secret comes from the
environment; see docs/DEPLOYMENT.md for the variables."""

import os

from django.core.exceptions import ImproperlyConfigured

from .base import *  # noqa: F403
from .env import env_bool, env_int, env_list, env_str, parse_database_url

DEBUG = False  # never read from the environment here

if not SECRET_KEY or len(SECRET_KEY) < 32:  # noqa: F405
    raise ImproperlyConfigured("SECRET_KEY must be set (min 32 chars) in production")

# Required: no localhost fallback in production.
DATABASES = {"default": parse_database_url(env_str("DATABASE_URL"))}

# Railway exposes the service's public domain; it is always a valid host and origin.
RAILWAY_PUBLIC_DOMAIN = os.environ.get("RAILWAY_PUBLIC_DOMAIN", "").strip()

ALLOWED_HOSTS = env_list("ALLOWED_HOSTS")
if not ALLOWED_HOSTS:
    raise ImproperlyConfigured("ALLOWED_HOSTS must be set in production")
if RAILWAY_PUBLIC_DOMAIN:
    ALLOWED_HOSTS.append(RAILWAY_PUBLIC_DOMAIN)
# Railway's deploy healthcheck calls the service with this Host header.
ALLOWED_HOSTS.append("healthcheck.railway.app")

# Frontend origins (Vercel), comma separated. Empty until the frontend has a domain: then
# no cross-origin browser request is allowed.
CORS_ALLOWED_ORIGINS = env_list("CORS_ALLOWED_ORIGINS")
CSRF_TRUSTED_ORIGINS = env_list("CSRF_TRUSTED_ORIGINS")
if RAILWAY_PUBLIC_DOMAIN:  # the Django admin is served from the backend's own domain
    CSRF_TRUSTED_ORIGINS.append(f"https://{RAILWAY_PUBLIC_DOMAIN}")

# HTTPS: Railway terminates TLS and forwards X-Forwarded-Proto.
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_SSL_REDIRECT = env_bool("SECURE_SSL_REDIRECT", True)
# The healthcheck arrives over plain HTTP inside Railway's network: never redirect it.
SECURE_REDIRECT_EXEMPT = [r"^api/v1/health$"]
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = env_int("SECURE_HSTS_SECONDS", 60 * 60 * 24 * 30)
SECURE_HSTS_INCLUDE_SUBDOMAINS = True  # only the backend's own subdomains (there are none)
# HSTS preload is a decision for a custom domain, not for *.up.railway.app.
SILENCED_SYSTEM_CHECKS = ["security.W021"]
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"

# Static files (Django admin), collected by start.sh, compressed and with hashed names, served
# by WhiteNoise right after SecurityMiddleware (development uses runserver's own handler).
MIDDLEWARE = [*MIDDLEWARE]  # noqa: F405
MIDDLEWARE.insert(
    MIDDLEWARE.index("django.middleware.security.SecurityMiddleware") + 1,
    "whitenoise.middleware.WhiteNoiseMiddleware",
)
STORAGES = {
    **STORAGES,  # noqa: F405
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
}
