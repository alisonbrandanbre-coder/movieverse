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
| `violet` | `#8B5CFF` | `to-violet`, `bg-violet/15` | Fin del gradiente, fondos tenues |
| `violet-light` | `#A98DFF` | `text-violet-light` | "VERSE", segunda línea del claim, subrayado del nav |
| `violet-soft` | `#B39BFF` | `text-violet-soft` | Links, chips de género, íconos de estados vacíos |
| `gold` | `#F5C76B` | `text-gold` | **Sólo** puntajes (★) y la estrella del logo |
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

### Sombras, utilities y animaciones

| Nombre | Uso |
| --- | --- |
| `shadow-glow` | Sombra violeta suave del botón primario |
| `shadow-glow-strong` | Hover de botón primario y de `MovieCard` |
| `shadow-halo` | Halo violeta: barra de búsqueda, foco de inputs, círculo de estados vacíos |
| `shadow-poster` / `shadow-card` | Profundidad de pósters y tarjetas |
| `bg-brand` | Gradiente horizontal `blue → violet` (botón primario) |
| `eyebrow` | Etiqueta pequeña en mayúsculas |
| `planet` | Planeta azul del fondo |
| `animate-twinkle` · `animate-float` · `animate-comet` | Fondo espacial |
| `animate-fade-up` | Entrada de bloques |
| `animate-intro-*` | Timeline de la intro (3 s) |

`prefers-reduced-motion` anula todas las animaciones globalmente (`index.css`); además los cometas se ocultan y la intro se saltea.

## 2. Marca (`components/brand/`)

| Pieza | Uso |
| --- | --- |
| `Logo` | Claqueta + wordmark **MOVIE** (`fg`) **VERSE** (`violet-light`) en Bebas Neue, `tracking-[2px]`. `size="sm"` (header) · `"lg"` (intro). |
| `ClapperMark` | Sólo el ícono SVG: claqueta inclinada, franjas en gradiente azul→violeta, cuerpo azul marino con líneas claras y estrella dorada de 4 puntas. Mismo dibujo que `public/favicon.svg`. |
| `SpaceBackground` | Cielo reutilizable: 3 capas de estrellas (`box-shadow`, posiciones deterministas) con titileo, mancha azul arriba-izquierda y violeta abajo-derecha, 2 cometas en diagonal cada 9 s y un planeta que flota. `fixed` detrás del contenido; ya lo incluyen `AppLayout` e `IntroPage`. |
| `Constellation` | Mini constelación decorativa (Interstellar al centro con punto dorado, unida a Inception/Memento por DIRECTOR, Gravity por GÉNERO y The Martian por SIMILAR). En `AuthLayout`. |
| `TAGLINE` | `{ lead, accent }` del claim. |

## 3. Componentes base

| Componente | Archivo | API |
| --- | --- | --- |
| `Button` | `components/ui/Button.tsx` | `variant`: `primary` (gradiente, glow, brillo al hover) · `secondary` (translúcido con borde) · `ghost`; `size`: `sm` · `md` · `lg`. |
| `buttonClasses()` | `components/ui/buttonClasses.ts` | Las mismas clases para un `<Link>` que debe verse como botón. |
| `Card` | `components/ui/Card.tsx` | `variant`: `glass` (default, translúcida + blur) · `solid` · `outline`; `interactive` agrega borde violeta + glow al hover. Radio 20 px. |
| `Input` | `components/ui/Input.tsx` | Input sin label visible (siempre acompañarlo de un `<label>`, aunque sea `sr-only`). `icon`, `invalid`, `inputSize` (`md`/`lg`), `emphasis` (borde violeta con halo: barra de búsqueda). |
| `TextField` | `components/ui/TextField.tsx` | `Input` + `<label>` real + error accesible (`aria-describedby`). Para formularios. |
| `Tooltip` | `components/ui/Tooltip.tsx` | Tooltip hover/focus. Funciona con botones deshabilitados si el botón lleva `pointer-events-none`. |
| `MovieCard` | `features/movies/components/MovieCard.tsx` | Póster 2:3 (radio 14 px, sombra); título, año y ★ puntaje dorado. Hover: sube 6 px, borde violeta con glow y chip "Explorar universo". Sin póster: placeholder con gradiente y el título en Bebas Neue (`PosterImage`). Usar dentro de `MovieGrid`. |
| `EmptyState` / `ErrorState` / `LoadingState` | `components/ui/` | Ícono en círculo con glow, título display, descripción y CTA (`children`). |

### Layout

| Componente | Archivo | Uso |
| --- | --- | --- |
| `AppLayout` | `components/layout/AppLayout.tsx` | `SpaceBackground` + header + footer con atribución de TMDB. Envuelve todas las rutas salvo la intro. |
| `Navbar` | `components/layout/Navbar.tsx` | Header translúcido con blur y borde inferior. Con sesión: Buscar / Descubrir / Mi perfil / Salir (activo: fondo violeta tenue + subrayado `violet-light`); sin sesión sólo el logo. Menú hamburguesa en mobile. |
| `PageContainer` | `components/layout/PageContainer.tsx` | Ancho máximo `6xl` y padding estándar. |
| `PageHeader` | `components/layout/PageContainer.tsx` | `eyebrow` + `h1` en Bebas Neue + `description`. |
| `AuthLayout` | `components/layout/AuthLayout.tsx` | Login/Registro: pitch + constelación a la izquierda, tarjeta con el formulario a la derecha. Se apilan en mobile (la constelación se oculta < 640 px). |

## 4. Pantallas

| Ruta | Pantalla | Notas |
| --- | --- | --- |
| `/` | `IntroPage` | 3 s: logo con zoom que se desvanece → crawl en perspectiva (`rotateX(26deg)`, Barlow Condensed, `crawl`) → redirige a `/login` o `/discover`. "Saltar intro ›" (o Esc). Una vez por sesión (`sessionStorage["mv:intro-seen"]`); con reduced-motion se saltea. Sólo el estilo de un crawl de ciencia ficción: sin logos, tipografías ni música de terceros. |
| `/login`, `/register` | `AuthLayout` | "Iniciá sesión / Tu universo te está esperando." · botón "Entrar al universo". |
| `/search` | `SearchPage` | Eyebrow "EXPLORAR", barra grande con `emphasis`, contador, `MovieGrid`. |
| `/movies/:id` | `MovieDetailPage` | Backdrop a lo ancho con máscara/degradado hacia `base`, póster, título display, puntaje dorado, año · duración · idioma, chips de género, sinopsis, "Explorar universo" (deshabilitado con tooltip "Próximamente"), reparto en fila horizontal con scroll. |
| `/discover`, `/profile` | — | `PageHeader` + `EmptyState` con CTA dentro de una `Card`. |

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
- [ ] Revisar en 390 px y en 1440 px.

## 6. Cambiar o agregar un token

1. Editarlo en `@theme` de `frontend/src/index.css`.
2. Documentarlo en este archivo.
3. Si es un patrón repetido, crear un componente en `components/ui` antes que copiar clases.
4. Ojo con nombres que choquen con utilities de Tailwind (ver la nota de `text-base`). Los modificadores de opacidad deben ser múltiplos de 5 (`/15`, `/20`…).
