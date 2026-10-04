# 🎬 MovieVerse — MVP IA-Ready

MovieVerse es una plataforma web para **descubrir películas de una forma distinta a los buscadores y plataformas tradicionales**.

El usuario puede recibir recomendaciones según sus gustos, pero el diferencial principal es un **Mapa Cinematográfico Interactivo**: una película aparece como nodo central y se conecta visualmente con otras por actores, directores, géneros, temáticas, sagas o similitud.

## Hipótesis del MVP

> Un usuario puede descubrir contenido cinematográfico relevante y menos obvio explorando conexiones entre películas, en lugar de depender solamente de rankings de popularidad.

## Diferenciales

1. **Mapa Cinematográfico Interactivo**
2. **Recomendaciones personalizadas con sesgo de descubrimiento**
3. **Modo sorpresa**
4. **Explicación del vínculo entre películas**

## Alcance realista del MVP

### Incluido

- registro/login;
- onboarding de preferencias;
- búsqueda de películas;
- detalle de película;
- favoritos, pendientes y vistas;
- recomendaciones personalizadas;
- penalización de contenido excesivamente popular;
- mapa interactivo de conexiones;
- conexiones por actor, director y género;
- modo sorpresa;
- consumo de TMDB;
- frontend desplegado;
- backend desplegado.

### Iteraciones posteriores

- series;
- estado de ánimo;
- maratones automáticas;
- estadísticas personales;
- logros;
- amigos/compatibilidad;
- camino cinematográfico entre dos películas;
- listas personalizadas múltiples;
- dónde verla;
- estrenos y novedades.

Estas funcionalidades están contempladas en producto, pero se dejan fuera del MVP para evitar sobrealcance académico.

---

# 🛠️ Guía técnica

## Estado actual

| Sprint | Contenido | Estado |
|---|---|---|
| 0 | Fundación: Django + React + PostgreSQL + JWT + CI | ver `docs/SPRINT_0_REPORT.md` |
| 1 | Catálogo: TMDB, búsqueda, detalle, reparto, cache local | ver `docs/SPRINT_1_REPORT.md` |
| 2 | Usuario: onboarding de preferencias, favoritas, pendientes, vistas, like/dislike | ver `docs/SPRINT_2_REPORT.md` |
| 3 | Recomendaciones: content-based + discovery re-ranking con explicaciones | ver `docs/SPRINT_3_REPORT.md` |

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | React 19 + Vite + TypeScript, Tailwind CSS 4, React Router, TanStack Query, React Hook Form + Zod, Lucide |
| Backend | Python 3.12+, Django 5.2, Django REST Framework, SimpleJWT, django-cors-headers |
| Base de datos | PostgreSQL 16 |
| API externa | TMDB (consumida **sólo** desde el backend) |
| Tests | pytest + pytest-django · Vitest + Testing Library |
| Calidad | Ruff · ESLint · `tsc` |
| CI | GitHub Actions (`.github/workflows/ci.yml`) |

Detalle y justificación: `docs/STACK.md`, `docs/ARCHITECTURE.md`.

## Requisitos

- Python **3.12+**
- Node.js **22.12+** (CI usa Node 24)
- Docker + Docker Compose (para PostgreSQL; opcional para el backend)
- Una API key de TMDB (gratuita: <https://www.themoviedb.org/settings/api>) — acepta API Key v3 o Read Access Token v4.

## Estructura

```text
.
├── backend/            Django (config/ + apps/ + tests/)
│   ├── config/settings/{base,development,production,test}.py
│   └── apps/{accounts,common,movies,preferences,interactions,recommendations,graph}
├── frontend/           React + Vite (src/{api,components,features,hooks,pages,types,utils})
├── docs/               Documentación IA-Ready (fuente de verdad)
├── agents/ prompts/    Guías para agentes
├── docker-compose.yml  PostgreSQL + backend
└── .env.example        Variables de entorno (backend + compose)
```

## Variables de entorno

Copiar los ejemplos y completar:

```bash
cp .env.example .env                    # backend + docker compose
cp frontend/.env.example frontend/.env  # frontend
```

| Variable | Dónde | Descripción |
|---|---|---|
| `DEBUG` | backend | `true` en desarrollo |
| `SECRET_KEY` | backend | obligatoria en producción (≥ 32 caracteres) |
| `DATABASE_URL` | backend | `postgres://user:pass@host:port/db` |
| `ALLOWED_HOSTS` | backend | hosts separados por coma |
| `CORS_ALLOWED_ORIGINS` | backend | orígenes del frontend separados por coma |
| `JWT_ACCESS_MINUTES` / `JWT_REFRESH_DAYS` | backend | vida de los tokens (15 min / 7 días por defecto) |
| `TMDB_API_KEY` | backend | **nunca** en el frontend |
| `TMDB_LANGUAGE` | backend | idioma de la metadata (`es-ES` por defecto) |
| `TMDB_TIMEOUT_SECONDS` | backend | timeout de cada request a TMDB (5 s) |
| `TMDB_CACHE_DAYS` | backend | días de validez de la metadata cacheada en PostgreSQL (7) |
| `POSTGRES_*` | compose | credenciales del Postgres local (sólo desarrollo) |
| `POSTGRES_HOST_PORT` / `BACKEND_HOST_PORT` | compose | puertos del host (cambiar si 5432/8000 están ocupados) |
| `VITE_API_URL` | frontend | URL de la API de MovieVerse, p. ej. `http://localhost:8000/api/v1` |

`.env` está en `.gitignore`: los secretos nunca se suben al repositorio.

## Levantar PostgreSQL

```bash
docker compose up -d db
```

## Levantar el backend

**Opción A — Docker (db + backend):**

```bash
docker compose up --build
# API en http://localhost:${BACKEND_HOST_PORT:-8000}/api/v1/health
```

El contenedor aplica las migraciones al iniciar.

**Opción B — local con venv (Postgres en Docker):**

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate    ·    Linux/macOS: source .venv/bin/activate
pip install -r requirements-dev.txt
python manage.py migrate
python manage.py createsuperuser   # opcional, para /admin
python manage.py runserver
```

## Levantar el frontend

```bash
cd frontend
npm ci
npm run dev        # http://localhost:5173
```

Si usás otro puerto, agregalo a `CORS_ALLOWED_ORIGINS` del backend.

## Tests y calidad

Backend (requiere PostgreSQL corriendo; los tests **no** acceden a internet — TMDB está mockeado):

```bash
cd backend
ruff check .
ruff format --check .
pytest
```

Frontend:

```bash
cd frontend
npm run lint
npm run test
npm run build
```

La CI ejecuta exactamente estos pasos en cada push/PR y falla si alguno falla.

## API

Base: `/api/v1`. Errores con formato `{"error": {"code", "message", "details?"}}`.

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/health` | — | estado de la API y la base de datos |
| POST | `/auth/register` | — | alta con email + password |
| POST | `/auth/login` | — | devuelve `access`, `refresh` y `user` |
| POST | `/auth/refresh` | — | renueva el access token (rota el refresh) |
| POST | `/auth/logout` | JWT | invalida el refresh token |
| GET | `/auth/me` | JWT | usuario autenticado |
| GET | `/movies/search?q=&page=` | JWT | búsqueda en TMDB, resultados persistidos localmente |
| GET | `/movies/{id}` | JWT | detalle (id local de MovieVerse) |
| GET | `/movies/{id}/credits` | JWT | director(es) y reparto principal (top 10) |
| GET / PUT | `/preferences` | JWT | preferencias del usuario (géneros, décadas, idiomas, nivel de descubrimiento) |
| POST | `/preferences/onboarding` | JWT | guarda el wizard + valoración rápida y marca el onboarding como completo |
| GET | `/preferences/options` | JWT | opciones del onboarding (géneros, décadas, idiomas, niveles) |
| GET | `/movies/onboarding-sample?genres=&avoid=` | JWT | títulos conocidos para la valoración rápida |
| GET / POST | `/movies/{id}/interactions` | JWT | estado del usuario para la película / activar favorita, pendiente, vista, like, dislike |
| DELETE | `/movies/{id}/interactions/{type}` | JWT | desactivar una de esas marcas |
| GET | `/me/favorites`, `/me/watchlist`, `/me/watched` | JWT | listas del usuario, paginadas |
| GET | `/recommendations` | JWT | recomendaciones en 3 secciones con score desglosado y explicación; se regeneran solas cuando cambia el feedback |
| POST | `/recommendations/refresh` | JWT | fuerza una nueva generación |

Contratos detallados: `docs/API_GUIDELINES.md`.

## Pantallas

| Ruta | Acceso | Contenido |
|---|---|---|
| `/` | pública | landing |
| `/login`, `/register` | sólo anónimos | formularios con validación Zod |
| `/search?q=` | privada | búsqueda con debounce, loading / vacío / error, paginación |
| `/onboarding` | privada | wizard de 6 pasos; al registrarse se llega acá; si ya se completó redirige a `/discover` |
| `/movies/:id` | privada | backdrop, póster, año, duración, géneros, rating, sinopsis, director, reparto; Favorita / Pendiente / Vista / Me gusta / No me interesa |
| `/discover` | privada | requiere onboarding completo; Para vos / Joyas para descubrir / Continuá explorando, con «¿Por qué?» y Refrescar |
| `/profile?tab=` | privada | tabs Favoritas / Pendientes / Vistas / Preferencias (editables) |

## Verificar la integración real con TMDB

Los tests usan TMDB mockeado. Para probar contra la API real:

1. Poner la key en `.env` (`TMDB_API_KEY=...`) y recrear el backend (`docker compose up -d --force-recreate backend`; `restart` no recarga `.env`).
2. Registrarse en el frontend, ir a **Buscar** y escribir `Interstellar`.
3. Abrir el resultado: debe mostrar a Christopher Nolan y el reparto. Una segunda visita no vuelve a pedir metadata a TMDB (cache de `TMDB_CACHE_DAYS` días).
