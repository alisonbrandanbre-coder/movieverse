# DATA_MODEL.md

# User

Custom user (`apps.accounts.User`, `AUTH_USER_MODEL = "accounts.User"`). Login por email.

- id
- email (único, se guarda en minúsculas)
- password (hash)
- is_active
- is_staff
- is_superuser / groups / user_permissions (PermissionsMixin, para el admin)
- last_login
- date_joined (equivale a `created_at`)

# UserTasteProfile

`apps.preferences.UserTasteProfile`. Una fila por usuario (OneToOne), creada vacía en el primer acceso. Sólo la escribe `TasteProfileService`.

- user_id (OneToOne, CASCADE)
- preferred_genres (M2M → Genre)
- disliked_genres (M2M → Genre; nunca se solapa con preferred_genres)
- preferred_decades (JSON: años de inicio de década, `1990` = los 90)
- preferred_languages (JSON: códigos ISO 639-1, como `Movie.original_language`)
- discovery_level (`FAMILIAR`, `BALANCED` por defecto, `EXPLORER`)
- onboarding_completed (bool)
- updated_at

# Movie

- id
- tmdb_id (UNIQUE)
- title
- original_title
- overview
- release_date nullable
- runtime nullable (minutos; sólo tras sincronizar detalle)
- original_language
- poster_path (sólo el path; la URL se construye en `movies/services/images.py`)
- backdrop_path
- popularity
- vote_average
- vote_count
- genres (M2M → Genre)
- metadata_synced_at nullable — última sincronización del detalle completo con TMDB
- credits_synced_at nullable — última sincronización de créditos
- created_at
- updated_at

Índices: `popularity`, `release_date`, `original_language` (consultas del recomendador).

# Genre

- id
- tmdb_id (UNIQUE)
- name

# Person

Cache mínimo para conexiones.

- id
- tmdb_id (UNIQUE)
- name
- profile_path

# MoviePerson

- movie_id (CASCADE)
- person_id (CASCADE)
- role_type (`ACTOR`, `DIRECTOR`)
- character (vacío para directores)
- credit_order nullable (0 = protagonista)

Restricción: UNIQUE(movie, person, role_type). Índices: (person, role_type) para "otras películas de esta persona" (GraphService) y (movie, role_type, credit_order).

Se almacenan todos los directores (crew con `job == "Director"`) y los primeros 15 actores; el endpoint de créditos devuelve los primeros 10.

# Interaction

`apps.interactions.Interaction`. Cada fila es el **estado actual** de una marca de un usuario sobre una película (no un log de eventos): UNIQUE(user, movie, type), así que no hay favoritas ni pendientes duplicadas. Quitar una marca borra la fila. Índice (user, type, -created_at) para las listas del perfil. Sólo la escribe `InteractionService`.

- id
- user_id (CASCADE)
- movie_id (CASCADE)
- type
- rating nullable (reservado; el MVP usa LIKE/DISLIKE)
- created_at (= "agregada el" en las listas)

Tipos:

- LIKE
- DISLIKE
- WATCHED
- FAVORITE
- WATCHLIST
- REMOVE_WATCHLIST (acción de la API equivalente a borrar la fila WATCHLIST; nunca se persiste)

La valoración rápida del onboarding se guarda como LIKE / DISLIKE.

# RecommendationSnapshot

- user_id
- movie_id
- affinity_score
- novelty_score
- popularity_penalty
- final_score
- explanation
- generated_at

# Graph

No se persiste como estructura completa en V1.

El GraphService construye conexiones a demanda desde:

- Movie;
- Genre;
- Person;
- TMDB similar movies.

Esto evita incorporar una base de grafos innecesaria.
