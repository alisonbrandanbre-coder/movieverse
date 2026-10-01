# API_GUIDELINES.md

Base:

`/api/v1`

# Auth

```text
POST /auth/register
POST /auth/login
POST /auth/refresh
POST /auth/logout
GET  /auth/me
```

# Preferences

```text
GET  /preferences
PUT  /preferences
POST /preferences/onboarding
```

Rutas sin barra final. `health`, `register`, `login` y `refresh` son públicas; el resto requiere `Authorization: Bearer <access>`.

# Health

```text
GET /health  →  {"status": "ok", "database": "ok"}   (503 si la DB no responde)
```

# Movies

```text
GET /movies/search?q=interstellar
GET /movies/{id}
GET /movies/{id}/credits
GET /movies/onboarding-sample   (Sprint 2)
```

`{id}` es siempre el id local de MovieVerse (no el de TMDB).

## Search

`q` obligatorio, 2–100 caracteres tras recortar espacios; `page` opcional (1–500).

```json
{
  "query": "interstellar",
  "page": 1,
  "total_pages": 1,
  "total_results": 2,
  "results": [
    {"id": 1, "tmdb_id": 157336, "title": "Interstellar", "release_year": 2014,
     "poster_url": "https://image.tmdb.org/t/p/w500/...", "vote_average": 8.4}
  ]
}
```

## Detail

```json
{
  "id": 1, "tmdb_id": 157336, "title": "Interstellar", "original_title": "Interstellar",
  "overview": "...", "release_date": "2014-11-05", "release_year": 2014, "runtime": 169,
  "original_language": "en", "poster_url": "...", "backdrop_url": "...",
  "popularity": 140.5, "vote_average": 8.4, "vote_count": 35000,
  "genres": [{"id": 1, "name": "Ciencia ficción"}]
}
```

## Credits

Directores y los 10 primeros actores.

```json
{
  "directors": [{"id": 10, "tmdb_id": 525, "name": "Christopher Nolan", "profile_url": "..."}],
  "cast": [{"id": 20, "tmdb_id": 10297, "name": "Matthew McConaughey", "profile_url": "...",
            "character": "Cooper", "order": 0}]
}
```

## Errores del catálogo

| HTTP | code | Cuándo |
|---|---|---|
| 400 | `VALIDATION_ERROR` | query vacía/corta/larga o `page` inválida |
| 404 | `MOVIE_NOT_FOUND` | id local inexistente |
| 503 | `TMDB_UNAVAILABLE` | timeout, error de red, 5xx o key inválida en TMDB |
| 503 | `TMDB_RATE_LIMITED` | TMDB respondió 429 |

# Recommendations

```text
GET  /recommendations
POST /recommendations/refresh
GET  /recommendations/surprise
```

# Graph

```text
GET /graph/movies/{id}
GET /graph/movies/{id}?limit=12
```

Respuesta:

```json
{
  "center": 1,
  "nodes": [
    {"id": 1, "title": "Interstellar"},
    {"id": 2, "title": "Inception"}
  ],
  "edges": [
    {
      "source": 1,
      "target": 2,
      "type": "DIRECTOR",
      "label": "Christopher Nolan"
    }
  ]
}
```

# Interactions

```text
POST /movies/{id}/interactions
GET  /me/favorites
GET  /me/watchlist
GET  /me/watched
```

# Error

```json
{
  "error": {
    "code": "INVALID_REQUEST",
    "message": "...",
    "details": {"campo": ["mensaje"]}
  }
}
```

`details` sólo aparece en errores de validación (`VALIDATION_ERROR`). Otros códigos: `NOT_AUTHENTICATED`, `AUTHENTICATION_FAILED`, `TOKEN_INVALID`, `EMAIL_ALREADY_REGISTERED` (409), `THROTTLED` (429), `NOT_FOUND`, `INTERNAL_ERROR` (500, nunca incluye traceback).
