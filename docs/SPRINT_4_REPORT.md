# Sprint 4 Report

Fecha: 2026-10-04

## Objetivo

El diferencial de MovieVerse: un **mapa cinematográfico** navegable. Desde una película se ven sus conexiones verificables (mismo director, actores principales, similares de TMDB, géneros compartidos), se elige una y se sigue explorando desde ahí, sin recargar la página. Los caminos entre dos películas y las conexiones por temática o franquicia quedan en el roadmap.

## Features implementadas

| # | Objetivo | Estado |
|---|---|---|
| 4.1 | `GraphService` en `apps/graph` (sin Neo4j): vecindario a demanda desde PostgreSQL + TMDB | ✅ |
| 4.2 | `GET /api/v1/graph/movies/{id}?limit=12` → `{center, nodes, edges}` (+ `degraded`) | ✅ |
| 4.3 | Tipos DIRECTOR, ACTOR (5 principales), GENRE, SIMILAR (TMDB recommendations + similar) | ✅ |
| 4.4 | Strength 1,00 / 0,90 / 0,80 / 0,60 / 0,35 | ✅ |
| 4.5 | Candidatos → strength → sin duplicados → tipos combinados en una arista → orden → diversidad → top 8–12 | ✅ |
| 4.6 | Motivo legible y verificable por arista ("Dirigidas por Christopher Nolan", "Ambas con Matthew McConaughey", "Comparten Ciencia ficción y Drama") | ✅ |
| 4.7 | Caché local de películas, créditos y filmografías: expandir un nodo ya visto no llama a TMDB | ✅ |
| 4.8 | Ruta `/universe/:movieId`; "Explorar universo" habilitado en la ficha | ✅ |
| 4.9 | Fondo espacial, zoom, pan y minimapa discreto | ✅ |
| 4.10 | Nodos con póster, título y año; centro más grande, borde dorado y halo violeta | ✅ |
| 4.11 | Disposición radial, con las conexiones fuertes más cerca | ✅ |
| 4.12 | Aristas con color por tipo, grosor según strength y etiqueta al pasar el mouse | ✅ |
| 4.13 | Leyenda fija | ✅ |
| 4.14 | Panel lateral (hoja inferior en mobile): póster, sinopsis, puntaje, motivos, "Ver ficha" y "Expandir desde acá" | ✅ |
| 4.15 | Expandir: reutiliza nodos, agrega los nuevos animados y centra la vista con suavidad | ✅ |
| 4.16 | Tope de ~50 nodos con aviso y opción de limpiar; "Recentrar" y "Limpiar mapa" | ✅ |
| 4.17 | Miga de pan del recorrido para volver a un nodo anterior | ✅ |
| 4.18 | Estados de carga (estrellas apareciendo), error y vacío | ✅ |

## Backend: `GraphService`

```text
GraphService.neighborhood(movie_id, limit)
  ├─ centro: MovieService.get_details / get_credits   (404 si no existe; si TMDB cae, lo guardado)
  ├─ candidatos, en paralelo y cacheados en TMDBListCache:
  │   ├─ person:{id}:directed   filmografía como director de cada director   (/person/{id}/movie_credits)
  │   ├─ person:{id}:lead       películas donde cada uno de los 5 actores principales es principal (order < 5)
  │   ├─ recommendations:{id} y similar:{id}   (compartidas con el recomendador del Sprint 3)
  │   └─ locales: créditos ya sincronizados (MoviePerson) + hasta 40 películas conocidas (≥ 1.000 votos) con géneros en común
  ├─ por candidata: directores, actores, similar y géneros compartidos → motivos con su strength
  ├─ una arista por película: type = el motivo más fuerte; strength = máx + 0,05 por motivo extra (tope 1,0)
  ├─ orden: strength y, a igual fuerza, mejor rating ponderado y más votos
  ├─ diversidad: ≤ 1/2 de las aristas por tipo, ≤ 1/3 sólo por género, ≤ 4 películas por la misma persona;
  │             los topes sólo se relajan para llegar a 8 aristas
  └─ top limit (1–12, por defecto 12)
```

**Por qué la filmografía viene de TMDB.** Los créditos locales sólo existen para las películas que alguien ya abrió. Con ellos solamente, Interstellar no encontraría a *Inception* por Christopher Nolan. Por eso se pide `/person/{id}/movie_credits` (directores y los 5 actores principales del centro) y se guarda en `TMDBListCache`, igual que las listas del Sprint 3. Por persona se conservan sus 20 películas más votadas.

**"Actor principal".** Tiene que estar entre los 5 primeros del reparto en las **dos** películas. Así no aparecen conexiones por un cameo (el test `test_only_lead_actors_count` cubre el actor 13.º en la otra película y el 6.º actor del centro).

**Exclusiones.** El propio centro, películas con menos de 50 votos, sin fecha de estreno o sin estrenar (proyectos anunciados en las filmografías), créditos que no son de dirección (productor, guion) y "Película de TV" salvo que el centro lo sea.

**Etiquetas.** "Dirigidas por Christopher Nolan" · "Ambas con Anne Hathaway y Michael Caine" · "Similares según TMDB" · "Comparten Aventura, Ciencia ficción y Drama" (géneros en orden alfabético, para que la etiqueta sea estable). Todas se pueden verificar en la ficha de cada película.

**Fallas de TMDB.** Si el centro nunca se sincronizó, se usa la fila guardada. Si una filmografía o lista falla sin caché, se responde igual (200) con lo que haya y `degraded: true`. Nunca un 5xx.

### Ejemplo real (TMDB, 2026-10-04)

`GET /graph/movies/1` (Interstellar), 13 nodos:

| strength | tipos | película | motivo |
|---|---|---|---|
| 1,00 | DIRECTOR + ACTOR | El caballero oscuro (2008) | Dirigidas por Christopher Nolan · Ambas con Michael Caine |
| 1,00 | DIRECTOR + GENRE | Origen (2010) | Dirigidas por Christopher Nolan · Comparten Aventura y Ciencia ficción |
| 1,00 | DIRECTOR + ACTOR + GENRE | El truco final (2006) | Dirigidas por Christopher Nolan · Ambas con Michael Caine · Comparten Ciencia ficción y Drama |
| 1,00 | DIRECTOR | Memento (2000) | Dirigidas por Christopher Nolan |
| 0,95 | ACTOR + GENRE | El lobo de Wall Street (2013) | Ambas con Matthew McConaughey · Comparten Drama |
| 0,95 | ACTOR + GENRE | Marte (The Martian) (2015) | Ambas con Jessica Chastain · Comparten Aventura, Ciencia ficción y Drama |
| 0,95 | ACTOR + GENRE | Hijos de los hombres (2006) | Ambas con Michael Caine · Comparten Ciencia ficción |
| 0,85 | SIMILAR + GENRE | Proyecto Salvación (2026) | Similares según TMDB · Comparten Aventura y Ciencia ficción |
| … | | (12 aristas: 4 director, 6 actor, 2 similar) | |

Expandir desde *Origen* trae a Tom Hardy (*Mad Max: Furia en la carretera*, *Warrior*), Ken Watanabe (*The Creator*, *El último samurái*), Leonardo DiCaprio (*El renacido*, *Diamante de sangre*) y *Matrix* por similitud. Desde *Memento*: Joe Pantoliano (*Mentes en blanco*) y Guy Pearce (*L.A. Confidential*).

Tiempos: **1,30 s** con caché vacía (centro + créditos + filmografías + similares, en paralelo) y **0,09–0,17 s** después.

## Frontend: el mapa

- **Ruta** `/universe/:movieId`, cargada de forma diferida: React Flow va en un chunk propio de 199 kB y el bundle principal queda en 484 kB, sin aviso del build. "Explorar universo" en la ficha ahora es un link.
- **Pantalla inmersiva**: ocupa el viewport sin footer. Detrás está el `SpaceBackground` y encima una grilla de puntos que se mueve con el pan y el zoom, lo que da profundidad. El crédito de TMDB queda abajo al centro.
- **Nodos** (`MovieNode`): póster con título y año.
  - El centro es más grande, con borde **dorado**, halo violeta y título en Bebas Neue. El último nodo expandido lleva borde violeta.
  - Cada nodo es un `<button>` con `aria-label` "Título (año)", así que también se usan con teclado.
  - Al seleccionar uno, los no conectados se atenúan.
- **Disposición** (`graph.ts`, funciones puras):
  - Primer anillo en elipse: apaisada (×1,4) en escritorio y vertical (×0,8 / ×1,15) en teléfonos. Con las 12 conexiones habituales no quedan nodos superpuestos.
  - Radio según `strength`: las fuertes más cerca. Vecinos alternos 70 unidades más afuera para que no se toquen a los costados.
  - Al expandir, los nuevos se abren en un arco de 240° hacia afuera (lejos de donde vino el usuario). Si un lugar está ocupado, se busca en espiral el hueco libre más cercano. Los nodos existentes nunca se mueven.
- **Aristas** (`ConnectionEdge`):
  - Director dorado, actor azul, similar violeta y género gris azulado **punteado** (no depende sólo del color).
  - Grosor `1 + 3·strength`.
  - Al pasar el mouse, una píldora con el motivo más fuerte ("Dirigidas por Christopher Nolan · +1"), ubicada hacia la película vecina para que no quede tapada por el póster central.
  - Click en una arista → abre la película del otro extremo.
  - Aparecen con un fundido escalonado.
- **Leyenda** fija abajo a la izquierda. **Minimapa** abajo a la derecha, desde `md`.
- **Barra superior**: miga de pan del recorrido (Interstellar › Origen › Memento; cada paso vuelve a ese nodo) y herramientas: contador `n/50 películas`, acercar/alejar, **Recentrar** (vuelve al nodo inicial) y **Limpiar mapa** (vuelve al estado inicial).
- **Panel** (`NodePanel`): póster, título, año, ★ puntaje, sinopsis corta y la lista de conexiones con cada película del mapa ("Con Interstellar: Dirigidas por Christopher Nolan"). Botones "Expandir desde acá" (o "Centrar acá" si ya está expandida) y "Ver ficha". Es lateral desde `md` y una hoja inferior en mobile. Se cierra con Esc.
- **Expandir**: pide el vecindario con TanStack Query (cacheado 10 min) y lo fusiona: nodos existentes reutilizados, nuevos animados (`animate-node-in`, escalonados) y la vista se centra con `setCenter` en 800 ms. Muestra un mensaje ("8 películas nuevas conectadas con Origen.") que desaparece solo. Si falla, el mapa queda intacto y se avisa.
- **Tope de ~50 nodos**: al llegar aparece un aviso con "Limpiar mapa" y "Empezar desde {película}" (abre su propio universo), y expandir se deshabilita.
- **Estados**:
  - Carga: `StarsLoadingState`, una constelación cuyas estrellas se encienden de a una.
  - Error: con reintento.
  - Vacío: "Todavía no hay conexiones", con link a la ficha.
  - No encontrada: id inválido o 404.
  - Aviso si TMDB respondió degradado.
- **Sistema de diseño**:
  - Nuevos: `StarsLoadingState` y los tokens `animate-node-in`, `animate-edge-in` y `animate-star-in`.
  - El tema de React Flow está sobreescrito con tokens (`.mv-flow` en `index.css`).
  - Excepción documentada al uso del dorado: en el mapa marca la película central (la estrella) y las conexiones por director.
  - Todo respeta `prefers-reduced-motion` por la regla global.
- **Dependencia nueva**: `@xyflow/react` 12.12 (la que sugiere `SCREENS.md`).

## Tests

Ejecutados realmente:

```text
backend$ ruff check .                              → All checks passed!
backend$ ruff format --check .                     → 99 files already formatted
backend$ python manage.py makemigrations --check   → No changes detected
backend$ pytest                                    → 242 passed (216 Sprint 0–3 + 26 Sprint 4)
frontend$ npm run lint                             → OK (0 warnings)
frontend$ npm run typecheck                        → OK
frontend$ npm test                                 → 78 passed (55 Sprint 0–3 + 23 Sprint 4)
frontend$ npm run build                            → ✓ built (chunk del mapa separado)
```

Tests pedidos:

| Caso | Tests |
|---|---|
| No devuelve nodos duplicados | `test_no_duplicated_nodes_and_types_are_combined` (*The Dark Knight* por Nolan + Hathaway + Caine + Drama → un solo nodo y una sola arista con los tres tipos) |
| Respeta el límite | `test_respects_the_limit[1/3/5]`, `test_rejects_invalid_limits[0/13/abc]` |
| Cada arista tiene type y label | `test_every_edge_has_type_label_and_strength`, `test_response_format`, `test_readable_and_verifiable_labels` |
| Director pesa más que género | `test_director_connection_weighs_more_than_genre` (aunque la de género tenga 3 géneros y mejor nota), `test_strengths_by_type` |
| Id inválido → 404 | `test_unknown_movie_returns_404[999999/0]`, `test_non_numeric_id_returns_404` |
| Si TMDB falla, responde sin romperse | `test_tmdb_down_does_not_break_the_api` (200 + `degraded` + vecinos locales), `test_tmdb_down_without_credits_cache` |

También en backend: autenticación, sólo actores principales, exclusión de créditos que no son de dirección y de películas sin estrenar o de TV, diversidad (no todo por género, una persona no se lleva el mapa, relajación de topes), créditos locales y caché entre expansiones.

Frontend:

- **Funciones puras** (`graph.test.ts`): el centro en el origen, las más fuertes más cerca, sin superposición con 12 vecinos en las dos orientaciones, la fusión reutiliza y no mueve nodos, una arista por par (gana la más fuerte), apertura hacia afuera, sin superposición en un mapa lleno, la miga de pan y las etiquetas.
- **Página** (`universe.test.tsx`, con React Flow en jsdom): carga, nodos y leyenda, panel con motivo, puntaje y acciones, expansión que reutiliza nodos y actualiza el recorrido (Memento termina conectada con las dos), miga, limpiar, tope de 50, error al expandir sin perder el mapa, degradado, vacío, 404, id inválido y error con reintento.
- La ficha ahora enlaza al mapa.

## Verificación de punta a punta

Contra el stack real (Django en Docker + PostgreSQL + Vite + TMDB real), con Chrome headless y el usuario demo. Flujo pedido: **Interstellar → click en Inception → expandir → click en Memento**. 18/18 chequeos:

1. En la ficha de Interstellar, "Explorar universo" → `/universe/1`.
2. Mapa inicial: 13 nodos y **0 superposiciones** (medidas sobre las cajas reales del DOM).
3. Hover sobre una arista → "Dirigidas por Christopher Nolan · +1".
4. Click en **Origen (Inception)** → panel con "Dirigidas por Christopher Nolan", sinopsis, ★ 8.4, "Expandir desde acá" y "Ver ficha".
5. Expandir → 13 → 21 nodos, sin duplicados, miga "Interstellar › Origen" y mensaje "8 películas nuevas conectadas con Origen.".
6. Click en **Memento** → el panel la muestra conectada "Con Interstellar" y "Con Origen". Al expandirla, el recorrido queda "Interstellar › Origen › Memento".
7. La miga de pan vuelve a "Interstellar › Origen"; Recentrar vuelve al inicio; Limpiar mapa: 29 → 13 nodos.
8. Mobile (390 px): el panel es una hoja inferior a todo el ancho y no hay scroll horizontal.
9. Sin errores en consola.

## Decisiones técnicas

1. **Filmografías de TMDB cacheadas**, en vez de depender sólo de los créditos locales (ver arriba). Se comparten con el recomendador y cada persona cuesta una sola llamada.
2. **Aristas combinadas**: una por par de películas, con todos sus motivos y +0,05 por motivo extra (tope 1,0). La bonificación separa conexiones del mismo tipo base: un actor que además comparte géneros (0,95) queda por delante de uno sin más motivos (0,90). Las de director ya están en el tope, así que entre ellas desempata la nota ponderada.
3. **Diversidad con relajación hasta 8**: prefiero 10 conexiones variadas a 12 casi iguales. El pedido habla de "top 8-12".
4. **`limit` máximo 12**: `GRAPH_SPEC` y `ARCHITECTURE` hablan de "máximo 12 conexiones por expansión". Valores mayores dan 400 en vez de recortarse en silencio.
5. **Sólo aristas centro → vecino**: el endpoint devuelve el vecindario de un nodo. Las conexiones entre otros nodos aparecen cuando el usuario los expande; así el mapa crece por decisión del usuario y no se vuelve una maraña.
6. **El estado del mapa vive en React Flow** (`useNodesState`/`useEdgesState`) más un contexto chico (raíz, foco, selección, hover). La lógica de layout y fusión son funciones puras con tests propios.
7. **Limpiar = volver al estado inicial**, y **Recentrar = volver al nodo inicial** sin borrar nada. Para seguir explorando desde el foco al llegar al tope está "Empezar desde {película}".
8. **Dorado en el mapa**: el centro es "la estrella" y el director es la conexión más fuerte. Es una excepción documentada en `DESIGN_SYSTEM.md`, como pedía el sprint.

## Problemas encontrados

- **Hover de aristas sin respuesta**: con `elementsSelectable={false}` y sin `onEdgeClick`, React Flow marca las aristas como inactivas y les saca los eventos de puntero. Se agregó `onEdgeClick` (abre la película del otro extremo).
- **Superposición de nodos**: en la primera versión, con 12 vecinos en un círculo, los de los costados se pisaban (lo mostró la captura y lo confirmó la medición). Se pasó a una elipse con vecinos escalonados, comprobado con un test y con la medición del DOM.
- **Huecos en un mapa lleno**: un test encontró que la búsqueda de un lugar libre se rendía y superponía nodos. Se reemplazó por una búsqueda en espiral.
- **Etiqueta debajo del póster central**: el punto medio de la arista caía detrás del centro. La etiqueta va al 62 % hacia la película vecina, con `z-index` por encima de los nodos.
- **React Flow en jsdom**: necesita `ResizeObserver` con `contentRect`, `DOMMatrixReadOnly` y tamaños de elementos. Hay un mock reutilizable en `src/test/reactFlow.ts`.
- **Bundle de más de 500 kB** al sumar React Flow: el mapa se carga de forma diferida.

## Deuda técnica

- La filmografía se recorta a las 20 películas más votadas por persona: una conexión con una película menor de un director prolífico puede no aparecer.
- No se calculan conexiones entre vecinos (decisión 5). Si se quisiera, `GraphService` ya tiene los datos para hacerlo.
- Las posiciones no se guardan: recargar la página vuelve al mapa inicial.
- El layout es determinístico, sin simulación de fuerzas: con muchas expansiones en la misma zona, los nodos nuevos pueden quedar lejos.
- En mobile el mapa se ajusta a la pantalla y los pósters quedan chicos hasta hacer zoom (~45 px).
- Sin navegación por teclado entre nodos con flechas (sí con Tab).

## Preparación para Sprint 5

- **Modo sorpresa**: `RecommendationService.rank()` ya devuelve candidatos con score; falta el muestreo ponderado.
- **Demo**: el flujo Interstellar → Origen → Memento quedó verificado contra TMDB real y sirve para `DEMO_SCRIPT.md`.
- **Deploy**: el mapa ya es un chunk propio.

SPRINT_4_STATUS: COMPLETED
