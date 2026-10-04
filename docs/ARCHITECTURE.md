# ARCHITECTURE.md

# Arquitectura general

```text
React + TypeScript
        ↓
     REST API
        ↓
 Django + DRF
        ↓
 Service Layer
   ↙          ↘
PostgreSQL    TMDB
```

Arquitectura: **monolito modular**.

No usar microservicios en el MVP.

# Módulos

| App | Responsabilidad |
|---|---|
| accounts | usuarios y autenticación |
| preferences | gustos/onboarding |
| movies | catálogo y TMDB |
| interactions | favoritos, pendientes, vistos, likes/dislikes |
| recommendations | scoring personalizado |
| graph | conexiones cinematográficas |
| common | utilidades |

# Services

## MovieService

Obtiene y normaliza metadata de TMDB.

## RecommendationService

Genera candidatos, score, penalización por popularidad, diversidad y explicación.

## GraphService

Genera el subgrafo visible alrededor de una película.

Responsabilidades:

- obtener conexiones;
- asignar peso;
- evitar nodos duplicados;
- limitar profundidad;
- devolver nodos/aristas;
- describir motivo de cada conexión.

# Grafo

No se necesita Neo4j para el MVP.

Las conexiones se pueden generar dinámicamente usando PostgreSQL + metadata TMDB.

Formato:

```json
{
  "nodes": [
    {
      "id": 1,
      "title": "Interstellar",
      "poster": "..."
    }
  ],
  "edges": [
    {
      "source": 1,
      "target": 2,
      "type": "DIRECTOR",
      "label": "Christopher Nolan",
      "strength": 0.95
    }
  ]
}
```

# Tipos de conexión MVP

- DIRECTOR
- ACTOR
- GENRE
- SIMILAR

Futuro:

- THEME
- UNIVERSE
- KEYWORD

Implementación (Sprint 4, `apps/graph/services.py`):

```text
GraphService.neighborhood(movie_id, limit)
  ├─ centro: MovieService.get_details / get_credits (caché local; si TMDB cae, lo guardado)
  ├─ candidatos (MovieService.cached_lists → TMDBListCache, en paralelo):
  │   ├─ person:{id}:directed   filmografía de cada director (/person/{id}/movie_credits)
  │   ├─ person:{id}:lead       películas donde cada uno de los 5 actores principales es principal
  │   ├─ recommendations:{id} / similar:{id}
  │   └─ + créditos locales (MoviePerson) + películas locales conocidas con géneros compartidos
  ├─ strength por tipo → una arista por película con todos sus motivos
  ├─ orden → diversidad (≤ 1/2 por tipo, ≤ 1/3 sólo género, ≤ 4 por persona; relajado hasta 8)
  └─ top `limit` (≤ 12)
```

Las listas de TMDB (incluidas las de recomendaciones del Sprint 3) comparten la caché, así que expandir un nodo ya visitado no llama a TMDB: ~1,3 s la primera vez, ~0,1 s después.

# Expansión

Endpoint:

```text
GET /api/v1/graph/movies/{movie_id}?limit=12
```

El frontend agrega los nuevos nodos al grafo existente.

Para el MVP:

- máximo 12 conexiones por expansión;
- profundidad visual recomendada: 2–3 saltos;
- no repetir nodos existentes.

# Recomendaciones

```text
score =
0.55 affinity
+ 0.20 novelty
+ 0.10 quality
+ 0.10 diversity
+ 0.05 exploration
- popularity_penalty
```

Implementación (Sprint 3, `apps/recommendations/services/`):

```text
TasteProfileService.taste(user)          preferencias + feedback → pesos por género, semillas, exclusiones, firma
  → CandidateService                     /discover (géneros, décadas, idiomas) + recommendations/similar de favoritas
                                         y likes + catálogo local; TMDB vía MovieService.cached_lists (paralelo, caché)
  → scoring.py                           affinity, novelty, quality (rating ponderado), exploration, penalty (puras)
  → ranking.py                           re-ranking greedy: diversidad, cupo VERY_POPULAR, sin rachas de 4
  → explanations.py                      "¿Por qué?" en lenguaje natural
  → RecommendationRun + RecommendationSnapshot
```

Las views sólo llaman a `RecommendationService.get/refresh`. Pesos, umbrales y reglas: `docs/SPRINT_3_REPORT.md`.

# Seguridad

- JWT;
- TMDB_API_KEY sólo backend;
- CORS restringido;
- rate limit login;
- validación de IDs;
- secrets por variables de entorno.

# Cache de TMDB (Sprint 1)

PostgreSQL funciona como cache; no hay Redis.

- `GET /movies/search` siempre consulta TMDB y hace *upsert* de los resultados como filas resumen (sin duplicar por `tmdb_id`). Se refrescan `popularity`, `vote_average` y `vote_count`.
- El catálogo de géneros de TMDB se carga una vez (cuando la tabla está vacía).
- `GET /movies/{id}` y `/credits` sincronizan metadata/créditos la primera vez y luego sólo si pasaron más de `TMDB_CACHE_DAYS` (7 por defecto), usando `metadata_synced_at` / `credits_synced_at`.
- Si TMDB falla al refrescar, se sirve lo cacheado. Si no hay cache, se responde `503` controlado.
- Todo acceso a TMDB pasa por `apps/movies/services/tmdb_client.py`; las views sólo llaman a `MovieService`.

# Rendimiento

- cache local de películas TMDB;
- evitar pedir reparto completo reiteradamente;
- limitar créditos relevantes;
- paginación;
- límite de nodos.
