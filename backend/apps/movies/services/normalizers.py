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
    collection = payload.get("belongs_to_collection")
    has_collection = isinstance(collection, dict) and isinstance(collection.get("id"), int)
    fields["collection_tmdb_id"] = collection["id"] if has_collection else None
    fields["collection_name"] = _text(collection.get("name"), 255) if has_collection else ""
    fields["keyword_ids"] = keyword_ids(payload)
    fields["origin_countries"] = origin_countries(payload)
    return fields


def origin_countries(payload: dict[str, Any]) -> list[str]:
    """`origin_country` (ISO codes) or, for older payloads, the production countries."""
    codes = payload.get("origin_country")
    if not isinstance(codes, list) or not codes:
        codes = [
            c.get("iso_3166_1")
            for c in payload.get("production_countries") or []
            if isinstance(c, dict)
        ]
    return list(dict.fromkeys(c.upper() for c in codes if isinstance(c, str) and len(c) == 2))


def _providers(items: Any) -> list[dict[str, Any]]:
    providers = [
        {
            "tmdb_id": p["provider_id"],
            "name": _text(p.get("provider_name"), 100),
            "logo_path": _text(p.get("logo_path"), 255),
            "priority": _number(p.get("display_priority"), int, 999),
        }
        for p in items or []
        if isinstance(p, dict) and isinstance(p.get("provider_id"), int) and p.get("provider_name")
    ]
    return sorted(providers, key=lambda p: p["priority"])


def normalize_movie_watch_providers(payload: dict[str, Any], region: str) -> dict[str, Any]:
    """A movie's `/watch/providers` for one region: {link, streaming, rent, buy}.
    Streaming joins subscription, free and with-ads offers (without duplicates)."""
    block = (payload.get("results") or {}).get(region)
    if not isinstance(block, dict):
        return {"link": "", "streaming": [], "rent": [], "buy": []}
    streaming: dict[int, dict[str, Any]] = {}
    for kind in ("flatrate", "free", "ads"):
        for provider in _providers(block.get(kind)):
            streaming.setdefault(provider["tmdb_id"], provider)
    return {
        "link": _text(block.get("link"), 500),
        "streaming": sorted(streaming.values(), key=lambda p: p["priority"]),
        "rent": _providers(block.get("rent")),
        "buy": _providers(block.get("buy")),
    }


def normalize_watch_providers(payload: dict[str, Any], region: str) -> list[dict[str, Any]]:
    """`/watch/providers/movie` → platforms of a region, by that region's priority."""
    providers = []
    for p in payload.get("results") or []:
        if not (isinstance(p, dict) and isinstance(p.get("provider_id"), int)):
            continue
        priorities = p.get("display_priorities")
        priority = priorities.get(region) if isinstance(priorities, dict) else None
        providers.append(
            {
                "tmdb_id": p["provider_id"],
                "name": _text(p.get("provider_name"), 100),
                "logo_path": _text(p.get("logo_path"), 255),
                "display_priority": _number(
                    priority if priority is not None else p.get("display_priority"), int, 999
                ),
            }
        )
    return sorted(
        (p for p in providers if p["name"]), key=lambda p: (p["display_priority"], p["name"])
    )


def keyword_ids(payload: dict[str, Any]) -> list[int]:
    """Details fetched with `append_to_response=keywords` carry `keywords: {keywords: [...]}`."""
    block = payload.get("keywords")
    items = block.get("keywords") if isinstance(block, dict) else None
    return sorted(
        {k["id"] for k in items or [] if isinstance(k, dict) and isinstance(k.get("id"), int)}
    )


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
