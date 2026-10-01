# Sprint 1 Report

Fecha: 2026-09-30

## Objetivo

Incorporar datos cinematográficos reales mediante TMDB: buscar → ver resultados → abrir detalle → ver información, director y reparto, persistiendo localmente las películas consultadas.

## Features implementadas

| # | Objetivo | Estado |
|---|---|---|
| 1.1 | Config TMDB sólo en backend (`TMDB_API_KEY`, `TMDB_LANGUAGE`, `TMDB_TIMEOUT_SECONDS`, `TMDB_CACHE_DAYS`) | ✅ |
| 1.2 | `TMDBClient`: `search_movies`, `get_movie_details`, `get_movie_credits`, `get_similar_movies` (preparado para el mapa), `get_genres` | ✅ |
| 1.3 | Errores: timeout, red, 401, 404, 429, 5xx, JSON inválido, key ausente → `TMDBUnavailable / TMDBAuthError / TMDBNotFound / TMDBRateLimited / TMDBNotConfigured` | ✅ |
| 1.4–1.7 | Modelos `Movie`, `Genre`, `Person`, `MoviePerson` | ✅ |
| 1.8 | Persistencia sin duplicados por `tmdb_id` (upsert en búsqueda, `get_or_create_from_tmdb`) | ✅ |
| 1.9 | `MovieService` (`search`, `get_or_create_from_tmdb`, `get_details`, `get_credits`, `sync_metadata`, `sync_credits`, `ensure_genre_catalog`); views finas | ✅ |
| 1.10 | `GET /api/v1/movies/search?q=&page=` | ✅ |
| 1.11 | `GET /api/v1/movies/{id}` | ✅ |
| 1.12 | `GET /api/v1/movies/{id}/credits` (directores + top 10) | ✅ |
| 1.13 | Sólo se guardan paths; URLs en `movies/services/images.py` (w500 / w1280 / w185) | ✅ |
| 1.14 | Cache en PostgreSQL con refresco a los `TMDB_CACHE_DAYS` (7) | ✅ |
| 1.15 | `/search` con input, botón + debounce 400 ms, loading, error, vacío, resultados, paginación | ✅ |
| 1.16 | `/movies/:id` con backdrop, póster, título, año, duración, géneros, rating, sinopsis, director, reparto; acciones ❤️ ➕ 👁 🌌 deshabilitadas "Próximamente" | ✅ |
| 1.17 | loading / success / empty / error en todas las llamadas | ✅ |
| 1.18 | Tipos TS (`types/movie.ts`) + DTOs y mappers snake→camel; 0 usos de `any` | ✅ |
| 1.19 | TanStack Query para search, detail y credits (sin `useEffect + fetch`) | ✅ |
| 1.20 | Tests backend con TMDB mockeado y red bloqueada | ✅ |
| 1.21 | Tests frontend: Search, MovieCard, Movie Detail, loading, sin resultados, error | ✅ |
| 1.22 | Datos listos para GraphService (Genre / Person / MoviePerson + índices) | ✅ |
| 1.23 | Datos listos para RecommendationService (popularity, votes, genres, language, release_date + índices) | ✅ |

## Modelos creados

- **Genre**: `tmdb_id` UNIQUE, `name`.
- **Person**: `tmdb_id` UNIQUE, `name`, `profile_path`.
- **Movie**: todos los campos pedidos + `genres` (M2M), `people` (M2M through MoviePerson), `metadata_synced_at`, `credits_synced_at`. `tmdb_id` UNIQUE. Índices en `popularity`, `release_date`, `original_language`.
- **MoviePerson**: `movie`, `person`, `role_type` (`ACTOR`/`DIRECTOR`), `character`, `credit_order`. UNIQUE(movie, person, role_type); índices (person, role_type) y (movie, role_type, credit_order).

Migración `movies/0001_initial` aplicada desde base vacía (volumen Docker recreado con `docker compose down -v`).

## Endpoints

| Método | Ruta | Respuesta |
|---|---|---|
| GET | `/api/v1/movies/search?q=&page=` | `{query, page, total_pages, total_results, results[{id, tmdb_id, title, release_year, poster_url, vote_average}]}` |
| GET | `/api/v1/movies/{id}` | detalle completo con `genres[{id, name}]` |
| GET | `/api/v1/movies/{id}/credits` | `{directors[{id, tmdb_id, name, profile_url}], cast[{…, character, order}]}` |

Todos requieren JWT y usan throttling `tmdb` (60/min por usuario) para proteger la cuota de TMDB. Validación: `q` 2–100 caracteres tras `trim` (vacío o sólo espacios → 400); `page` 1–500; ids fuera de rango → 404.

## Integración TMDB

- Único punto de contacto: `apps/movies/services/tmdb_client.py`. Ninguna view importa `requests`.
- Acepta **API Key v3** (`?api_key=`) o **Read Access Token v4** (`Authorization: Bearer`), detectado automáticamente.
- Timeout configurable (5 s). Toda falla se traduce a excepciones propias; `MovieService` las convierte en errores de API `TMDB_UNAVAILABLE` / `TMDB_RATE_LIMITED` (503) o `MOVIE_NOT_FOUND` (404). Nunca llega un traceback al cliente.
- Verificado contra la API real de TMDB con una key inválida: TMDB respondió 401 y se tradujo a `TMDBAuthError` (confirma conectividad y manejo del error).
- **Verificado con key válida (v3)** contra TMDB real el 2026-09-30: ver "Verificación con TMDB real".

## Verificación con TMDB real

Contra el backend en Docker con `TMDB_API_KEY` válida:

- `GET /movies/search?q=interstellar` → 200, 27 resultados; primero *Interstellar* (2014, 8.5, con póster).
- `GET /movies/1` → *Interstellar*, 2014-11-05, 169 min, `en`, 41.329 votos; géneros Aventura / Ciencia ficción / Drama; sinopsis en español.
- `GET /movies/1/credits` → director **Christopher Nolan**; 10 actores (Matthew McConaughey – Cooper, Anne Hathaway – Brand, Michael Caine, Jessica Chastain…).
- Segunda búsqueda (*El padrino*) → resultados correctos.
- Póster servido por `image.tmdb.org` → 200 `image/jpeg`.
- Repetir búsqueda, detalle y créditos: `Movie` sigue en 40 filas, *Interstellar* existe una sola vez, 16 créditos, y `metadata_synced_at` no cambia (respondió desde el cache, sin volver a TMDB).
- La key no aparece en ninguna respuesta de la API.

## Persistencia

Política de cache (documentada también en `ARCHITECTURE.md`):

1. **Búsqueda**: siempre consulta TMDB (los resultados dependen del texto), y hace upsert en bloque: crea las películas nuevas (`bulk_create(ignore_conflicts=True)`) y refresca `popularity / vote_average / vote_count` de las existentes. Vincula géneros usando el catálogo de géneros, que se carga una sola vez.
2. **Detalle**: si `metadata_synced_at` es nulo o tiene más de `TMDB_CACHE_DAYS` días → pide detalle (runtime, géneros) y actualiza. Si no, responde desde PostgreSQL sin llamar a TMDB.
3. **Créditos**: igual con `credits_synced_at`; al sincronizar reemplaza las filas `MoviePerson` de la película en una transacción y reutiliza `Person` existentes.
4. **Degradación**: si TMDB falla al refrescar, se sirve lo cacheado. Sin cache previa → 503 controlado.
5. **Sin duplicados**: `tmdb_id` UNIQUE en las tres tablas + manejo de `IntegrityError` en creaciones concurrentes.

## Frontend

- `features/movies/api.ts` (DTOs + mappers), `hooks.ts` (`useMovieSearch`, `useMovie`, `useMovieCredits`).
- Componentes: `MovieCard`, `MovieGrid`, `PosterImage` (fallback sin imagen / error de carga), `SearchResults`, `MovieHero`, `MovieCreditsSection`, `MovieActions`.
- La búsqueda vive en la URL (`/search?q=interstellar&page=2`): al volver desde un detalle, los resultados siguen ahí (cacheados por TanStack Query).
- Si fallan sólo los créditos, el detalle se sigue mostrando con un error local y botón "Reintentar".
- El frontend sólo habla con `VITE_API_URL`; `grep` sobre `src/` y `dist/` no encuentra `api.themoviedb` ni `api_key`.

## Tests

Ejecutados realmente:

```text
backend$ ruff check .                          → All checks passed!
backend$ ruff format --check .                 → 62 files already formatted
backend$ python manage.py makemigrations --check → No changes detected
backend$ pytest                                → 90 passed (23 Sprint 0 + 67 Sprint 1)
frontend$ npm run lint                         → OK (0 warnings)
frontend$ npm run test                         → 24 passed (10 Sprint 0 + 14 Sprint 1)
frontend$ npm run build                        → ✓ built
```

Backend Sprint 1:
- Modelos: defaults, `release_year`, unicidad de `tmdb_id` en Movie/Genre/Person, M2M géneros, roles de MoviePerson, unicidad por rol, cascada.
- TMDBClient (con `requests.Session` mockeada): parámetros, v3 vs v4, paths, key ausente, timeout, error de red, 401/404/429/500/503, `Retry-After`, JSON inválido.
- Search: query válida, `trim`, vacía / sólo espacios / 1 carácter / >100, página inválida, sin resultados, timeout/401/429 de TMDB → 503, falla del catálogo de géneros no rompe la búsqueda, requiere auth, **dos búsquedas no duplican** (`Movie.objects.count()` estable).
- Detail: sincroniza en primer acceso, usa cache fresca, refresca cache vencida, sirve cache si TMDB cae, película inexistente → 404, id fuera de rango, id no numérico, requiere auth.
- Credits: directores + top 10, persistencia (15 actores, dedupe, productores ignorados), cache, re-sync sin duplicar personas, 503 sin cache, cache vencida + TMDB caído → sirve cache, 404.
- Servicio / normalizadores / imágenes: `get_or_create_from_tmdb` una sola vez, reutiliza lo guardado por la búsqueda, 404 y 503 de TMDB, `sync_metadata` actualiza géneros, fechas inválidas, campos nulos, runtime 0, orden y límite del reparto, URLs de imágenes.

Un fixture `autouse` reemplaza `requests.Session.send` por una función que lanza error: **ningún test puede salir a internet**.

Frontend Sprint 1: MovieCard (datos + fallbacks), Search (estado inicial, debounce con una sola request, loading, sin resultados, error + reintento), Movie Detail (información completa + director + reparto, acciones deshabilitadas, loading, 404, error, falla parcial de créditos, id no numérico).

## Decisiones técnicas

1. **La búsqueda persiste resultados** para que cada card enlace a un id local (`/movies/{id}`) como pide el contrato; el detalle completo se trae bajo demanda.
2. **Cache por timestamps en la fila** (`metadata_synced_at`, `credits_synced_at`) en vez de una tabla de cache aparte: simple y suficiente para el MVP.
3. **Se guardan 15 actores y se devuelven 10**: el grafo podrá usar "actores principales" (`credit_order`) sin volver a pedir créditos.
4. **Idioma por defecto `es-ES`** (UI en español). Algunas sinopsis pueden venir vacías si TMDB no tiene traducción; la UI muestra "Sin sinopsis disponible". Configurable con `TMDB_LANGUAGE`.
5. **Búsqueda sin fallback local** cuando TMDB cae: devuelve 503 explícito en lugar de resultados parciales que podrían confundir.
6. **Errores 401 de TMDB → 503** al cliente (es un problema de configuración del servidor, no del usuario) y se loguean como `ERROR`.
7. **`/search` como página propia** (listada en `SCREENS.md`); Discover enlaza a ella.

## Problemas encontrados

- Al principio no había `TMDB_API_KEY` en el entorno; después se agregó y se verificó contra TMDB real. Nota: `docker compose restart` no recarga `.env`; hace falta `docker compose up -d --force-recreate backend`.
- La vista de búsqueda pasaba `q=` al servicio cuyo parámetro es `query` → 500 detectado por los tests y corregido.
- No hay navegador disponible en esta sesión: la UI se verificó con Testing Library, `tsc` y el build, no visualmente.

## Deuda técnica

- La búsqueda no tiene cache propia: cada búsqueda distinta consulta TMDB (mitigado por throttling y por el cache de TanStack Query en el cliente).
- El catálogo de géneros se carga una sola vez y no se refresca (los géneros de TMDB casi no cambian).
- Nombres de géneros dependen de `TMDB_LANGUAGE`; si se cambia el idioma, se actualizan en el próximo `sync_metadata`.
- Sin paginación en créditos (no hace falta: top 10).
- Tokens en `localStorage` (heredado de Sprint 0).

## Preparación para Sprint 2

- `Movie`, `Genre` y la carga del catálogo de géneros permiten construir el onboarding (géneros favoritos / a evitar, décadas, idiomas) y `GET /movies/onboarding-sample`.
- `MovieService.get_or_create_from_tmdb` es el punto de entrada para que `interactions` (favoritas, pendientes, vistas) referencie películas por id local.
- `MovieActions` ya muestra los botones que Sprint 2 debe activar.
- `get_similar_movies` + `MoviePerson (person, role_type)` dejan listo el insumo del GraphService (Sprint 4).

SPRINT_1_STATUS: COMPLETED
