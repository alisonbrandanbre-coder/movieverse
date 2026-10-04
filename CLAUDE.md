# CLAUDE.md

MovieVerse: descubrimiento de películas por conexiones. Backend Django (`backend/`), frontend React + Vite + TS + Tailwind v4 (`frontend/`). Contexto y reglas en `docs/` (empezar por `docs/PROJECT_CONTEXT.md` y `docs/RULES.md`).

## Frontend: sistema de diseño (obligatorio)

Toda pantalla o componente nuevo **debe** usar los componentes y tokens del sistema de diseño documentado en `docs/DESIGN_SYSTEM.md` (azul noche + azules/violetas, dorado sólo para puntajes; Bebas Neue para títulos, Manrope para UI):

- **Tokens**: sólo los definidos en `@theme` de `frontend/src/index.css`: fondos `deep` / `base` / `raised` / `surface`, bordes `line` / `line-strong` / `focus`, texto `fg` / `fg-secondary` / `fg-muted` / `label`, acentos `blue` / `violet` / `violet-light` / `violet-soft` / `gold`, radios `rounded-control` (12) / `rounded-poster` (14) / `rounded-card` (20), sombras `shadow-glow` / `shadow-halo`…, utilities `eyebrow` y `bg-brand`. La paleta default de Tailwind está deshabilitada y no se usan hex sueltos en componentes. Ojo: `text-base` es un color; el tamaño 16 px es `text-md`.
- **Componentes base**: `Button` / `buttonClasses`, `Card`, `Input`, `TextField` (inputs siempre con `<label>` real), `Tooltip`, `Chip` (selección múltiple), `ToggleButton` (acciones on/off), `ChoiceCard` (opción única), `ProgressBar`, `Tabs`, `Pagination`, `Disclosure` ("¿Por qué?"), `MovieCard` (+ `MovieGrid`), `EmptyState` / `ErrorState` / `LoadingState`.
- **Layout**: `AppLayout` (ya incluye `SpaceBackground`, header y footer TMDB), `PageContainer` + `PageHeader`, `AuthLayout`.
- **Marca**: `Logo` / `ClapperMark`, `SpaceBackground`, `Constellation` y `TAGLINE` desde `components/brand/`.

Si una pantalla necesita algo que no existe, se crea primero como componente base o token y se documenta en `docs/DESIGN_SYSTEM.md`; no se resuelve con clases ad hoc. Toda animación nueva respeta `prefers-reduced-motion`.

## Comandos (desde `frontend/`)

- `npm test`: Vitest
- `npm run lint`: ESLint con `--max-warnings 0`
- `npm run typecheck`
- `npm run build`
