# Sprint 5 Report

Fecha: 2026-10-04

## Objetivo

Cerrar el MVP: **modo sorpresa** (EPIC 4), los bugs conocidos del mapa, responsive y accesibilidad en todas las pantallas, estados consistentes y una 404 propia, **datos de demo** listos para presentar, README completo, guion de demo y QA final contra los criterios de aceptación. Por pedido explícito no se agregó nada fuera de esa lista.

Entre el Sprint 4 y este sprint se commitearon tres rondas de ajustes del mapa (`b93a625`, `194ca87`, `022b85f`): entrada "Universo" en el menú, nodos más grandes, chips en las aristas, filtro por tipo, zonas, y los tipos de conexión SAGA y UNIVERSO. Están descriptas en `docs/GRAPH_SPEC.md` y `docs/DESIGN_SYSTEM.md` y se dan por incluidas en el MVP.

> El pedido mencionaba `docs/MVP_SCOPE.md` y `docs/QA_AGENT.md`: no existen en el repo. Los criterios de aceptación están en `docs/PROJECT_CONTEXT.md` §9 (y las métricas en §8), y la guía de QA en `agents/QA_AGENT.md`. Se usaron esos.

## Features implementadas

| # | Objetivo | Estado |
|---|---|---|
| 5.1 | Modo sorpresa: `GET /recommendations/surprise`, sorteo ponderado entre las ~20 mejores recomendaciones (nunca la n.º 1; `MEDIUM`/`HIDDEN` pesan el doble) | ✅ |
| 5.2 | Nunca repite vistas, rechazadas (aunque se marquen después de generar) ni la anterior (`exclude`) | ✅ |
| 5.3 | Botón "Sorprendeme" en Descubrir y en el menú; modal con póster, "¿Por qué?", "Ver ficha", "Explorar universo" y "Otra" | ✅ |
| 5.4 | Mapa: minimapa plegable (ninguna película queda debajo tras expandir), además del reencuadre inicial que ya reservaba su espacio | ✅ |
| 5.5 | Responsive en 375 / 768 / 1440 px en las 11 pantallas: sin scroll horizontal | ✅ |
| 5.6 | Accesibilidad: foco visible en todo lo enfocable, contraste, `alt` en pósters, `label` en inputs (axe WCAG 2.1 AA sin violaciones) | ✅ |
| 5.7 | Estados de carga, error y vacío consistentes; 404 con estilo espacial | ✅ |
| 5.8 | `manage.py seed_demo`: 2 usuarios con gustos opuestos, onboarding completo, favoritas, vistas, likes y recomendaciones generadas | ✅ |
| 5.9 | README completo (qué es, capturas, stack, arquitectura, puesta en marcha en Windows, usuarios demo, tests, TMDB, roadmap) | ✅ |
| 5.10 | `docs/DEMO_SCRIPT.md`: guion de 5 minutos con clics y textos | ✅ |
| 5.11 | QA final: tests + criterios de aceptación | ✅ (ver abajo) |

## Modo sorpresa

**Backend** (`RecommendationService.surprise`):

1. Usa la última generación de recomendaciones del usuario (si cambió su feedback o tiene más de 24 h, se regenera antes, como en `GET /recommendations`).
2. Ordena las tres secciones juntas por `final_score` y toma las 20 mejores; descarta la n.º 1 ("la obvia", que ya encabeza Descubrir).
3. Descarta las vistas y rechazadas **actuales** (no sólo las de cuando se generó) y `exclude`.
4. Sortea con peso `final_score × 2` para `MEDIUM`/`HIDDEN` y `× 1` para el resto. No es un `random.choice` sobre el catálogo: siempre sale de las recomendaciones del usuario.
5. Sin candidatas → `404 NO_SURPRISE` con un mensaje que la UI muestra como estado vacío.

**Frontend**: `SurpriseProvider` (en `AppLayout`) es dueño del modal, así el botón del menú mobile (que se cierra al tocarlo) puede abrirlo. "Otra" manda `exclude=<id en pantalla>`. Se creó el componente base **`Modal`** (no existía): `role="dialog"`, `aria-modal`, Esc, clic afuera, foco atrapado y devuelto a quien lo abrió, scroll bloqueado. Documentado en `docs/DESIGN_SYSTEM.md`.

Verificado contra el stack real con el usuario demo: 5 sorteos seguidos por pantalla (1440, 768 y 375), cada pedido con `exclude` = la película mostrada y ninguna repetida en el sorteo siguiente.

## Bugs del mapa

- **Película debajo del minimapa.** El reencuadre inicial ya reservaba el espacio (Sprint 4+), pero después de expandir o recentrar una película podía quedar debajo. El minimapa ahora se pliega con un botón en su esquina ("Ocultar minimapa" / "Minimapa").
- **Foco con teclado.** React Flow volvía enfocables las aristas y los contenedores de nodo, que no muestran foco ni son accionables (axe y el recorrido con Tab lo detectaron). Ahora Tab recorre sólo los pósters (botones).

## Responsive y accesibilidad

Auditoría automatizada con **axe-core** (WCAG 2 A/AA y 2.1 A/AA) + medición de scroll horizontal + recorrido con Tab (40 pasos, comprobando el indicador de foco de cada elemento) sobre el stack real:

- **11 pantallas**: login, registro, onboarding, Descubrir, Buscar, ficha, Universo, mapa, perfil, preferencias y 404.
- **3 anchos**: 375, 768 y 1440 px, o sea 33 combinaciones.

| Hallazgo | Corrección |
|---|---|
| 768 px: 80 px de scroll horizontal en todas las pantallas con sesión (el menú, con 6 ítems, no entraba) | La fila completa del menú se muestra desde `lg` (1024 px); por debajo, botón de menú. El menú desplegado ahora es un `<nav aria-label="Menú">` con `aria-controls` |
| Ficha: el reparto se desplaza pero no se podía enfocar (`scrollable-region-focusable`) | `tabIndex=0`, `aria-label="Reparto principal"` y anillo de foco |
| Mapa: aristas enfocables sin indicador | `edgesFocusable` / `nodesFocusable` en `false` (los pósters siguen enfocables) |

Resultado final: **33/33 sin violaciones de axe, sin scroll horizontal y con foco visible en todo lo enfocable**. Contraste, `alt` de pósters y `label` de inputs ya cumplían (0 violaciones de `color-contrast`, `image-alt` y `label`).

## Estados y 404

Todas las pantallas que cargan datos usan los componentes base: `LoadingState` (o `StarsLoadingState` en el mapa y la sorpresa), `ErrorState` con "Reintentar" y `EmptyState` con una acción. No hizo falta cambiar ninguna. La única pantalla genérica era la 404: ahora tiene una constelación a la que le falta una estrella, el título "Te perdiste en el espacio" y botones a Descubrir y Buscar, o a iniciar sesión si no hay cuenta. Antes llevaba a la intro.

## Datos de demo (`seed_demo`)

```text
$ docker compose exec backend python manage.py seed_demo
explorador@movieverse.example · Explorador · 14 marcas · 36 recomendaciones
familiar@movieverse.example · Familiar · 11 marcas · 36 recomendaciones
Mapa listo: Harry Potter y el cáliz de fuego (12 conexiones)
Mapa listo: Animales fantásticos y dónde encontrarlos (12 conexiones)
Mapa listo: Interstellar (12 conexiones)
Contraseña de ambos usuarios: MovieVerse-demo-2026
```

| | Explorador | Familiar |
|---|---|---|
| Géneros | Ciencia ficción, suspense, misterio | Comedia, romance, familia |
| Evita | Romance, comedia, documental, película de TV | Terror, ciencia ficción, película de TV |
| Décadas / idiomas | 1990–2010 · inglés | 1990–2010 · inglés, español |
| Favoritas | Interstellar, Blade Runner, La llegada | Notting Hill, Love Actually, Mamma Mia! |
| Vistas | Matrix, Origen, 2001 | La proposición, Crazy, Stupid, Love |
| Me gusta | Moon, Ex Machina, Gattaca, Primer | Una cuestión de tiempo, La La Land, Paddington 2, El diablo viste de Prada |
| Pendiente / No me interesa | Dune / Notting Hill + 2 especiales de Doctor Who | Mamma Mia! Una y otra vez / Expediente Warren |
| "Para vos" resultante | Frequency, Finch, Star Trek: Primer contacto, K-PAX… | Pretty Woman, Family Man, Paddington, Eduardo Manostijeras… |

- Cada id de TMDB se verificó contra la API (los títulos en español de arriba son los que devolvió TMDB).
- Los dos especiales de *Doctor Who* figuran como "No me interesa" del explorador: TMDB los cataloga como películas de ciencia ficción, no como "Película de TV", así que encabezaban su lista. Es curación de los datos de demo; no se cambió el recomendador (ver deuda técnica).
- Es idempotente: reinicia ambos usuarios al mismo estado.
- Si TMDB no responde, termina con un error claro.
- Precalcula los tres mapas del guion, así la demo no espera a TMDB.

## README y guion

- **README.md** reescrito: qué es MovieVerse, 7 capturas reales (`docs/screenshots/`, JPG de 50–150 KB), stack, arquitectura resumida, puesta en marcha desde cero en Windows con PowerShell (Docker, `.env`, migraciones, `seed_demo`, npm, alternativa sin Docker), usuarios de demo, tests, tabla de la API, atribución de TMDB y roadmap (maratones, logros, amigos y compatibilidad, camino entre dos películas, dónde verla, estadísticas).
- **docs/DEMO_SCRIPT.md**: 5 minutos con tiempos acumulados. Recorre intro → onboarding en vivo → Descubrir con "¿Por qué?" → mapa de *Harry Potter y el cáliz de fuego* (chips "Saga Harry Potter", "Wizarding World", actores y director) → expandir *Animales fantásticos* (13 → 23 películas) → modo sorpresa. Para cada paso indica qué tocar y qué decir, más un checklist previo, un plan B y un recorrido alternativo con el perfil Familiar. El recorrido se ejecutó en el navegador antes de escribirlo: los textos y resultados del guion son los que aparecen.

## Tests

Ejecutados realmente:

```text
backend$ ruff check .                              → All checks passed!
backend$ ruff format --check .                     → 107 files already formatted
backend$ python manage.py makemigrations --check   → No changes detected
backend$ pytest                                    → 274 passed (261 hasta Sprint 4+ · 13 Sprint 5)
frontend$ npm run lint                             → OK (0 warnings)
frontend$ npm run typecheck                        → OK
frontend$ npm test                                 → 102 passed (95 hasta Sprint 4+ · 7 Sprint 5)
frontend$ npm run build                            → ✓ built
```

Nuevos:

- **Sorpresa (backend, 9)**: auth, forma de la respuesta, nunca la n.º 1 y sólo entre las 20 mejores (120 sorteos con semilla), nunca vistas/rechazadas marcadas después ni la anterior, las menos conocidas salen más que su proporción, `exclude` por la API, 404 `NO_SURPRISE`, `exclude` inválido, aislamiento entre usuarios.
- **seed_demo (4)**: dos usuarios con gustos opuestos y onboarding completo; favoritas, vistas, likes y recomendaciones sin repetir lo marcado; idempotencia; TMDB caído → error claro.
- **Frontend (7)**: modal sorpresa (contenido, enlaces, "Otra" con `exclude`), desde el menú con Esc y devolución del foco, estado vacío, error con reintento; minimapa plegable; 404 con y sin sesión.

Robustez: hubo **un** fallo intermitente del frontend en 13 corridas completas, que no se pudo reproducir ni aislado ni con carga. Se subió el timeout de las esperas de Testing Library de 1 s a 3 s (`src/test/setup.ts`); después, todas las corridas pasaron.

## QA final: criterios de aceptación

### `PROJECT_CONTEXT.md` §9: el MVP está terminado si un usuario puede…

Verificado de punta a punta en Chrome contra el stack real (Django + PostgreSQL + TMDB real), con un usuario **recién creado**: **10/10**.

| # | Criterio | Cumple | Evidencia |
|---|---|---|---|
| 1 | Crear cuenta | ✅ | Registro → redirige al onboarding |
| 2 | Indicar gustos | ✅ | Onboarding de 6 pasos (ciencia ficción + suspense, evita romance, Explorador) → Descubrir |
| 3 | Buscar `Interstellar` | ✅ | Búsqueda → resultado *Interstellar* |
| 4 | Abrir su ficha | ✅ | Título, sinopsis y Christopher Nolan en créditos |
| 5 | Visualizar conexiones | ✅ | "Explorar universo" → 13 películas con chips ("Christopher Nolan", "Jessica Chastain", "Anne Hathaway"…) |
| 6 | Hacer clic en una película conectada | ✅ | *La Odisea* → panel "Dirigidas por Christopher Nolan" |
| 7 | Continuar explorando el mapa | ✅ | "Expandir desde acá" → 13 → 22 películas; recorrido "Interstellar › La Odisea" |
| 8 | Recibir recomendaciones personales | ✅ | 12 en "Para vos" (36 en total) apenas termina el onboarding |
| 9 | Guardar / ver / rechazar contenido | ✅ | Favorita y Vista en Interstellar; "No me interesa" en la primera recomendación |
| 10 | Observar cambios posteriores en recomendaciones | ✅ | Al volver a Descubrir, la rechazada y la vista ya no aparecen y "Para vos" cambió |
| + | Modo sorpresa | ✅ | Devuelve una recomendación que no es la rechazada ni la vista |

### `PROJECT_CONTEXT.md` §8: métricas

| Métrica | Cumple | Evidencia |
|---|---|---|
| Onboarding completado | ✅ | Criterio 2 |
| Búsqueda funcional | ✅ | Criterio 3 |
| 10+ recomendaciones por usuario | ✅ | 36 por usuario (3 secciones × 12) |
| Recomendaciones con explicación | ✅ | Cada tarjeta tiene "¿Por qué?"; la sorpresa la muestra en el modal |
| Porcentaje controlado de títulos muy populares | ✅ | Tope por nivel en "Para vos" (`test_bucket_shares_in_for_you`); en la demo del explorador, "Para vos" tiene 4 `HIDDEN`, 4 `MEDIUM`, 4 `POPULAR` y ninguna `VERY_POPULAR` |
| Mapa generado desde una película | ✅ | Criterio 5 |
| Expansión sin recargar la página | ✅ | Criterio 7 |
| Like/dislike modifica recomendaciones | ✅ | Criterio 10 · `test_like_changes_the_ranking`, `test_dislike_excludes_the_title_and_lowers_its_genres` |
| Demo completa sin operaciones manuales | ✅ | `seed_demo` deja todo listo, incluidos los mapas del guion |

### `agents/QA_AGENT.md`: casos críticos

| Caso | Cumple | Tests |
|---|---|---|
| No recomendar watched | ✅ | `test_never_recommends_watched_disliked_or_avoided_genres`, `test_watched_is_excluded_on_the_next_get_without_refresh`, sorpresa: `test_never_watched_rejected_nor_the_previous_one` |
| No recomendar disliked | ✅ | Los mismos + `test_dislike_excludes_the_title_and_lowers_its_genres` |
| No duplicar watchlist | ✅ | `test_adding_twice_does_not_duplicate`, `test_database_rejects_duplicated_interactions` |
| Popularity penalty reduce score | ✅ | `test_popularity_penalty_lowers_the_score`, `test_popularity_penalty_grows_with_popularity_and_with_the_level` |
| Hidden gem preference aumenta novelty | ✅ | `test_explorer_increases_the_novelty_weight`, `test_explorer_shows_more_lesser_known_titles_than_familiar` |
| Feedback cambia perfil | ✅ | `test_like_changes_the_ranking`, `test_changing_preferences_regenerates` |
| Endpoint de usuario no filtra datos ajenos | ✅ | `test_users_never_see_each_others_lists`, `…_preferences`, `test_users_only_get_their_own_recommendations`, `test_users_only_get_their_own_surprise` |
| TMDB failure no rompe la API | ✅ | `test_tmdb_down_does_not_break_the_api`, `test_tmdb_down_without_credits_cache`, `seed_demo`: `test_tmdb_down_is_a_clear_error` |
| Onboarding incompleto → fallback explícito | ✅ | `test_fallback_when_onboarding_is_incomplete`, `test_completing_onboarding_leaves_the_fallback` |

### Reglas R1–R10

R1 no recomendar vistas ✅ · R2 no repetir rechazadas ✅ · R3 la popularidad no domina ✅ · R4 toda recomendación tiene motivo ✅ · R5 el mapa sólo muestra conexiones justificables ✅ · R6 cada arista indica su tipo ✅ (chip + color + trazo) · R7 expansión limitada (~50) ✅ · R8 el frontend no calcula recomendaciones ✅ (la sorpresa también se sortea en el backend) · R9 TMDB sólo desde el backend ✅ · R10 el historial modifica recomendaciones ✅.

### Lo que **no** cumple o queda parcial

| Punto | Estado | Detalle |
|---|---|---|
| Deploy (Railway / Vercel), EPIC 7 y `SPRINT_PLAN.md` | ❌ No hecho | No estaba en la lista de este sprint y no se agregó. Falta servidor WSGI (gunicorn), estáticos y variables de producción (deuda desde Sprint 0). El MVP corre local con Docker. |
| CI en GitHub sobre los sprints 2–5 | ⚠️ Parcial | `ci.yml` corre en `push` a `main` y en pull requests; las ramas de sprint nunca abrieron PR, así que la última corrida en GitHub es la de `main` (Sprint 1, ✅). Los mismos pasos pasan localmente. Abrir un PR de `feature/sprint-4-mapa` a `main` la dispara. |
| Especiales de TV en recomendaciones de usuarios nuevos | ⚠️ Parcial | TMDB cataloga algunos especiales (p. ej. *Doctor Who*) como películas de ciencia ficción y el recomendador los acepta. Los usuarios de demo lo tienen resuelto con datos; un usuario nuevo de ciencia ficción puede verlos (pasó en el QA). |
| Pósters del mapa en celular | ⚠️ Parcial | Con 12 vecinos se ven a ~53 px para que entren todos; se puede hacer zoom. |

## Decisiones técnicas

1. **La sorpresa usa la generación guardada, no un ranking nuevo.** Es instantánea, coherente con lo que el usuario ve en Descubrir y respeta todas las exclusiones del recomendador; el filtro extra de vistas/rechazadas cubre lo marcado después.
2. **Sorteo ponderado, no uniforme.** Una película mejor puntuada sale más seguido, y las `MEDIUM`/`HIDDEN` pesan el doble: cumple "priorizando" sin excluir las populares.
3. **"Nunca la anterior" se resuelve en el backend** con `exclude`, no en el cliente: la regla vive donde vive la lógica (R8).
4. **`Modal` como componente base nuevo** y el estado de la sorpresa en un provider: el sistema de diseño no tenía diálogo, y un modal dentro del botón del menú mobile se desmontaba al cerrarse el menú.
5. **Minimapa plegable en vez de reservar más espacio.** El espacio inicial ya se reservaba; reservar también para cualquier expansión achicaría todo el mapa.
6. **Curación de datos en vez de cambiar el recomendador** para los especiales de TV: el pedido era no agregar funcionalidades; queda como deuda con su causa.
7. **Usuarios de demo con dominio `.example`** (reservado por RFC 2606) y contraseña documentada sólo para el entorno local.

## Problemas encontrados

- **El primer recorrido del modal "repetía" la película**: era el script de verificación leyendo el título antes de que llegara la respuesta nueva; con la red observada, cada "Otra" manda el `exclude` correcto y nunca repite.
- **A 768 px el menú no entraba** desde que se sumó "Sorprendeme" (6 ítems): se pasó la fila completa a `lg`.
- **Los especiales de Doctor Who encabezaban la demo del explorador** aun evitando "Película de TV": TMDB no les pone ese género. Ver decisión 6.

## Deuda técnica

- Deploy y configuración de producción (gunicorn, estáticos, variables), desde Sprint 0.
- Tokens en `localStorage` (riesgo XSS), desde Sprint 0.
- El recomendador no distingue especiales de TV catalogados como películas.
- La sorpresa no guarda historial: "Otra" evita sólo la anterior, así que con pocas candidatas puede volver una de dos pasos atrás (el pedido era "ni la anterior").
- Mapa: posiciones no persistentes y sin navegación con flechas entre nodos (heredado de Sprint 4).

## Cierre del MVP

Los 10 criterios de aceptación, las métricas del MVP y los casos críticos de QA se cumplen y están verificados con tests y contra el stack real. Queda fuera el deploy, que no formaba parte de este sprint.

SPRINT_5_STATUS: COMPLETED
