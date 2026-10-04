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
GET  /preferences/options
```

Siempre del usuario autenticado (`request.user`); nunca se acepta un `user_id` (docs/RBAC.md). El perfil se crea vacío en el primer `GET` (`onboarding_completed: false`).

Lectura (`GET`, y respuesta de `PUT` / `POST onboarding`): los géneros vienen como objetos.

```json
{
  "preferred_genres": [{"id": 15, "name": "Ciencia ficción"}],
  "disliked_genres": [{"id": 11, "name": "Terror"}],
  "preferred_decades": [1990, 2000],
  "preferred_languages": ["en"],
  "discovery_level": "EXPLORER",
  "onboarding_completed": true,
  "updated_at": "2026-10-04T06:32:48Z"
}
```

Escritura (`PUT /preferences` reemplaza todo; `POST /preferences/onboarding` además marca `onboarding_completed` y acepta `ratings`): los géneros van como ids.

```json
{
  "preferred_genres": [15, 17],
  "disliked_genres": [11],
  "preferred_decades": [1990, 2000],
  "preferred_languages": ["en"],
  "discovery_level": "EXPLORER",
  "ratings": [{"movie_id": 1, "reaction": "LIKE"}, {"movie_id": 7, "reaction": "DISLIKE"}]
}
```

Validación (`400 VALIDATION_ERROR` con `details` por campo):

- `preferred_genres`: obligatorio, al menos 1, ids existentes. El resto es opcional (listas vacías, `discovery_level` = `BALANCED`).
- Un género no puede estar en `preferred_genres` y `disliked_genres` a la vez.
- `preferred_decades` ∈ `options.decades` (1950…2020); `preferred_languages` ∈ códigos ISO 639-1 de `options.languages`; `discovery_level` ∈ `FAMILIAR | BALANCED | EXPLORER`.
- `ratings`: hasta 30, `reaction` ∈ `LIKE | DISLIKE`, películas existentes (id local). Se guardan como interacciones; si una película se repite, gana la última.
- Los duplicados se descartan y las décadas se ordenan.

`GET /preferences/options` devuelve las opciones del wizard (el backend es la fuente de verdad): `{genres[{id,name}], decades[int], languages[{code,name}], discovery_levels[{value,label,description}]}`. Si el catálogo de géneros está vacío, lo carga de TMDB una vez.

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
GET /movies/onboarding-sample?genres=15,17&avoid=11
```

## Onboarding sample

Hasta 12 títulos conocidos (≥ 1000 votos, con póster) para la valoración rápida: primero los que comparten más géneros con `genres`, después los más votados; excluye los de géneros en `avoid` y los que el usuario ya valoró (LIKE/DISLIKE). Si en la base hay menos de 24 títulos conocidos, primero cachea los más votados de TMDB (`/discover/movie?sort_by=vote_count.desc`, 2 páginas); si TMDB falla, responde con lo local. No es una recomendación (eso es Sprint 3).

```json
{"results": [{"id": 1, "tmdb_id": 157336, "title": "Interstellar", "release_year": 2014, "poster_url": "...", "vote_average": 8.4}]}
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
GET    /movies/{id}/interactions
POST   /movies/{id}/interactions          {"type": "FAVORITE"}
DELETE /movies/{id}/interactions/{type}
GET    /me/favorites?page=
GET    /me/watchlist?page=
GET    /me/watched?page=
```

El usuario es siempre `request.user`; un `user_id` en el body se ignora.

`type` ∈ `FAVORITE | WATCHLIST | WATCHED | LIKE | DISLIKE | REMOVE_WATCHLIST`. `GET`, `POST` y `DELETE` responden el estado actual del usuario para esa película:

```json
{"movie_id": 1, "favorite": true, "watchlist": false, "watched": true, "reaction": "LIKE"}
```

Reglas:

- Idempotente: agregar dos veces no duplica (UNIQUE `user, movie, type`); quitar algo que no está no falla.
- `REMOVE_WATCHLIST` (POST) equivale a `DELETE …/interactions/WATCHLIST` y no se guarda. `DELETE` acepta el tipo en mayúsculas o minúsculas y sólo los 5 tipos de estado (si no, `400 INVALID_INTERACTION`).
- Se limpian las marcas contradictorias: LIKE ↔ DISLIKE; DISLIKE quita FAVORITE y WATCHLIST; FAVORITE y WATCHLIST quitan DISLIKE; WATCHED quita WATCHLIST.
- Película inexistente → `404 MOVIE_NOT_FOUND`. Tipo inválido → `400 VALIDATION_ERROR`.

Listas (24 por página, las más recientes primero): mismo formato que la búsqueda, más `added_at`.

```json
{"page": 1, "total_pages": 1, "total_results": 1,
 "results": [{"id": 1, "tmdb_id": 157336, "title": "Interstellar", "release_year": 2014,
              "poster_url": "...", "vote_average": 8.4, "added_at": "2026-10-04T06:33:10Z"}]}
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
