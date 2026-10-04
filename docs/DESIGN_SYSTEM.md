# DESIGN_SYSTEM.md

Identidad visual de MovieVerse: **cinematográfico estilo Letterboxd/MUBI con un toque espacial**. Cada película es una estrella y el sitio es un universo. Fondo azul noche (nunca negro), azules y violetas como protagonistas y **dorado sólo como acento** (puntajes y estrellas).

> Frase de marca: **"Cada película es una estrella. Descubrí tu constelación."** (única fuente: `components/brand/tagline.ts`).

> Regla: toda pantalla nueva usa estos tokens y componentes. La paleta default de Tailwind está deshabilitada (`slate-*`, `violet-500`… no generan nada) y no se escriben hex sueltos en componentes.

## 1. Tokens (Tailwind v4, `frontend/src/index.css` → `@theme`)

### Color

| Token | Valor | Clase ejemplo | Uso |
| --- | --- | --- | --- |
| `deep` | `#0B1238` | `bg-deep` | Fondo más profundo: inputs, chips sobre pósters |
| `base` | `#0E1543` | `bg-base` | Fondo de página (body, SpaceBackground) |
| `raised` | `#141B52` | `bg-raised` | Superficies sólidas, hover de botón secundario |
| `surface` | `rgba(22,28,82,.62)` | `bg-surface` + `backdrop-blur-md` | Tarjetas translúcidas |
| `line` | `rgba(140,160,255,.22)` | `border-line` | Bordes por defecto |
| `line-strong` | `rgba(140,160,255,.38)` | `border-line-strong` | Bordes con énfasis (botón secundario, póster de detalle) |
| `focus` | `#A98DFF` | `border-focus`, `outline-focus` | Foco, hover activo |
| `fg` | `#EEF2FF` | `text-fg` | Texto principal y títulos |
| `fg-secondary` | `#C3CCF0` | `text-fg-secondary` | Párrafos, labels, nav inactivo |
| `fg-muted` | `#A9B4E0` | `text-fg-muted` | Metadatos, footer, placeholders |
| `label` | `#9FC0FF` | `text-label`, utility `eyebrow` | Etiquetas pequeñas en mayúsculas |
| `blue` | `#4F7DFF` | `from-blue` | Inicio del gradiente, glow azul |
| `sky` | `#6CC9FF` | `text-sky` | Mapa: conexiones por actor (celeste, bien distinto de los violetas) · mood "Para pensar" |
| `coral` | `#FF8A7A` | `text-coral` | Mapa: conexiones por saga y "Ver saga completa" · mood "Adrenalina" |
| `mint` | `#5FE0B8` | `text-mint` | Mapa: conexiones por universo compartido · mood "Para reír" |
| `violet` | `#8B5CFF` | `to-violet`, `bg-violet/15` | Fin del gradiente, fondos tenues |
| `violet-light` | `#A98DFF` | `text-violet-light` | "VERSE", segunda línea del claim, subrayado del nav |
| `violet-soft` | `#B39BFF` | `text-violet-soft` | Links, chips de género, íconos de estados vacíos |
| `gold` | `#F5C76B` | `text-gold` | **Sólo** puntajes (★), la estrella del logo y, en el mapa, la película central ("la estrella") y las conexiones por director (la más fuerte) |
| `crawl` | `#E9D7A0` | `text-crawl` | Texto de la intro |
| `danger` / `danger-strong` | `#FF9DB3` / `#F0517A` | `text-danger`, `border-danger-strong` | Errores |

Contraste sobre `base` (WCAG): `fg` 15.6:1, `fg-secondary` 10.9:1, `fg-muted` 8.5:1, `label` 9.5:1, `gold` 11:1, `violet-light` 6.6:1, `violet-soft` 7.5:1, `danger` 8.9:1: todos AA o mejor.

**Pendiente:** el texto blanco sobre el gradiente primario da 3.7:1 (`blue`) a 4.1:1 (`violet`): pasa AA sólo para texto grande (≥ 18.7 px bold), no para el texto de 14–16 px de los botones. Si se quiere AA completo, oscurecer levemente los extremos del gradiente (p. ej. `#3D6BF5 → #7F4DFA` da ≥ 4.5:1).

> ⚠️ Como existe el color `base`, **`text-base` es un color**, no el tamaño 16 px. Para 16 px usar **`text-md`**.

### Tipografía (Google Fonts, cargadas en `index.html`)

| Token | Familia | Clase | Uso |
| --- | --- | --- | --- |
| `--font-display` | Bebas Neue | `font-display` | Títulos (`h1`, `h2` de estados), logo, placeholder de póster. Siempre con `tracking-wide` y `leading-none`. |
| `--font-sans` | Manrope 400–800 | (default) | Todo el texto y la UI |
| `--font-crawl` | Barlow Condensed 500–600 | `font-crawl` | **Sólo** la intro |

Escala: `h1` de página `text-5xl sm:text-6xl` (`PageHeader`), detalle `text-5xl sm:text-7xl`, `h2` de estados/secciones `text-3xl` display; cuerpo `text-md`/`text-sm`; metadatos `text-xs`.

Etiquetas: utility **`eyebrow`** = 12 px, bold, mayúsculas, `letter-spacing: 4px`, color `label`.

### Radios

| Token | Valor | Clase | Uso |
| --- | --- | --- | --- |
| `--radius-control` | 12px | `rounded-control` | Inputs, botones, tooltips |
| `--radius-poster` | 14px | `rounded-poster` | Pósters |
| `--radius-card` | 20px | `rounded-card` | Tarjetas |

### Ancho

| Token | Valor | Clase | Uso |
| --- | --- | --- | --- |
| `--container-page` | 1600px | `max-w-page` | Columna principal (`PageContainer`, `Navbar`, heros): en pantallas grandes se aprovecha el ancho. Login/Registro siguen en `max-w-6xl`. Las grillas suman columnas: 6 desde `xl`, 7 desde `2xl`. |

### Sombras, utilities y animaciones

| Nombre | Uso |
| --- | --- |
| `shadow-glow` | Sombra violeta suave del botón primario |
| `shadow-glow-strong` | Hover de botón primario y de `MovieCard` |
| `shadow-halo` | Halo violeta: barra de búsqueda, foco de inputs, círculo de estados vacíos |
| `shadow-poster` / `shadow-card` | Profundidad de pósters y tarjetas |
| `bg-brand` | Gradiente horizontal `blue → violet` (botón primario) |
| `eyebrow` | Etiqueta pequeña en mayúsculas |
| `scrollbar-none` | Fila con scroll horizontal sin barra visible (tabs en mobile, carruseles); se sigue pudiendo deslizar |
| `bleed-right` | La fila se extiende desde su contenedor centrado hasta el borde derecho de la ventana (carruseles). `AppLayout` recorta el desborde horizontal (`overflow-x-clip`), así `100vw` nunca agrega scroll |
| `fade-right` | Máscara que desvanece el borde derecho de una fila desplazable ("hay más, deslizá") |
| `bg-ticket` | Dorso de las cartas de la sorpresa: patrón de estrellitas `violet-soft` / `fg` / `label` sobre `raised` con un tinte `blue → violet` |
| `bg-skeleton` | Superficie de los skeletons: bloque `raised` con un brillo `violet-soft` que lo recorre (con `animate-shimmer`) |
| `drop-shadow-planet` | Halo violeta alrededor del planeta |
| `animate-twinkle` · `animate-float` · `animate-comet` | Fondo espacial |
| `animate-fade-up` | Entrada de bloques (también cada paso del onboarding) |
| `animate-card-in` | Aparición escalonada de tarjetas (grillas, carruseles, moods): cada una con un `animation-delay` creciente, con tope para no hacer esperar |
| `animate-page-in` | Cambio de ruta: la página nueva aparece con un fundido (sólo opacidad: un `transform` volvería al contenedor el bloque de referencia de los overlays fijos) |
| `animate-shimmer` | Brillo que recorre los skeletons |
| `animate-hero-zoom` | Zoom lento (Ken Burns) del fondo del hero de la Home |
| `animate-node-in` · `animate-edge-in` | Mapa: una película "se enciende" en su lugar (escala + blur) y su conexión aparece en fundido, escalonadas según el orden de llegada |
| `animate-star-in` | Estrellas que aparecen una a una (`StarsLoadingState`) |
| `animate-ticket-in` | Las cartas de la sorpresa entran desde abajo (escala + subida), escalonadas |
| `animate-pop` | Pulso de 0,35 s del ícono de un `ToggleButton` al activarse |
| `animate-intro-*` | Timeline de la intro (3 s) |

`prefers-reduced-motion` anula todas las animaciones globalmente (`index.css`); además los cometas se ocultan y la intro se saltea.

## 2. Marca (`components/brand/`)

| Pieza | Uso |
| --- | --- |
| `Logo` | Claqueta + wordmark **MOVIE** (`fg`) **VERSE** (`violet-light`) en Bebas Neue, `tracking-[2px]`. `size="sm"` (header) · `"lg"` (intro). |
| `ClapperMark` | Sólo el ícono SVG: claqueta inclinada, franjas en gradiente azul→violeta, cuerpo azul marino con líneas claras y estrella dorada de 4 puntas. Mismo dibujo que `public/favicon.svg`. |
| `SpaceBackground` | Cielo reutilizable: 3 capas de estrellas (`box-shadow`, posiciones deterministas) con titileo, mancha azul arriba-izquierda y violeta abajo-derecha, 2 cometas en diagonal cada 9 s y **un solo planeta** por pantalla que flota (`src/assets/planeta.webp`), con una sombra radial `deep` (lado nocturno) que lo vuelve esfera. Prop `planet`: `"hero"` (≈420 px, Login/Registro/Intro), `"subtle"` (≈150 px, translúcido, resto de pantallas) o `"none"` (sólo cielo: el mapa, donde taparía los controles). Sin lunas ni planetas chicos desenfocados. `fixed` detrás del contenido; ya lo incluyen `AppLayout` (elige la variante según la ruta) e `IntroPage`. |
| `SideConstellation` | Constelación decorativa fija a la izquierda, detrás del contenido: 11 puntos `fg` (uno `violet-soft`) con halo `violet/20` que titilan desfasados, unidos por líneas finas `violet-light/40`; opacidad 35 % (55 % desde 1800 px, donde ocupa el margen vacío). Sólo desde `lg`; quieta con reduced-motion. La incluye `AppLayout` salvo en el mapa y Login/Registro. |
| `Constellation` | Mini constelación decorativa (Interstellar al centro con punto dorado, unida a Inception/Memento por DIRECTOR, Gravity por GÉNERO y The Martian por SIMILAR). En `AuthLayout`. |
| `TAGLINE` | `{ lead, accent }` del claim. |

### Planeta (`src/assets/planeta.webp`)

Generado desde `ImagenesReferencia/Planeta.png` (1254 px, 3,3 MB): 800 × 800 px, WebP calidad 80, ~154 KB, **con el fondo de espacio recortado** (alfa circular con borde difuminado), así que se funde con cualquier fondo sin máscara CSS. Decorativo: `alt=""`, `loading="lazy"`. Para regenerarlo:

```sh
ffmpeg -i ImagenesReferencia/Planeta.png -vf "scale=800:800:flags=lanczos,format=rgba,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='255*clip((354-hypot(X-404,Y-410))/34,0,1)'" -c:v libwebp -quality 80 -compression_level 6 frontend/src/assets/planeta.webp
```

## 3. Componentes base

| Componente | Archivo | API |
| --- | --- | --- |
| `Button` | `components/ui/Button.tsx` | `variant`: `primary` (gradiente, glow, brillo al hover) · `secondary` (translúcido con borde) · `ghost`; `size`: `sm` · `md` · `lg`. |
| `buttonClasses()` | `components/ui/buttonClasses.ts` | Las mismas clases para un `<Link>` que debe verse como botón. |
| `Card` | `components/ui/Card.tsx` | `variant`: `glass` (default, translúcida + blur) · `solid` · `outline`; `interactive` agrega borde violeta + glow al hover. Radio 20 px. |
| `Input` | `components/ui/Input.tsx` | Input sin label visible (siempre acompañarlo de un `<label>`, aunque sea `sr-only`). `icon`, `invalid`, `inputSize` (`md`/`lg`), `emphasis` (borde violeta con halo: barra de búsqueda). |
| `TextField` | `components/ui/TextField.tsx` | `Input` + `<label>` real + error accesible (`aria-describedby`). Para formularios. |
| `Tooltip` | `components/ui/Tooltip.tsx` | Tooltip hover/focus. Funciona con botones deshabilitados si el botón lleva `pointer-events-none`. |
| `Modal` | `components/ui/Modal.tsx` | `size`: `md` (672 px, default) · `lg` (1024 px, la sorpresa). Diálogo accesible (`role="dialog"`, `aria-modal`, `labelledBy` = id de su título) sobre un fondo `deep/80` con blur, en un portal. Se cierra con Esc, la ✕ o un clic afuera; mantiene el Tab adentro, enfoca su primer control (el ✕ va al final del DOM para que el foco caiga en las acciones) y devuelve el foco a quien lo abrió. Bloquea el scroll de la página. |
| `Skeleton` | `components/ui/Skeleton.tsx` | Placeholders con brillo (`bg-skeleton` + `animate-shimmer`) en lugar de spinners donde el contenido tiene forma conocida: `Skeleton` (bloque), `MovieCardSkeleton`, `MovieGridSkeleton` (mismas columnas que `MovieGrid`), `CarouselSkeleton` y `MovieDetailSkeleton`. Cada grupo lleva un `role="status"` con `aria-label` legible. `LoadingState` / `StarsLoadingState` quedan para esperas sin forma (sesión, mapa, sorpresa). |
| `Carousel` | `components/ui/Carousel.tsx` | Fila horizontal con título display (+ ícono y descripción opcionales, `action` a la derecha), flechas ‹ › que desplazan una "página" con scroll suave (instantáneo con reduced-motion) y se ocultan en los extremos y en pantallas táctiles, scroll-snap, sin barra visible y enfocable con teclado (`role="group"`). La fila arranca alineada con el título y llega hasta el borde derecho de la ventana (`bleed-right`), con un fundido a la derecha (`fade-right`) mientras quede algo por ver. |
| `InlineError` | `components/ui/InlineError.tsx` | Error compacto de una sección dentro de una página (una fila de carrusel): una línea con ícono y "Reintentar", donde un `ErrorState` sería demasiado grande. |
| `Chip` | `components/ui/Chip.tsx` | Toggle con forma de píldora para selección múltiple (géneros, décadas, idiomas). `selected` → `aria-pressed`; seleccionado: borde `violet-light`, fondo `violet/25` y `shadow-halo`. `tone="danger"` para elecciones negativas (géneros a evitar). `size="sm"` para grupos densos (filtros). |
| `ToggleButton` | `components/ui/ToggleButton.tsx` | Acción on/off con ícono (Favorita, Pendiente, Vista, Me gusta, No me interesa). `pressed` → `aria-pressed`; activo: mismo estilo que `Chip`, ícono relleno (`fillWhenPressed`, apagarlo en íconos como `Eye`) y `animate-pop`. `tone` `accent`/`danger`, `size` `sm`/`md`, `label` opcional (sin label, pasar `aria-label`). |
| `ChoiceCard` | `components/ui/ChoiceCard.tsx` | Opción única como tarjeta: `<input type="radio">` real (`sr-only`) dentro de un `<label>`; marcado: borde `violet-light` + halo. Agrupar en un `role="radiogroup"`. Nivel de descubrimiento. |
| `ProgressBar` | `components/ui/ProgressBar.tsx` | Pista fina con relleno `bg-brand`; `role="progressbar"` con `label` y `valueText` ("Paso 2 de 6"). |
| `Tabs` | `components/ui/Tabs.tsx` | Tabs WAI-ARIA (`tablist`/`tab`/`tabpanel`, ←/→/Inicio/Fin). Activa: subrayado `violet-light`. `count` opcional como badge. Sólo renderiza el panel activo (`children`). La línea de base es una sombra interior (no borde + margen negativo, que desbordaba 1 px y mostraba una barra vertical en Windows); en mobile se desliza en horizontal sin barra (`scrollbar-none`). |
| `Disclosure` | `components/ui/Disclosure.tsx` | Toggle chico (`aria-expanded` + `aria-controls`) que despliega un panel `raised` con borde `line-strong` debajo. `label` visible, `ariaLabel` para dar contexto ("¿Por qué Primer?"), `icon` opcional. Se usa para el "¿Por qué?" de las recomendaciones. |
| `Pagination` | `components/ui/Pagination.tsx` | "Anterior · Página X de Y · Siguiente"; no renderiza nada con una sola página. Búsqueda y listas del perfil. |
| `MovieCard` | `features/movies/components/MovieCard.tsx` | Póster 2:3 (radio 14 px, sombra); título, año y ★ puntaje dorado. Hover: sube 6 px, borde violeta con glow y chip "Explorar universo", que es un link propio a `/universe/:id` (siempre visible en pantallas táctiles). `destination="universe"`: toda la tarjeta lleva al mapa, con "Empezar acá" sobre el póster y sin chip (pantalla Universo). Sin póster: placeholder con gradiente y el título en Bebas Neue (`PosterImage`). Usar dentro de `MovieGrid`. |
| `MovieGrid` | `features/movies/components/MovieGrid.tsx` | Grilla responsive de `MovieCard`. `renderAction(movie)` opcional agrega un control debajo de cada tarjeta, fuera del link (p. ej. "Quitar" en el perfil). `destination` se pasa a cada `MovieCard`. Las tarjetas aparecen escalonadas (`animate-card-in`, 40 ms entre cada una, hasta 12). |
| `MovieCarousel` | `features/movies/components/MovieCarousel.tsx` | `Carousel` de `MovieCard` (36 → 48 de ancho según pantalla), con aparición escalonada; `movies` indefinido muestra `CarouselSkeleton` y `fallback` reemplaza la fila (p. ej. un `InlineError`). |
| `SearchAutocomplete` | `features/movies/components/SearchAutocomplete.tsx` | Campo de búsqueda con sugerencias (combobox WAI-ARIA): 300 ms después de escribir, hasta 6 películas con mini póster, título y año en un panel `base/95` con blur. Se abre al escribir (no al enfocar), ↑/↓ recorren, Enter abre la película resaltada, Escape cierra. Comparte caché con la grilla de resultados. |
| `MovieFilterPanel` | `features/movies/components/MovieFilterPanel.tsx` | Filtros de Buscar y Descubrir en una `Card`: botón "Filtros" (`aria-expanded`, contador de activos; abierto de entrada si la URL ya trae filtros) y "Limpiar filtros" (`ghost`). Grupos con `eyebrow`: Géneros (`Chip` `sm`, varios; la película debe tener todos), Década, Puntaje mínimo (★ `gold` 6+/7+/8+) y Duración (Menos de 90 min / Menos de 2 h); los tres últimos son de opción única con "Cualquiera". Estado en la URL (`genres`, `decade`, `rating`, `runtime`) vía `useFilterParams`: se puede compartir el link. |
| `FilteredMovies` | `features/movies/components/FilteredMovies.tsx` | Catálogo filtrado sin texto (`/movies/discover`): contador, `MovieGrid`, `Pagination`; sin coincidencias, `EmptyState` "Ninguna película coincide" con "Limpiar filtros". |
| `StarsLoadingState` | `components/ui/StarsLoadingState.tsx` | Carga temática: una constelación chica cuyas estrellas se encienden en secuencia (la central en dorado), con texto. Para el mapa. |
| `EmptyState` / `ErrorState` / `LoadingState` | `components/ui/` | Ícono en círculo con glow, título display, descripción y CTA (`children`). |

### Layout

| Componente | Archivo | Uso |
| --- | --- | --- |
| `AppLayout` | `components/layout/AppLayout.tsx` | `SpaceBackground` (+ `SideConstellation`) + header + footer con atribución de TMDB; recorta el desborde horizontal para los carruseles a sangre. Cada cambio de ruta aparece con `animate-page-in` y vuelve arriba de la página (los cambios sólo de query, como una búsqueda o un tab, conservan la posición). Envuelve todas las rutas salvo la intro. |
| `Navbar` | `components/layout/Navbar.tsx` | Header translúcido con blur y borde inferior. El logo lleva a `/`. Con sesión: Inicio (ícono `House`, activo sólo en `/`) / Buscar / Descubrir / Universo (ícono `Orbit`, activo también dentro de `/universe/:movieId`) / Mi perfil / Sorprendeme (ícono `Dices`, abre el modo sorpresa) / Salir (activo: fondo violeta tenue + subrayado `violet-light`); sin sesión sólo el logo. La fila completa se muestra desde `lg` (1024 px); por debajo, botón de menú (`aria-controls`) que despliega un `<nav aria-label="Menú">`. |
| `PageContainer` | `components/layout/PageContainer.tsx` | Ancho máximo `page` (1600 px) y padding estándar. |
| `PageHeader` | `components/layout/PageContainer.tsx` | `eyebrow` + `h1` en Bebas Neue + `description`. |
| `AuthLayout` | `components/layout/AuthLayout.tsx` | Login/Registro: pitch + constelación a la izquierda, tarjeta con el formulario a la derecha. Se apilan en mobile (la constelación se oculta < 640 px). |

## 4. Pantallas

| Ruta | Pantalla | Notas |
| --- | --- | --- |
| `/` | `HomeRoute` → `IntroPage` + `HomePage` | **Intro** (una vez por sesión, encima de la página): 3 s, logo con zoom que se desvanece → crawl en perspectiva (`rotateX(26deg)`, Barlow Condensed, `crawl`); "Saltar intro ›" o Esc; con reduced-motion se saltea. Sólo el estilo de un crawl de ciencia ficción: sin logos, tipografías ni música de terceros. Después, sin sesión → `/login`; con sesión (y onboarding completo) → **Home**: `h1` oculto, hero a todo el ancho con el backdrop de 4 películas en tendencia (degradados hacia `base` abajo y a la izquierda, eyebrow "Tendencia de la semana", título display grande, año, ★ dorado, sinopsis de 3 líneas, "Ver ficha" `primary` y "Explorar universo" `secondary`, puntitos de navegación; rota cada 7 s con fundido de 1 s y zoom lento, se pausa con hover o foco y no rota con reduced-motion), "¿Cómo te sentís hoy?" (6 tarjetas de mood en 2 columnas / 3 desde `lg`: ícono en círculo, título display, frase, tinte y borde de su color y un glow de ese color al hover/foco; colores: Para reír `mint`, Para pensar `sky`, Adrenalina `coral`, Para llorar `blue`, Inspiradora `violet-light`, Miedo `danger`) y los carruseles "Tendencias de la semana", "Para vos" (con "Ver todas" → Descubrir) y "Seguí explorando" (últimas películas abiertas en el mapa, guardadas en este navegador; si no hay, no se muestra). |
| `/mood/:slug` | `MoodPage` | Encabezado en una tarjeta con el tinte del mood (ícono grande, eyebrow "Según tu ánimo", título y descripción que manda el backend), chips para saltar a los otros 5 moods, `MovieGrid` con skeleton, aviso si TMDB no respondió y vino del catálogo local, `Pagination` (hasta 5 páginas). Slug inexistente: `EmptyState` con vuelta al inicio. |
| `/login`, `/register` | `AuthLayout` | "Iniciá sesión / Tu universo te está esperando." · botón "Entrar al universo". |
| `/search` | `SearchPage` | Eyebrow "EXPLORAR", `SearchAutocomplete` grande con `emphasis`, `MovieFilterPanel`, contador, `MovieGrid`. Con texto y filtros, el backend filtra los resultados ("N resultados para “x” con estos filtros"). Sin texto pero con filtros: `FilteredMovies`. Sin texto ni filtros: carruseles "Tendencias de la semana" y "Para vos" en lugar de un estado vacío. |
| `/onboarding` | `OnboardingPage` | `PageHeader` "Armá tu constelación" + `Card` con eyebrow "Paso X de 6", `ProgressBar`, título del paso en display (recibe el foco al cambiar de paso), contenido y pie con Atrás (`secondary`) / Siguiente o Terminar (`primary`). Pasos con `Chip`, `ChoiceCard` y, en la valoración rápida, pósters con dos `ToggleButton` de sólo ícono. |
| `/movies/:id` | `MovieDetailPage` | Backdrop a lo ancho con máscara/degradado hacia `base`, póster, título display, puntaje dorado, año · duración · idioma, chips de género, sinopsis, "Explorar universo" (link a `/universe/:id`), fila de `ToggleButton` (Favorita · Pendiente · Vista · Me gusta · No me interesa) con mensaje de confirmación en `violet-soft` (`role="status"`), reparto en fila horizontal con scroll, enfocable (`tabIndex=0`, `aria-label`) para desplazarla con el teclado. |
| `/profile` | `ProfilePage` | Avatar + `h1`, `Tabs` Favoritas / Pendientes / Vistas (con contador) / Preferencias. Listas: `MovieGrid` con "Quitar" (`ghost`) + `Pagination`; vacías: `EmptyState` en `Card` con CTA a Buscar. Preferencias: secciones con `eyebrow` y los mismos selectores del onboarding. |
| `/universe` | `UniverseStartPage` | Entrada al mapa: `PageHeader` "Explorá el universo" + buscador grande (`emphasis`, ícono `Orbit`) para elegir la película de inicio. Sin búsqueda: "Empezá desde tus favoritas" (favoritas + «Me gusta», sin repetidas) o, si no hay, "Películas para empezar" (muy conocidas, de `/movies/onboarding-sample`). Todas las tarjetas son `MovieCard` con `destination="universe"`. |
| `/universe/:movieId` | `UniversePage` | Pantalla inmersiva: ocupa el viewport sin footer (el crédito de TMDB queda abajo al centro), con el `SpaceBackground` sin planetas detrás y una grilla de puntos `violet-soft` que se mueve con el pan/zoom. **Nodos**: póster `rounded-poster` (vecinos 90 px, foco 104 px, centro 150 px en unidades del mapa) con título (`text-md` bold; el centro en display) y año sobre una píldora `deep/70` con blur para que se lean sobre las aristas; el centro más grande, con **borde dorado** y `shadow-halo`; el foco actual (último expandido) con borde `violet-light`; los vecinos con `shadow-glow`. Al pasar el mouse sobre una película (o al seleccionarla) se resaltan sus aristas y sus chips y el resto se atenúa. **Aristas** (`connectionStyles.ts`; nunca sólo por color): saga `coral` sólido y el más grueso (ícono `Library`), universo `mint` en trazos largos (`Atom`), director `gold` sólido (`Clapperboard`), actor `sky` sólido (`Drama`), similar `violet-light` punteado (`Sparkles`) y género `fg-muted` discontinuo y el más fino (`Tag`); el grosor crece con `strength`. **Chips**: en cada arista, píldora `deep/90` con el ícono del tipo y sólo el nombre del motivo principal (`reasons[0].short`: "Saga Harry Potter", "Universo Marvel", "Mike Newell", "Michael Gambon", "Similar", "Fantasía"), sin cortar nunca; el `Tooltip` del chip y el panel lateral muestran todos los motivos completos ("Ambas con Michael Gambon · Comparten Fantasía"). Van sobre el tramo visible de la línea (entre las dos cajas); `chipLayout` les busca lugar de la más fuerte a la más débil y sólo se muestran los que no pisan otro chip ni un póster (con una película resaltada, se calcula un layout sólo con sus chips); el resto aparece al pasar el mouse por su línea. **Saga**: en el panel del nodo central, si faltan películas de su saga, botón `secondary` "Ver saga completa (8)" (ícono `Library` coral) que las suma al mapa. **Zonas**: los vecinos se ordenan por tipo (saga, universo, director, actor, similar, género) alrededor del centro, así cada tipo ocupa su sector. **Disposición inicial**: elipse con el aspecto de la pantalla, espaciada por longitud de arco en "cajas" de nodo (póster + título) y agrandada sólo hasta que nada se superpone; si queda baja, deja libre la franja encima y debajo del centro. En teléfonos, tres columnas compactas. El centro reserva dos líneas de título si su nombre es largo. El encuadre deja lugar arriba para la barra; si después la leyenda o el minimapa tapan una película, se reencuadra reservando la franja de abajo o los costados (lo que deje los pósters más grandes). **Leyenda** (`MapLegend`): `Card` translúcida abajo a la izquierda, en dos columnas (los 6 tipos en 3 filas, nunca más alta que el mapa), que dibuja los mismos trazos e íconos; cada tipo es un botón (`aria-pressed`) que muestra u oculta esas aristas (las películas que quedan sin conexiones visibles se atenúan); el rótulo "Conexiones" la colapsa (en mobile empieza colapsada). Miga de pan y herramientas en una sola fila de píldoras arriba, minimapa abajo a la derecha (sólo desde `md`), plegable con el botón de su esquina ("Ocultar minimapa" / "Minimapa") para que nunca tape una película después de expandir. Teclado: Tab recorre los pósters (botones); las aristas y los contenedores de nodo no son paradas de Tab. **Panel**: lateral `w-96` desde `md`, hoja inferior (`rounded-t-card`, máx. 62 % de alto) en mobile. Tema de React Flow sobreescrito con tokens en `index.css` (`.mv-flow`). |
| `/discover` | `DiscoverPage` | `PageHeader` + "Sorprendeme" (`primary`, abre el modo sorpresa) y "Refrescar" (`secondary`, ícono que gira mientras actualiza). `MovieFilterPanel` debajo; con algún filtro, `FilteredMovies` reemplaza las secciones hasta limpiarlos. Aviso de fallback/degradado en una `Card` `solid`. Tres `RecommendationSection` (ícono en círculo violeta + `h2` display + descripción + `MovieGrid` con un `Disclosure` "¿Por qué?" por card); una sección vacía muestra un texto en un recuadro punteado. Todo vacío: `EmptyState` con CTA a Buscar. |
| Modo sorpresa | `features/recommendations/components/Surprise.tsx` | `SurpriseProvider` (en `AppLayout`) es dueño del `Modal` (`size="lg"`), así cualquier `SurpriseButton` lo abre, también desde el menú mobile que se cierra al tocarlo. Contenido: halo `violet`/`blue` difuminado, eyebrow "Tu sorpresa", `h2` "Elegí tu función" y **3 cartas boca abajo** con estilo de entrada de cine (dorso `bg-ticket`: "Entrada · Función N", `ClapperMark` en un círculo con `shadow-halo`, wordmark, perforación punteada con muescas y "Admite uno · Nº 00N") que entran con `animate-ticket-in` y **se dan vuelta una por una** con un giro 3D (`perspective-distant`, `transform-3d`, `rotate-y-180` → `rotate-y-0`, 0,7 s; la primera a los 450 ms y luego cada 420 ms). Frente: póster, título display, año · ★ puntaje (`gold`) · píldora del bucket y recuadro "¿Por qué?" (3 líneas). El frente es `inert` hasta girar. Clic en una carta (botón con `aria-pressed`): borde `violet-light` + `shadow-halo`, "¿Por qué?" completo y botones "Ver ficha" (`primary`) y "Explorar universo" (`secondary`); las otras se atenúan. "Otras 3" (`secondary`) pide una tanda nueva excluyendo la actual. En mobile las cartas se apilan con el póster a la izquierda. Con reduced-motion se muestran todas de frente, sin giro. Estados: `StarsLoadingState`, `EmptyState` (sin candidatas, CTA a Buscar) y `ErrorState` con reintento. |
| `*` | `NotFoundPage` | 404 espacial: constelación SVG con una estrella faltante (enlace punteado y "?"), eyebrow "Error 404 · Fuera del mapa", `h1` "Te perdiste en el espacio" y botones a Descubrir y Buscar (sin sesión, a iniciar sesión). |

## 5. Cómo armar una pantalla nueva

```tsx
<PageContainer className="flex flex-col gap-8">
  <PageHeader eyebrow="Tu universo" title="Favoritas" description="…" />
  <MovieGrid movies={movies} />
  <Button variant="secondary">Ver más</Button>
</PageContainer>
```

Checklist:

- [ ] Sólo tokens: `bg-surface`, `text-fg-secondary`, `border-line`, `violet-*`, `gold`… nada de paleta default ni `#hex`.
- [ ] Botones con `Button`/`buttonClasses()`; inputs con `TextField` (o `Input` + `<label>`); contenedores con `Card`.
- [ ] Un único `h1` por página (`PageHeader` o el hero), en `font-display`.
- [ ] Dorado sólo para puntajes/estrellas.
- [ ] Estados de carga, vacío y error con `LoadingState` / `EmptyState` / `ErrorState`.
- [ ] Foco visible (`outline-focus`) y contraste AA.
- [ ] Animaciones nuevas con `motion-reduce:` o cubiertas por la regla global.
- [ ] Revisar en 390 px, 1440 px y 1920 px.

## 6. Cambiar o agregar un token

1. Editarlo en `@theme` de `frontend/src/index.css`.
2. Documentarlo en este archivo.
3. Si es un patrón repetido, crear un componente en `components/ui` antes que copiar clases.
4. Ojo con nombres que choquen con utilities de Tailwind (ver la nota de `text-base`). Los modificadores de opacidad deben ser múltiplos de 5 (`/15`, `/20`…).
