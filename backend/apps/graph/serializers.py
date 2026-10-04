from rest_framework import serializers

from apps.movies.models import Movie
from apps.movies.services.images import poster_url

from .services import DEFAULT_LIMIT, MAX_LIMIT, Neighborhood

OVERVIEW_LENGTH = 280


class GraphQuerySerializer(serializers.Serializer):
    limit = serializers.IntegerField(min_value=1, max_value=MAX_LIMIT, default=DEFAULT_LIMIT)


def _short(text: str) -> str:
    text = text.strip()
    if len(text) <= OVERVIEW_LENGTH:
        return text
    return text[:OVERVIEW_LENGTH].rsplit(" ", 1)[0].rstrip(",.;:") + "…"


def node(movie: Movie) -> dict:
    return {
        "id": movie.pk,
        "tmdb_id": movie.tmdb_id,
        "title": movie.title,
        "poster": poster_url(movie.poster_path),
        "year": movie.release_year,
        "score": round(movie.vote_average, 1) if movie.vote_count else None,
        "overview": _short(movie.overview),
    }


def serialize_neighborhood(result: Neighborhood) -> dict:
    center = result.center
    return {
        "center": center.pk,
        "nodes": [node(center), *(node(c.movie) for c in result.connections)],
        "edges": [
            {
                "source": center.pk,
                "target": c.movie.pk,
                "type": c.primary_type,
                "types": [kind for kind, *_ in c.reasons()],
                "label": " · ".join(label for _, _, label, _ in c.reasons()),
                "reasons": [
                    {"type": kind, "label": label, "short": short}
                    for kind, _, label, short in c.reasons()
                ],
                "strength": round(c.strength, 2),
            }
            for c in result.connections
        ],
        "degraded": result.degraded,
        # The center's saga ("Ver saga completa (8)"); null when it has none.
        "saga": {"name": result.saga.name, "total": result.saga.total} if result.saga else None,
    }
