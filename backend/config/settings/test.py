"""Settings used by pytest. TMDB is always mocked: tests never hit the network."""

from .base import *  # noqa: F403

DEBUG = False
SECRET_KEY = "test-only-secret-key-with-enough-length-for-hs256"
TMDB_API_KEY = "test-tmdb-key"
TMDB_LANGUAGE = "en-US"

PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]

CACHES = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}

LOGGING = {"version": 1, "disable_existing_loggers": False, "root": {"level": "CRITICAL"}}
