# Sprint 0 Report

Fecha: 2026-09-30

## Objetivos completados

| # | Objetivo | Estado | Evidencia |
|---|---|---|---|
| 0.1 | Repositorio (`backend/`, `frontend/`, `.gitignore`, `.env.example`, `docker-compose.yml`, README) | ✅ | `git check-ignore .env` confirma que `.env` está ignorado |
| 0.2 | Backend Django 5.2 + DRF + SimpleJWT + cors-headers + psycopg 3 + python-dotenv + requests + pytest + ruff | ✅ | `backend/requirements*.txt` |
| 0.3 | Apps `accounts, preferences, movies, interactions, recommendations, graph, common` | ✅ | sólo `accounts` y `common` con lógica; el resto preparado |
| 0.4 | Settings por entorno `base / development / production / test` | ✅ | `backend/config/settings/` |
| 0.5 | PostgreSQL 16 vía Docker Compose (`db` + `backend`) | ✅ | `docker compose up` → ambos servicios `healthy` |
| 0.6 | Custom User por email | ✅ | `apps/accounts/models.py`, migración `0001_initial` |
| 0.7 | JWT: register / login / refresh / logout / me | ✅ | tests + smoke test con curl contra el contenedor |
| 0.8 | `GET /api/v1/health` con chequeo de DB | ✅ | `{"status":"ok","database":"ok"}` (200) / 503 si la DB cae |
| 0.9 | CORS restringido por `CORS_ALLOWED_ORIGINS` | ✅ | origen permitido recibe `Access-Control-Allow-Origin`; origen ajeno no |
| 0.10 | Frontend React + Vite + TS + Tailwind + Router + TanStack Query + RHF + Zod + Lucide | ✅ | `frontend/package.json` |
| 0.11 | Rutas `/`, `/login`, `/register`, `/discover`, `/movies/:id`, `/profile` | ✅ | `src/AppRoutes.tsx` (placeholders en discover/detail/profile) |
| 0.12 | Cliente HTTP centralizado con `VITE_API_URL` | ✅ | `src/api/client.ts` |
| 0.13 | Login, Register, Logout, sesión, `ProtectedRoute` | ✅ | `src/features/auth/` |
| 0.14 | Módulo único de tokens + refresh single-flight | ✅ | `src/features/auth/session.ts` + `client.ts` |
| 0.15 | Layout: Navbar responsive (Buscar, Descubrir, Mi perfil, Salir) | ✅ | `src/components/layout/` |
| 0.16 | Estado: TanStack Query (server) + Context (auth) + local state | ✅ | sin Redux |
| 0.17 | Tests backend | ✅ | 23 tests |
| 0.18 | Tests frontend | ✅ | 10 tests |
| 0.19 | GitHub Actions | ✅ | `.github/workflows/ci.yml` (no ejecutado en GitHub: el repo aún no tiene remoto) |
| 0.20 | README | ✅ | `README.md` |

## Arquitectura resultante

```text
React (Vite, :5173)
  │  fetch + JWT (src/api/client.ts)
  ▼
/api/v1  ── DRF Views (finas)
              │
              ▼
          Services (AccountService)
              │
              ▼
          Django ORM ── PostgreSQL 16
```

- Monolito modular (`backend/apps/*`), sin microservicios.
- Errores uniformes `{"error": {"code", "message", "details?"}}` mediante `apps.common.exceptions.api_exception_handler`; nunca se expone un traceback.
- Permiso por defecto `IsAuthenticated`; sólo `health`, `register`, `login` y `refresh` son públicos.
- Throttling por scope `auth` (20/min) en register/login/refresh (rate limit de login pedido en `ARCHITECTURE.md`).

## Endpoints

| Método | Ruta | Auth | Respuesta |
|---|---|---|---|
| GET | `/api/v1/health` | — | `200 {"status":"ok","database":"ok"}` · `503` si la DB no responde |
| POST | `/api/v1/auth/register` | — | `201 {"id","email"}` · `400 VALIDATION_ERROR` · `409 EMAIL_ALREADY_REGISTERED` |
| POST | `/api/v1/auth/login` | — | `200 {"access","refresh","user":{"id","email"}}` · `401 AUTHENTICATION_FAILED` |
| POST | `/api/v1/auth/refresh` | — | `200 {"access","refresh"}` (rotación + blacklist) |
| POST | `/api/v1/auth/logout` | JWT | `204` · blacklistea el refresh |
| GET | `/api/v1/auth/me` | JWT | `200 {"id","email"}` · `401 NOT_AUTHENTICATED / TOKEN_INVALID` |

## Modelos

- `accounts.User` (`AbstractBaseUser + PermissionsMixin`): `email` único (normalizado a minúsculas), `is_active`, `is_staff`, `date_joined`. `USERNAME_FIELD = "email"`.
- Tablas de `rest_framework_simplejwt.token_blacklist` (parte de SimpleJWT, sin dependencia nueva) para logout real.

Migraciones generadas con `makemigrations` y aplicadas con `migrate` sobre una base vacía (volumen Docker nuevo). `makemigrations --check` → "No changes detected".

## Tests

Ejecutados realmente:

```text
backend$ ruff check .            → All checks passed!
backend$ ruff format --check .   → 44 files already formatted
backend$ pytest                  → 23 passed
frontend$ npm run lint           → sin errores ni warnings
frontend$ npm run test           → 10 passed
frontend$ npm run build          → ✓ built
```

Backend: health ok / DB caída, register ok, email duplicado (case-insensitive), validaciones de email y campos, passwords débiles, login ok, password incorrecto, email inexistente, usuario inactivo, me autenticado, me sin token, me con token inválido, refresh, logout + reuso del refresh bloqueado, logout sin auth, logout con token inválido, superuser.

Frontend: render de Login, validación del formulario (sin llamar a la API), error de credenciales, login exitoso → redirect, register con passwords distintas, email duplicado, `ProtectedRoute` (redirect anónimo, acceso con sesión, refresh automático del access token, sesión inválida → login).

Smoke test manual (curl) contra `docker compose up`: health, register, duplicado, login incorrecto, login, me, me anónimo, preflight CORS.

## Decisiones técnicas

1. **Django 5.2 LTS** (soporte hasta 2028).
2. **`DATABASE_URL` parseada sin dependencias** (`config/settings/env.py`) en lugar de `dj-database-url`.
3. **Rutas sin barra final** (`APPEND_SLASH = False`) para coincidir con `API_GUIDELINES.md`.
4. **Refresh con rotación + blacklist**: el logout invalida el refresh en servidor.
5. **Tokens en `localStorage`**, gestionados sólo por `session.ts`. Aceptado para el MVP (ver deuda técnica).
6. **Refresh single-flight** en el cliente: varios 401 simultáneos comparten un único `POST /auth/refresh`.
7. **Puertos del host configurables** (`POSTGRES_HOST_PORT`, `BACKEND_HOST_PORT`) porque en la máquina de desarrollo 5432/8000/5173 ya estaban ocupados por otros proyectos.
8. **`@hookform/resolvers`**: única dependencia no listada explícitamente; es el puente oficial RHF ↔ Zod.
9. Versiones actuales instaladas: React 19, React Router 8, Vite 8, Vitest 5, TypeScript 6, Tailwind 4, Zod 4.

## Problemas encontrados

- Puertos 5432, 8000 y 5173 ocupados por contenedores de otros proyectos → se parametrizaron los puertos; localmente se usó 5434 (db), 8001 (backend) y 5175 (frontend).
- El handler de errores devolvía `NOT_AUTHENTICATED` para credenciales incorrectas; corregido a `AUTHENTICATION_FAILED` y cubierto por test.
- La máquina local tiene Python 3.14; la imagen Docker y la CI usan 3.12 (mínimo soportado). Ambos funcionan.

## Deuda técnica

- Tokens en `localStorage` (riesgo XSS). Alternativa futura: refresh en cookie `HttpOnly`.
- El backend en Docker usa `runserver`; falta servidor WSGI de producción (gunicorn) y estáticos del admin (whitenoise) para Railway → Sprint 5 (deploy).
- La CI no se ejecutó todavía en GitHub (no hay remoto configurado).
- No se verificó la UI en un navegador real en esta sesión; el flujo está cubierto por tests de componentes y los endpoints por curl.

## Próximo sprint

Sprint 1 — Catálogo cinematográfico: cliente TMDB, modelos `Movie/Genre/Person/MoviePerson`, `MovieService`, endpoints de búsqueda/detalle/créditos, UI de búsqueda y detalle.

SPRINT_0_STATUS: COMPLETED
