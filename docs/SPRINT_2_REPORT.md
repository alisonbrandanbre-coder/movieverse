# Sprint 2 Report

Fecha: 2026-10-04

## Objetivo

Que MovieVerse conozca al usuario: onboarding de preferencias (EPIC 1) y favoritas, pendientes, vistas y like/dislike (EPIC 3), siempre ligados a `request.user`. El recomendador no se empezó (Sprint 3).

## Features implementadas

| # | Objetivo | Estado |
|---|---|---|
| 2.1 | Modelo `UserTasteProfile` (géneros favoritos / a evitar, décadas, idiomas, nivel de descubrimiento, `onboarding_completed`) | ✅ |
| 2.2 | Modelo `Interaction` (LIKE, DISLIKE, WATCHED, FAVORITE, WATCHLIST; REMOVE_WATCHLIST como acción) con UNIQUE(user, movie, type) | ✅ |
| 2.3 | `TasteProfileService` (única escritura de preferencias) e `InteractionService` (única escritura de interacciones) | ✅ |
| 2.4 | `GET/PUT /preferences`, `POST /preferences/onboarding`, `GET /preferences/options` | ✅ |
| 2.5 | `GET /movies/onboarding-sample` (títulos conocidos para la valoración rápida) | ✅ |
| 2.6 | `GET/POST /movies/{id}/interactions`, `DELETE /movies/{id}/interactions/{type}` | ✅ |
| 2.7 | `GET /me/favorites`, `/me/watchlist`, `/me/watched` (paginadas) | ✅ |
| 2.8 | Todo usa `request.user`; un `user_id` del body se ignora (docs/RBAC.md) | ✅ |
| 2.9 | Sin favoritas/pendientes duplicadas; quitar de pendientes funciona (DELETE y REMOVE_WATCHLIST) | ✅ |
| 2.10 | Wizard de onboarding de 6 pasos con barra de progreso y Atrás / Siguiente | ✅ |
| 2.11 | Registro → onboarding; con onboarding completo → Descubrir | ✅ |
| 2.12 | Ficha: Favorita, Pendiente, Vista, Me gusta, No me interesa con estado visible y feedback | ✅ |
| 2.13 | Mi perfil con tabs Favoritas / Pendientes / Vistas / Preferencias (editables) y estados vacíos | ✅ |
| 2.14 | Componentes base nuevos documentados en `DESIGN_SYSTEM.md` | ✅ |

## Modelos

- **UserTasteProfile** (`apps.preferences`): OneToOne con el usuario, creado vacío en el primer acceso. `preferred_genres` / `disliked_genres` son M2M a `Genre` (integridad referencial, y el recomendador puede hacer joins); `preferred_decades` (años de inicio: `1990`) y `preferred_languages` (ISO 639-1, como `Movie.original_language`) son listas JSON validadas contra las opciones; `discovery_level` `FAMILIAR | BALANCED | EXPLORER` (default `BALANCED`).
- **Interaction** (`apps.interactions`): cada fila es el **estado actual** de una marca, no un evento. UNIQUE(user, movie, type) + índice (user, type, -created_at) para las listas. Quitar = borrar la fila. `rating` queda reservado (nullable, no se expone).

Migraciones `preferences/0001_initial` e `interactions/0001_initial`, aplicadas en la base de Docker.

## Endpoints

| Método | Ruta | Respuesta |
|---|---|---|
| GET | `/preferences` | preferencias (géneros como `{id, name}`) + `onboarding_completed` |
| PUT | `/preferences` | reemplaza las preferencias (géneros como ids) |
| POST | `/preferences/onboarding` | preferencias + `ratings[{movie_id, reaction}]`; marca el onboarding como completo (una transacción) |
| GET | `/preferences/options` | `genres`, `decades` (1950–2020), `languages` (12), `discovery_levels` con label y descripción |
| GET | `/movies/onboarding-sample?genres=&avoid=` | hasta 12 películas conocidas |
| GET | `/movies/{id}/interactions` | `{movie_id, favorite, watchlist, watched, reaction}` |
| POST | `/movies/{id}/interactions` | `{type}` → mismo estado |
| DELETE | `/movies/{id}/interactions/{type}` | mismo estado |
| GET | `/me/favorites` · `/me/watchlist` · `/me/watched` | `{page, total_pages, total_results, results[summary + added_at]}` |

Contratos completos y validaciones en `docs/API_GUIDELINES.md`. Todos requieren JWT; `options` y `onboarding-sample` usan además el throttle `tmdb`, porque pueden llamar a TMDB la primera vez.

## Reglas de negocio

1. **El usuario sale de `request.user`.** Ningún serializer acepta `user_id`; si llega en el body, se ignora (test).
2. **Idempotencia.** Agregar dos veces no duplica (constraint en la base + `get_or_create` + captura de `IntegrityError` ante doble click concurrente). Quitar algo que no está devuelve 200 con el estado.
3. **Marcas contradictorias.** LIKE ↔ DISLIKE se excluyen; DISLIKE ("No me interesa") quita FAVORITE y WATCHLIST; FAVORITE o WATCHLIST quitan DISLIKE; **WATCHED quita WATCHLIST** (una película vista deja de estar pendiente). La respuesta trae el estado final y la UI lo informa ("Marcada como vista y quitada de pendientes.").
4. **Preferencias.** Al menos un género favorito; un género no puede ser favorito y a evitar a la vez (la UI tampoco lo permite: elegirlo en una lista lo saca de la otra). Repetir el onboarding reemplaza todo.
5. **Valoración rápida.** Se guarda como interacciones LIKE/DISLIKE; si una película se repite, gana la última reacción.
6. **Muestra del onboarding.** No es una recomendación: son títulos conocidos (≥ 1000 votos, con póster), ordenados por cantidad de géneros en común con los elegidos y después por votos. Excluye los géneros a evitar y lo que el usuario ya valoró. Si la base tiene menos de 24 títulos conocidos, primero cachea los más votados de TMDB (2 páginas de `/discover/movie?sort_by=vote_count.desc`); si TMDB falla, usa lo local.

## Frontend

- **Componentes base nuevos** (`components/ui/`): `Chip`, `ToggleButton`, `ChoiceCard`, `ProgressBar`, `Tabs`, `Pagination` (extraído de la búsqueda) y token `animate-pop`. `MovieGrid` acepta `renderAction`. Todo con tokens; documentado en `DESIGN_SYSTEM.md` y en `CLAUDE.md`.
- **Onboarding** (`/onboarding`, `features/onboarding/`): 6 pasos según `WORKFLOW.md`, con `ProgressBar` ("Paso X de 6"), Atrás / Siguiente / Terminar. El foco pasa al título de cada paso. El paso 1 bloquea Siguiente hasta elegir un género (con el motivo visible) y los pasos 2 a 6 son opcionales. El paso 6 pide la muestra con los géneros elegidos. Las opciones salen de `GET /preferences/options`.
- **Ruteo**: registro → `/onboarding`. `RequireOnboarding` envuelve `/discover` y redirige a `/onboarding` mientras no esté completo; `/onboarding` redirige a `/discover` cuando ya está completo. El login sigue yendo a `/discover`, así que el gate cubre también a quien se registró y no terminó el onboarding. Si `/preferences` falla, el gate deja pasar en lugar de atrapar al usuario.
- **Ficha**: 5 `ToggleButton` con `aria-pressed`, actualización optimista (se revierte si hay error) y mensaje en `role="status"`. Mientras hay un guardado en curso se ignoran los clicks nuevos (sin deshabilitar el botón, para no perder el foco). "Explorar universo" sigue deshabilitado (Sprint 4).
- **Mi perfil** (`/profile?tab=favoritas|pendientes|vistas|preferencias`): `Tabs` con contadores; listas con `MovieGrid` + "Quitar" + `Pagination`; estados vacíos con CTA a Buscar; Preferencias editables con los mismos selectores del wizard (`PreferenceFields`).
- Tipos en `types/preferences.ts` y `types/interactions.ts`, DTOs + mappers snake→camel y TanStack Query. 0 usos de `any`.

## Tests

Ejecutados realmente:

```text
backend$ ruff check .                              → All checks passed!
backend$ ruff format --check .                     → 78 files already formatted
backend$ python manage.py makemigrations --check   → No changes detected
backend$ pytest                                    → 157 passed (90 Sprint 0–1 + 67 Sprint 2)
frontend$ npm run lint                             → OK (0 warnings)
frontend$ npm run typecheck                        → OK
frontend$ npm test                                 → 45 passed (27 Sprint 0–1 + 18 Sprint 2)
frontend$ npm run build                            → ✓ built
```

Backend Sprint 2 (`tests/preferences/`, `tests/interactions/`):

- **Autenticación**: los 11 endpoints nuevos responden 401 `NOT_AUTHENTICATED` sin token, y no crean filas.
- **Un usuario no ve datos de otro**: listas, estado por película y preferencias aislados; un `user_id` en el body se ignora; quitar desde otra cuenta no afecta la watchlist ajena; la misma película en dos watchlists cuenta una vez por usuario.
- **Sin duplicados**: POST doble de WATCHLIST / FAVORITE deja una fila (y la lista muestra 1); la base rechaza el duplicado (`IntegrityError`).
- **Onboarding**: guarda cada campo (en respuesta, en la base y en el `GET` siguiente), guarda las valoraciones como interacciones, defaults, dedupe, repetirlo reemplaza, y 10 casos de validación (sin géneros, géneros/películas inexistentes, década o idioma inválidos, nivel inválido, reacción inválida, mismo género en ambas listas).
- **Interacciones**: quitar de pendientes (DELETE y REMOVE_WATCHLIST), idempotencia, exclusiones LIKE/DISLIKE, DISLIKE limpia favorita/pendiente, WATCHED limpia pendiente, tipos inválidos, 404, orden y forma de las listas, paginación.
- **Muestra**: prioriza géneros, excluye evitados / poco conocidos / sin póster / ya valorados, cachea TMDB cuando falta pool, degrada si TMDB cae.

Frontend Sprint 2: registro → onboarding; Descubrir → onboarding si está pendiente; onboarding → Descubrir si está completo; login → Descubrir; recorrido completo del wizard (progreso, Atrás conserva elecciones, favoritos fuera de "a evitar", foco, payload exacto enviado); error al guardar; error de opciones; estado de las 5 acciones; agregar con feedback; quitar con DELETE; efecto secundario informado; rollback ante error; tabs con contadores y teclado; quitar desde la lista; estados vacíos; editar y guardar preferencias; no guardar sin géneros.

## Verificación de punta a punta

Contra el stack real (Django en Docker :8001 + PostgreSQL + Vite :5175 + TMDB real), con Chrome headless manejado por CDP. Es un script descartable en el scratchpad que no agrega dependencias.

**Usuario demo (`demo@movieverse.dev`).** La sesión se abrió con tokens emitidos en el servidor (`RefreshToken.for_user`), porque la contraseña del demo no está documentada. El formulario de login ya tiene tests propios. 26 de 27 chequeos pasaron:

- `/discover` → `/onboarding` mientras no estaba completo.
- Wizard: Siguiente deshabilitado sin géneros; Ciencia ficción + Suspense; el paso 2 no ofrece los favoritos; barra 2/6; Atrás conserva la selección; Terror a evitar; años 90 y 2000; inglés; Explorador. La muestra trajo 12 títulos reales (Interstellar, Dune, Dune: Parte dos, El padrino III…): 2 Me gusta y 1 No me interesa. Terminar → `/discover`, y `/onboarding` pasa a redirigir a `/discover`.
- Ficha de Interstellar: Favorita ("Agregada a favoritas."), Pendiente agregar/quitar, Vista ("Marcada como vista y quitada de pendientes."), No me interesa ("… y quitada de favoritas."), Me gusta reemplaza No me interesa; el estado persiste al recargar.
- Búsqueda "dune" → ficha → Pendiente. Perfil: tabs "Favoritas 1 · Pendientes 1 · Vistas 1"; "Quitar Dune de pendientes" → estado vacío; la ficha refleja el cambio; Vistas muestra Interstellar; Preferencias precargadas, editar + guardar ("Preferencias guardadas.").
- 390 px sin scroll horizontal en perfil y ficha. Sin errores en consola.
- El único FAIL ("Preferencias precargadas") fue del script: en ese tab "Terror" aparece en las dos listas y el selector tomó la de favoritos. `GET /preferences` confirmó lo guardado: `Ciencia ficción, Suspense / Terror / [1990, 2000] / ["en"] / EXPLORER / onboarding_completed: true`, y la captura muestra los chips correctos.

**Registro real** (cuenta descartable a 390 px, borrada al terminar): registro → `/onboarding`; sin scroll horizontal; `/discover` sigue bloqueado; su perfil está vacío (no ve datos del demo). 5/5.

**Aislamiento en vivo**: con un token de `design-preview@movieverse.local`, `/me/favorites` y `/me/watched` vacíos y `movies/1/interactions` todo en `false`; sin token → 401.

**Ajuste por la verificación visual**: el ícono `Eye` relleno quedaba como una mancha. `ToggleButton` ganó `fillWhenPressed` y "Vista" lo desactiva.

Estado final del demo, listo para `DEMO_SCRIPT.md`: preferencias ciencia ficción + suspense, evita terror, 1990–2010, inglés, **Explorador**. Interstellar favorita + vista + me gusta, Dune pendiente + me gusta, Dune: Parte dos no me interesa.

## Decisiones técnicas

1. **Interaction como estado, no como log.** Así "no duplicar" y "quitar" son triviales y consistentes. Si el recomendador necesita historial (p. ej. "quitó de pendientes"), se agrega una tabla de eventos aparte.
2. **`DELETE /movies/{id}/interactions/{type}`** para desactivar marcas (además de `REMOVE_WATCHLIST`, que pide el modelo de datos). Hacía falta poder quitar favoritas, vistas y reacciones, y POST quedaba para activar.
3. **`GET /movies/{id}/interactions`** para pintar el estado de los botones de la ficha sin cargar las tres listas.
4. **`GET /preferences/options`**: géneros, décadas e idiomas válidos salen del backend (fuente de verdad), y los serializers validan contra las mismas constantes.
5. **Géneros como objetos al leer e ids al escribir**: la UI muestra nombres sin otra request y la escritura es simple.
6. **El gate del onboarding está en `/discover`, no en todas las rutas**: buscar y ver fichas sigue funcionando aunque el onboarding esté pendiente. Si `/preferences` falla, deja pasar.
7. **WATCHED quita WATCHLIST** y **DISLIKE quita FAVORITE/WATCHLIST**: evitan estados contradictorios que el recomendador tendría que desambiguar.

## Problemas encontrados

- En `config/urls.py`, las rutas de `preferences` e `interactions` se montan en la raíz de la API con rutas completas. Montarlas con prefijo obligaba a usar rutas que empiezan con `/`, que Django desaconseja. `movies/onboarding-sample` se declara antes del include de `movies/`.
- El ícono `Eye` relleno no se lee bien (ver arriba).
- La muestra del onboarding depende del pool local: el demo ya tenía 106 películas de búsquedas anteriores, así que aparecieron títulos como "Harry Brown" (≥ 1000 votos, pero menos icónico). En una base nueva se usan los más votados de TMDB.

## Deuda técnica

- `Interaction.rating` está reservado y sin uso.
- No hay historial de interacciones (ver decisión 1).
- No se puede "rehacer el onboarding" como wizard; las preferencias se editan desde Mi perfil.
- Las valoraciones del onboarding (LIKE/DISLIKE) no tienen lista propia en el perfil: se ven en la ficha de cada película.
- La muestra no se refresca: si el pool local ya tiene ≥ 24 títulos conocidos, no se vuelve a consultar TMDB.
- Tokens en `localStorage` (heredado de Sprint 0).
- La contraseña del usuario demo no está documentada en el repo.

## Preparación para Sprint 3

- `UserTasteProfile` da las preferencias explícitas: `preferred_genres` / `disliked_genres` (M2M, filtrables por join), décadas, idiomas y `discovery_level` (Explorador → más novelty, más penalización de popularidad, según `WORKFLOW.md`).
- `Interaction` da las señales implícitas: FAVORITE (fuerte), LIKE, WATCHLIST (moderada), DISLIKE (excluir + reducir afinidad), WATCHED (excluir). `InteractionService.movie_ids(user, types)` ya devuelve los ids a excluir.
- `Movie` tiene `popularity`, `vote_count`, `release_date`, `original_language` y géneros indexados; la valoración rápida ya deja señales en usuarios nuevos.

SPRINT_2_STATUS: COMPLETED
