"""Pure functions that turn TMDB payloads into MovieVerse field dicts. No DB access."""

from dataclasses import dataclass
from datetime import date
from typing import Any

# Fields shared by TMDB search results and movie details.
SUMMARY_FIELDS = (
    "title",
    "original_title",
    "overview",
    "release_date",
    "original_language",
    "poster_path",
    "backdrop_path",
    "popularity",
    "vote_average",
    "vote_count",
)


@dataclass(frozen=True)
class PersonCredit:
    tmdb_id: int
    name: str
    profile_path: str
    character: str = ""
    order: int | None = None


@dataclass(frozen=True)
class NormalizedCredits:
    directors: list[PersonCredit]
    cast: list[PersonCredit]


def parse_date(value: Any) -> date | None:
    if not value or not isinstance(value, str):
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        return None


def _text(value: Any, max_length: int | None = None) -> str:
    text = value.strip() if isinstance(value, str) else ""
    return text[:max_length] if max_length else text


def _number(value: Any, cast=float, default=0):
    try:
        return cast(value) if value is not None else default
    except (TypeError, ValueError):
        return default


def normalize_movie(payload: dict[str, Any]) -> dict[str, Any]:
    """Summary fields present in both search results and details."""
    title = _text(payload.get("title"), 255) or _text(payload.get("original_title"), 255)
    return {
        "title": title or "Sin título",
        "original_title": _text(payload.get("original_title"), 255),
        "overview": _text(payload.get("overview")),
        "release_date": parse_date(payload.get("release_date")),
        "original_language": _text(payload.get("original_language"), 12),
        "poster_path": _text(payload.get("poster_path"), 255),
        "backdrop_path": _text(payload.get("backdrop_path"), 255),
        "popularity": _number(payload.get("popularity")),
        "vote_average": _number(payload.get("vote_average")),
        "vote_count": max(_number(payload.get("vote_count"), int), 0),
    }


def normalize_movie_details(payload: dict[str, Any]) -> dict[str, Any]:
    fields = normalize_movie(payload)
    runtime = _number(payload.get("runtime"), int, None)
    fields["runtime"] = runtime if runtime and 0 < runtime < 32767 else None
    return fields


def genre_tmdb_ids(payload: dict[str, Any]) -> list[int]:
    """Search results carry `genre_ids`; details carry `genres: [{id, name}]`."""
    if isinstance(payload.get("genres"), list):
        return [g["id"] for g in payload["genres"] if isinstance(g, dict) and "id" in g]
    return [gid for gid in payload.get("genre_ids") or [] if isinstance(gid, int)]


def normalize_genres(genres: list[dict[str, Any]]) -> dict[int, str]:
    return {
        g["id"]: _text(g.get("name"), 100)
        for g in genres
        if isinstance(g, dict) and isinstance(g.get("id"), int) and g.get("name")
    }


def normalize_credits(payload: dict[str, Any], cast_limit: int) -> NormalizedCredits:
    """Directors from crew (job == Director) and the top `cast_limit` actors, deduplicated."""
    directors: dict[int, PersonCredit] = {}
    for member in payload.get("crew") or []:
        if member.get("job") == "Director" and isinstance(member.get("id"), int):
            directors.setdefault(
                member["id"],
                PersonCredit(
                    tmdb_id=member["id"],
                    name=_text(member.get("name"), 255),
                    profile_path=_text(member.get("profile_path"), 255),
                ),
            )

    cast_members = [m for m in payload.get("cast") or [] if isinstance(m.get("id"), int)]
    cast_members.sort(key=lambda m: _number(m.get("order"), int, 9999))
    cast: dict[int, PersonCredit] = {}
    for member in cast_members:
        if len(cast) >= cast_limit:
            break
        cast.setdefault(
            member["id"],
            PersonCredit(
                tmdb_id=member["id"],
                name=_text(member.get("name"), 255),
                profile_path=_text(member.get("profile_path"), 255),
                character=_text(member.get("character"), 255),
                order=len(cast),
            ),
        )
    return NormalizedCredits(directors=list(directors.values()), cast=list(cast.values()))
