"""Local development settings."""

from .base import *  # noqa: F403
from .env import env_bool

DEBUG = env_bool("DEBUG", True)

if not SECRET_KEY:  # noqa: F405
    SECRET_KEY = "dev-only-insecure-secret-key"  # never used outside local development
