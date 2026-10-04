"""Single place that turns TMDB image paths into URLs. Only paths are persisted."""

from django.conf import settings

POSTER_SIZE = "w500"
BACKDROP_SIZE = "w1280"
PROFILE_SIZE = "w185"
LOGO_SIZE = "w92"  # streaming platform logos


def build_image_url(path: str | None, size: str) -> str | None:
    if not path:
        return None
    return f"{settings.TMDB_IMAGE_BASE_URL.rstrip('/')}/{size}/{path.lstrip('/')}"


def poster_url(path: str | None) -> str | None:
    return build_image_url(path, POSTER_SIZE)


def backdrop_url(path: str | None) -> str | None:
    return build_image_url(path, BACKDROP_SIZE)


def profile_url(path: str | None) -> str | None:
    return build_image_url(path, PROFILE_SIZE)


def logo_url(path: str | None) -> str | None:
    return build_image_url(path, LOGO_SIZE)
