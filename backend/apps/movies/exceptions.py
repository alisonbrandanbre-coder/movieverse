"""Client-facing errors of the movies catalog (mapped to the uniform error envelope)."""

from apps.common.exceptions import ExternalServiceUnavailable, ServiceError


class MovieNotFound(ServiceError):
    status_code = 404
    default_code = "MOVIE_NOT_FOUND"
    default_detail = "La película no existe."


class CatalogUnavailable(ExternalServiceUnavailable):
    default_code = "TMDB_UNAVAILABLE"
    default_detail = (
        "El catálogo de películas no está disponible en este momento. Intentá nuevamente."
    )


class CatalogRateLimited(ExternalServiceUnavailable):
    default_code = "TMDB_RATE_LIMITED"
    default_detail = "Hay demasiadas consultas al catálogo. Esperá unos segundos y reintentá."
