# Sprint 3 Report

Fecha: 2026-10-04

## Objetivo

Recomendaciones content-based con discovery re-ranking y sin ML (docs/RECOMMENDER_SPEC.md): candidatos de TMDB según el perfil, exclusiones, score desglosado, buckets de popularidad, diversidad, explicación en lenguaje natural y feedback que cambia el ranking siguiente. Pantalla Descubrir con tres secciones y "¿Por qué?". El modo sorpresa y el mapa quedan fuera (Sprints 4–5).

## Features implementadas

| # | Objetivo | Estado |
|---|---|---|
| 3.1 | Toda la lógica en `RecommendationService` (`apps/recommendations/services/`); las views sólo llaman `get` / `refresh` | ✅ |
| 3.2 | Candidatos: `/discover` por géneros, décadas e idiomas preferidos + `recommendations`/`similar` de favoritas y likes + catálogo local | ✅ |
| 3.3 | Caché local de listas de TMDB (`TMDBListCache`, `TMDB_CACHE_DAYS`) y llamadas en paralelo | ✅ |
| 3.4 | Exclusiones: vistas, rechazadas, géneros a evitar (y además: ya guardadas, sin estrenar, sin señal, películas de TV, mal valoradas) | ✅ |
| 3.5 | `final = 0.55 affinity + 0.20 novelty + 0.10 quality + 0.10 diversity + 0.05 exploration − popularity_penalty` | ✅ |
| 3.6 | Quality con rating ponderado tipo IMDb | ✅ |
| 3.7 | Buckets VERY_POPULAR / POPULAR / MEDIUM / HIDDEN con cupos por nivel | ✅ |
| 3.8 | Diversidad: nunca 4 seguidas con el mismo género o director | ✅ |
| 3.9 | Explicación en lenguaje natural por recomendación | ✅ |
| 3.10 | `RecommendationRun` + `RecommendationSnapshot` con el desglose completo | ✅ |
| 3.11 | El feedback (like, dislike, vista, favorita, pendiente) cambia el siguiente `GET` sin refrescar | ✅ |
| 3.12 | Fallback explícito (populares bien valoradas + `notice`) con onboarding incompleto | ✅ |
| 3.13 | `GET /recommendations`, `POST /recommendations/refresh`, con autenticación | ✅ |
| 3.14 | Descubrir: Para vos / Joyas para descubrir / Continuá explorando, "¿Por qué?", Refrescar, loading / error / vacío | ✅ |

## Cómo funciona

```text
TasteProfileService.taste(user)     preferencias + feedback → pesos por género, semillas, exclusiones, firma
  → CandidateService                discover + seeds + catálogo local (TMDB cacheado, en paralelo)
  → scoring.py                      componentes en [0, 1] (funciones puras)
  → ranking.py                      re-ranking greedy por sección
  → explanations.py                 "¿Por qué?"
  → RecommendationRun / RecommendationSnapshot
```

### Perfil de gustos (`TasteProfileService.taste`)

`docs/RULES.md` pide que los gustos se calculen en `TasteProfileService` y el ranking en `RecommendationService`. Por eso el perfil se arma allá y el recomendador sólo lo lee.

- **Peso por género** en [-1, 1]: cada género preferido parte de +1,0, y cada interacción suma a los géneros de su película. Valores, según `WORKFLOW.md → Feedback`: favorita +0,6 (señal fuerte), like +0,4, pendiente +0,2 (interés moderado), vista +0,1 y dislike −0,5. Los totales sólo se escalan hacia abajo cuando superan 1.
- **Semillas**: hasta 5 favoritas y likes, primero las favoritas y las más recientes. Sus listas de TMDB generan candidatos y sus directores cuentan para la afinidad.
- **Exclusiones**: toda película con la que el usuario ya interactuó.
- **Firma**: hash de las preferencias + todas las interacciones. Si cambia, la corrida guardada queda vencida.

### Candidatos

- `/discover`, siempre con `without_genres` = géneros a evitar:
  - por cada uno de los 3 géneros con más peso: populares (`popularity.desc`) y aclamadas (`vote_average.desc`), ≥ 300 votos;
  - por cada década preferida (hasta 3), con los géneros favoritos;
  - por cada idioma preferido que no sea inglés (hasta 2).
- Por cada semilla: `/movie/{id}/recommendations` y `/similar`.
- Catálogo local: hasta 300 películas ya cacheadas con géneros que le gustan al usuario. No usa red, así que siempre hay algo para rankear.
- Todo pasa por `MovieService.cached_lists`:
  - las listas se guardan en `TMDBListCache` y no se vuelven a pedir antes de `TMDB_CACHE_DAYS` (7);
  - las que faltan se piden en paralelo (6 a la vez; sólo red, las escrituras quedan en el hilo principal);
  - si TMDB falla se usa la lista vencida, y si no había ninguna se marca `degraded`.
- Primer cálculo real del demo, con la caché vacía: unas 20 llamadas en 3,2 s. Recálculos: 0,1–0,7 s.
- **Exclusiones duras**: vistas, rechazadas y cualquier otra película ya marcada; géneros a evitar; menos de 200 votos (sin señal); sin estrenar; "Película de TV" (salvo que el usuario la eligió); y, después del scoring, quality < 0,2 (rating ponderado < ~5,7).

### Componentes del score

| Componente | Cálculo |
|---|---|
| **affinity** | `0.45·géneros + 0.15·década + 0.10·idioma + 0.30·semilla`. Géneros = `0.6·max + 0.4·media` de los pesos. Década: 1 si es una década elegida, 0,5 si es vecina, 0 si no; 0,5 si el usuario no eligió décadas. Idioma: 1 / 0, o 0,5 sin preferencia. Semilla: favorita 1,0 / like 0,8, ×1,0 si vino de TMDB `recommendations` y ×0,6 si vino de `similar` (más ruidosa); mismo director que la semilla ×0,85. |
| **popularity** | `log10(votos)` normalizado entre 100 y 40.000 votos. Se usa `vote_count` (qué tan conocida es) y no el `popularity` de TMDB (tendencia del momento). |
| **novelty** | `(1 − popularity) × gate(quality)`, con gate = 0 si quality ≤ 0,3 y 1 desde quality 0,7. Ser desconocida *y* buena suma; ser sólo desconocida no ("no significa recomendar películas malas o desconocidas sin señal"). |
| **quality** | Rating ponderado tipo IMDb: `WR = v/(v+m)·R + m/(v+m)·C`, con m = 500 y C = 6,5, llevado linealmente de [5; 8,5] a [0, 1]. Un 10 con 3 votos da WR 6,52 → 0,43; un 8,0 con 20.000 votos da 7,96 → 0,85. |
| **diversity** | Se calcula al re-rankear: `1 − máx. similitud Jaccard de géneros` con las últimas 5 elegidas, ÷2 si el director ya apareció. |
| **exploration** | 1,0 si comparte un género que le gusta *y* suma uno que el usuario no exploró ("cercano pero no idéntico"); 0,3 si sólo tiene géneros conocidos; 0 si no comparte ninguno. |
| **popularity_penalty** | `fuerza × popularity²`; la curva cuadrática casi no toca a las medianamente populares. |

### Nivel de descubrimiento

| Nivel | affinity | novelty | quality | diversity | exploration | penalty (fuerza) | máx. VERY_POPULAR |
|---|---|---|---|---|---|---|---|
| Familiar | 0,60 | 0,05 | 0,20 | 0,10 | 0,05 | 0,04 | 40 % |
| **Equilibrado** | **0,55** | **0,20** | **0,10** | **0,10** | **0,05** | 0,10 | 25 % |
| Explorador | 0,45 | 0,30 | 0,10 | 0,10 | 0,05 | 0,18 | 12 % |

Equilibrado usa exactamente los pesos de la spec. Explorador sube novelty y penaliza más la popularidad (`WORKFLOW.md`). Familiar penaliza menos y pasa peso de novelty a quality: como el rating ponderado crece con los votos, ganan las apuestas seguras.

**Buckets** por `vote_count`: VERY_POPULAR ≥ 15.000 · POPULAR ≥ 4.000 · MEDIUM ≥ 800 · HIDDEN < 800.

### Re-ranking (`ranking.py`)

Es greedy: en cada posición elige la candidata con mayor `base + 0.10·diversity` entre las que cumplen dos reglas:

1. **Cupo de VERY_POPULAR**: en las primeras n posiciones nunca hay más de `max(1, ⌊share·n⌋)`, así que el tope vale para cualquier prefijo (las primeras 12 de "Para vos" lo cumplen). Si sólo quedan muy populares y el cupo está lleno, la lista termina más corta en vez de romper la regla.
2. **Sin rachas**: una película no puede ser la 4.ª seguida que comparte un género, o un director conocido, con las 3 anteriores. Si ninguna candidata lo cumple, sólo esta regla se relaja.

Secciones, sin repetir películas:

- **Para vos**: re-ranking de todo el pool.
- **Joyas para descubrir**: sólo MEDIUM/HIDDEN con quality ≥ 0,45.
- **Continuá explorando**: candidatas que vienen de semillas. Si hay menos de 4, el resto del pool.

Los directores se sincronizan para las 24 mejores candidatas antes del re-ranking (en paralelo, cacheados), y con eso se vuelve a calcular el score.

### Explicaciones (`explanations.py`)

Formato: `Porque <hasta 2 razones>; <hasta 2 rasgos>.`

- **Razones**: "tenés X entre tus favoritas" / "te gustó X" / "la dirigió D, como X"; "preferís ciencia ficción y suspense" (o "te vienen gustando las de aventura" si el género lo aprendió del feedback); "es de los años 90"; "está en japonés".
- **Rasgos**: "es una joya poco conocida" / "es menos conocida que la mayoría" / "es de las más vistas"; "muy bien valorada (8.2 con 1.651 votos)"; "te acerca a animación".

Fallback: "Popular y bien valorada (8.4 con 36.000 votos)."

### Persistencia, feedback y fallback

- Cada generación reemplaza el `RecommendationRun` del usuario y sus `RecommendationSnapshot` en una transacción, con el desglose completo de cada película.
- `GET` reutiliza la corrida salvo que haya cambiado la firma (preferencias o cualquier interacción), tenga más de 24 h o se haya generado con TMDB degradado hace más de 10 min. Así una "Vista" o un "No me interesa" se refleja en la próxima visita a Descubrir sin tocar "Refrescar". El frontend invalida la query al cambiar una interacción o las preferencias.
- **Fallback (onboarding incompleto)**: `is_fallback: true` + `notice`. Candidatas = `/discover` de las más votadas con nota ≥ 7 + catálogo local con ≥ 1.000 votos, siempre sin vistas ni rechazadas. Score `0.6·quality + 0.4·popularity`, sin personalización (affinity = 0).
- **TMDB caído**: 200 con `degraded: true`, `notice` y lo que haya en caché o en el catálogo local (aunque sea vacío). No hay 503.

## Ejemplo real de ranking

Usuario demo (`demo@movieverse.dev`, nivel **Explorador**, prefiere ciencia ficción + suspense, años 90–2000, inglés, evita terror; favoritas Interstellar y Harry Potter y el cáliz de fuego; likes Dune y Starship Troopers). Datos reales de TMDB, `RecommendationSnapshot` del 2026-10-04.

Pesos Explorador: affinity 0,45 · novelty 0,30 · quality 0,10 · diversity 0,10 · exploration 0,05.

| | **Jin-Roh: La brigada del lobo** (1999) | **Delicatessen** (1991) | **El planeta de los simios** (1968) |
|---|---|---|---|
| Sección / posición | Para vos #2 | Para vos #4 | Para vos #10 |
| Votos · nota TMDB | 596 · 7,40 | 1.700 · 7,31 | 4.132 · 7,66 |
| Bucket | HIDDEN | MEDIUM | POPULAR |
| affinity | 0,6911 → **0,3110** | 0,6800 → **0,3060** | 0,7733 → **0,3480** |
| novelty | 0,4716 → **0,1415** | 0,4051 → **0,1215** | 0,3789 → **0,1137** |
| quality | 0,5687 → **0,0569** | 0,6074 → **0,0607** | 0,7232 → **0,0723** |
| diversity | 0,8000 → **0,0800** | 0,8000 → **0,0800** | 0,5000 → **0,0500** |
| exploration | 1,0000 → **0,0500** | 1,0000 → **0,0500** | 1,0000 → **0,0500** |
| − popularity_penalty | **−0,0160** | **−0,0402** | **−0,0694** |
| **final** | **0,6234** | **0,5780** | **0,5645** |

(valor del componente → aporte ponderado; la suma coincide con `final_score` guardado).

Explicaciones devueltas por la API:

- *Jin-Roh*: "Porque tenés Interstellar entre tus favoritas y preferís ciencia ficción y suspense; es una joya poco conocida y te acerca a animación."
- *Delicatessen*: "Porque tenés Interstellar entre tus favoritas y preferís ciencia ficción; es menos conocida que la mayoría y te acerca a comedia."
- *El planeta de los simios*: "Porque tenés Interstellar entre tus favoritas y preferís ciencia ficción; te acerca a acción."

Lectura: *El planeta de los simios* tiene la mejor afinidad (0,77) y la mejor calidad (0,72), pero en Explorador su popularidad le cuesta 0,069 de penalización y le da menos novelty que a *Jin-Roh*, una joya con 596 votos bien valorada. Además, para la posición 10 ya había ciencia ficción + acción cerca, así que su diversidad bajó a 0,5. El orden dentro de una sección no es estrictamente decreciente en `final`: la diversidad de cada película se calcula contra las ya elegidas en el momento de elegirla.

### Mismo perfil, tres niveles (sólo cambia `discovery_level`, "Para vos")

| Nivel | VERY_POPULAR | POPULAR | MEDIUM | HIDDEN | Votos promedio | Primeras |
|---|---|---|---|---|---|---|
| Familiar | 4 (33 %) | 5 | 2 | 1 | 13.223 | El señor de los anillos, A.I. Inteligencia Artificial, Star Trek, Primer |
| Equilibrado | 1 (8 %) | 4 | 5 | 2 | 5.914 | Doctor Who: La última Navidad, Primer, Star Trek, Las crónicas de Narnia |
| Explorador | 0 | 1 | 7 | 4 | 1.599 | Doctor Who: La última Navidad, Jin-Roh, Batman: Knightfall, Delicatessen |

## Endpoints

| Método | Ruta | Respuesta |
|---|---|---|
| GET | `/recommendations` | `{generated_at, discovery_level, is_fallback, degraded, notice, sections[{key, items[{movie, position, popularity_bucket, explanation, scores{…, final}}]}]}` |
| POST | `/recommendations/refresh` | lo mismo, regenerado |

Contrato completo en `docs/API_GUIDELINES.md`. Ambos requieren JWT. `GET` usa el throttle `tmdb` y `refresh` el nuevo `recommendations` (10/min).

## Frontend

- **Descubrir** (`/discover`): "Para vos", "Joyas para descubrir" y "Continuá explorando" (`RecommendationSection`: ícono, `h2` display, descripción y `MovieGrid`).
- **"¿Por qué?"**: cada card tiene un `Disclosure` que muestra `explanation` tal cual viene de la API.
- **Refrescar**: botón `secondary` con ícono que gira y confirmación en `role="status"`. Si falla, se conserva la lista actual y se muestra el error.
- **Estados**: loading (`LoadingState`), error con reintento (`ErrorState`), todo vacío (`EmptyState` + CTA a Buscar), sección vacía (texto propio) y aviso de fallback o degradado (con link a completar el onboarding).
- **El frontend no calcula nada**: muestra el orden, el texto y los buckets de la API. Al cambiar una interacción o las preferencias sólo invalida la query; el backend regenera.
- **Componente base nuevo**: `Disclosure` (documentado en `DESIGN_SYSTEM.md` y `CLAUDE.md`).

## Tests

Ejecutados realmente:

```text
backend$ ruff check .                              → All checks passed!
backend$ ruff format --check .                     → OK
backend$ python manage.py makemigrations --check   → No changes detected
backend$ pytest                                    → 216 passed (157 Sprint 0–2 + 59 Sprint 3)
frontend$ npm run lint                             → OK (0 warnings)
frontend$ npm run typecheck                        → OK
frontend$ npm test                                 → 55 passed (45 Sprint 0–2 + 10 Sprint 3)
frontend$ npm run build                            → ✓ built
```

Tests obligatorios del pedido (y de `agents/QA_AGENT.md`):

| Caso | Tests |
|---|---|
| No recomienda vistas ni rechazadas | `test_never_recommends_watched_disliked_or_avoided_genres` (aunque TMDB las devuelva), `test_watched_is_excluded_on_the_next_get_without_refresh`, `test_does_not_recommend_what_the_user_already_saved` |
| La penalización por popularidad baja el score | `test_popularity_penalty_lowers_the_score`, `test_popularity_penalty_grows_with_popularity_and_with_the_level` |
| Explorador aumenta el peso de novelty | `test_explorer_increases_the_novelty_weight`, `test_explorer_favors_the_novel_title_more_than_balanced`, `test_explorer_shows_more_lesser_known_titles_than_familiar` |
| Un like / dislike cambia el ranking | `test_like_changes_the_ranking`, `test_dislike_excludes_the_title_and_lowers_its_genres`, `test_feedback_moves_genre_weights`, `test_a_dislike_on_every_preferred_genre_still_counts` |
| Se respetan los porcentajes de buckets | `test_very_popular_quota[BALANCED/EXPLORER]` (cada prefijo de 12, 20 y 40), `test_bucket_shares_in_for_you[BALANCED/EXPLORER]` (API), `test_quota_list_ends_shorter_rather_than_breaking_the_cap` |
| Si TMDB falla la API no se rompe | `test_tmdb_down_does_not_break_the_api` (200 + `degraded` + catálogo local), `test_tmdb_down_with_empty_catalog_returns_empty_sections` |
| Onboarding incompleto → fallback explícito | `test_fallback_when_onboarding_is_incomplete`, `test_completing_onboarding_leaves_the_fallback` |
| Endpoints con autenticación / sin datos ajenos | `test_endpoints_require_authentication`, `test_users_only_get_their_own_recommendations` |

Además se cubren: quality ponderada (10 con 3 votos < 8 con 20.000), novelty que exige calidad, buckets, afinidades por década e idioma, exploration, diversidad (sin 4 seguidas por género ni por director, relajación, desempate), gemas sólo MEDIUM/HIDDEN y nunca malas, una película por sección, forma de la respuesta y `final` = suma ponderada, snapshots persistidos, reutilización de la corrida, refresh, cambio de preferencias, semilla favorita con explicación, caché de TMDB entre refreshes y parámetros de `/discover`.

Frontend: tres secciones con datos de la API, "¿Por qué?" abre y cierra la explicación (`aria-expanded`), refrescar (con éxito y con error), loading, error + reintento, vacío total, sección vacía, aviso de fallback y orden/texto tal cual de la API.

## Verificación de punta a punta

Contra el stack real (Django en Docker + PostgreSQL + Vite + TMDB real), con Chrome headless y el usuario demo. 8/8 chequeos:

- Tres secciones con 12 películas cada una.
- "¿Por qué?" de la primera ("Doctor Who: La última Navidad"): "Porque tenés Interstellar entre tus favoritas y preferís ciencia ficción; es una joya poco conocida y te acerca a drama."
- Refrescar → "Recomendaciones actualizadas."
- "No me interesa" sobre la primera recomendación → al volver a Descubrir (sin refrescar) ya no está y la nueva primera es *Jin-Roh*. Después se deshizo para no alterar los datos del demo.
- 390 px sin scroll horizontal. Sin errores en consola.

## Decisiones técnicas

1. **La popularidad se mide con `vote_count`**: refleja qué tan conocida es una película. El `popularity` de TMDB es tendencia del momento: un clásico muy visto puede tenerlo bajo.
2. **Novelty condicionada a calidad.** La primera versión, probada contra TMDB real, llenaba "Para vos" en Explorador con títulos desconocidos de poca señal (*Babylon 5: Relatos perdidos*, especiales de TV). Multiplicar la novelty por un gate de calidad aplica la regla de la spec ("no significa recomendar películas malas o desconocidas sin señal").
3. **Pesos por nivel**: Equilibrado son los de la spec. En Familiar se pasó novelty a quality después de comprobar en un test que, con 0,10 / 0,15, un título apenas mejor valorado y menos conocido le ganaba a uno popular, y Familiar no cumplía "apuestas seguras".
4. **"similar" pesa 0,6 de "recommendations"**: las listas `similar` de TMDB son más ruidosas (Doctor Who para Interstellar).
5. **Las películas de TV se excluyen** salvo que el usuario elija ese género: secuelas directas a TV y especiales metían ruido.
6. **Se excluye todo lo que el usuario ya marcó** (además de vistas y rechazadas): recomendar algo que ya está en favoritas o pendientes no aporta descubrimiento.
7. **Regeneración por firma y no por evento**: no hacen falta señales entre apps. Cualquier cambio de preferencias o interacciones (también borrados) vence la corrida en el próximo `GET`.
8. **El cupo de VERY_POPULAR vale para cada prefijo**: así las primeras 12 visibles lo respetan, no sólo el total.
9. **Las llamadas a TMDB van en paralelo y sólo de red**: las escrituras en la base quedan en el hilo de la request (sin problemas de conexiones de Django por hilo).

## Problemas encontrados

- **Bug de normalización (lo encontró un test)**: dividir los pesos de género por el máximo anulaba un dislike que bajaba a la vez todos los géneros preferidos (sci-fi y suspense pasaban de 1,0 a 0,5 y volvían a 1,0). Ahora sólo se escala hacia abajo; test de regresión `test_a_dislike_on_every_preferred_genre_still_counts`.
- **Calidad del ranking en Explorador**: ver decisiones 2, 4 y 5. Se ajustó mirando el ranking real del demo, no sólo los tests.
- **Rutas con `/` inicial** en includes: mismo caso que en Sprint 2, se montaron con rutas completas.

## Deuda técnica

- Se rankea todo en la request (sin tareas en segundo plano). El primer cálculo con la caché vacía tarda ~3 s; después, < 1 s.
- `similar` y `recommendations` se piden siempre las dos por semilla (se podría pedir `similar` sólo si `recommendations` trae pocas).
- Los especiales que TMDB clasifica como películas (p. ej. *Doctor Who*) siguen apareciendo si están bien valorados.
- El director sólo se conoce para las películas con créditos sincronizados (las 24 mejores por corrida, más las que el usuario abrió).
- Umbrales y pesos están en constantes, no en configuración.
- Las explicaciones son plantillas en español sin i18n.

## Preparación para Sprint 4 y 5

- `TMDBClient.get_similar_movies` / `get_movie_recommendations` y `TMDBListCache` dejan listo el insumo de "similar" del GraphService, con caché.
- `MovieService.ensure_credits` (paralelo) sirve para cargar directores y reparto de los nodos del mapa.
- Modo sorpresa (Sprint 5): `RecommendationService.rank(taste)` ya devuelve candidatos con score; falta el muestreo ponderado entre los mejores (no `random.choice` sobre todo el catálogo).

SPRINT_3_STATUS: COMPLETED
