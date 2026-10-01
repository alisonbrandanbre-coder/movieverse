"""Production settings (Railway). Every secret comes from the environment."""

from django.core.exceptions import ImproperlyConfigured

from .base import *  # noqa: F403
from .env import env_bool, env_list

DEBUG = False

if not SECRET_KEY or len(SECRET_KEY) < 32:  # noqa: F405
    raise ImproperlyConfigured("SECRET_KEY must be set (min 32 chars) in production")

ALLOWED_HOSTS = env_list("ALLOWED_HOSTS")
if not ALLOWED_HOSTS:
    raise ImproperlyConfigured("ALLOWED_HOSTS must be set in production")

CSRF_TRUSTED_ORIGINS = env_list("CSRF_TRUSTED_ORIGINS")

SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_SSL_REDIRECT = env_bool("SECURE_SSL_REDIRECT", True)
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = 60 * 60 * 24 * 30
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"
