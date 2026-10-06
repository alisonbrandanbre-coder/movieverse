# Deploy: Railway (backend + PostgreSQL) y Vercel (frontend)

El repo es un monorepo: `backend/` (Django + DRF) se despliega en **Railway** junto con un **PostgreSQL** de Railway, y `frontend/` (React + Vite) en **Vercel**. Ningún dominio está fijo en el código: todo se configura con variables de entorno.

Orden recomendado: 1) PostgreSQL, 2) backend (con CORS vacío), 3) frontend con la URL del backend, 4) volver al backend y cargar el dominio de Vercel en CORS.

---

## 1. Railway — PostgreSQL

1. En el proyecto de Railway: **New → Database → PostgreSQL**. Railway crea el servicio (por defecto se llama `Postgres`) y expone `DATABASE_URL`.
2. No hace falta crear tablas: el backend corre las migraciones al arrancar.

## 2. Railway — backend

### Servicio

**New → GitHub Repo →** este repositorio. En **Settings** del servicio:

| Opción | Valor |
|---|---|
| Root Directory | `/backend` |
| Config-as-code (Railway Config File) | `/backend/railway.json` (el archivo de config **no** sigue el Root Directory: va la ruta completa desde la raíz del repo) |
| Builder | Dockerfile (`backend/Dockerfile`; lo fija `railway.json`) |
| Start command | `sh start.sh` (lo fija `railway.json`; es también el `CMD` del Dockerfile) |
| Healthcheck path | `/api/v1/health` (lo fija `railway.json`) |
| Networking | **Generate Domain** (queda algo como `movieverse-api.up.railway.app`) |

Todo lo necesario para el deploy está dentro de `backend/`: `Dockerfile`, `start.sh`, `railway.json`, `requirements.txt`, el código y las migraciones.

### Qué hace `start.sh`

```sh
python manage.py migrate --noinput
python manage.py collectstatic --noinput
exec gunicorn config.wsgi:application --bind 0.0.0.0:$PORT --workers ${WEB_CONCURRENCY:-2} --threads ${GUNICORN_THREADS:-4} --timeout ${GUNICORN_TIMEOUT:-60} --access-logfile - --error-logfile -
```

- Usa `config.settings.production` si `DJANGO_SETTINGS_MODULE` no está definida.
- Si una migración falla, el contenedor no arranca (`set -e`) y Railway mantiene el deploy anterior.
- `PORT` lo inyecta Railway. Los workers usan threads porque algunas requests hacen varias llamadas paralelas a TMDB.
- Los estáticos (sólo el admin de Django) los sirve **WhiteNoise**, comprimidos y con hash.

### Variables del servicio backend

| Variable | Obligatoria | Valor |
|---|---|---|
| `DJANGO_SETTINGS_MODULE` | recomendada | `config.settings.production` (es el default de `start.sh`) |
| `SECRET_KEY` | **sí** | 50+ caracteres aleatorios. Generar con `python -c "import secrets; print(secrets.token_urlsafe(50))"`. Si falta o tiene menos de 32, el backend no arranca. |
| `ALLOWED_HOSTS` | **sí** | el dominio del backend, p. ej. `movieverse-api.up.railway.app` (separados por coma si hay varios). Se suman solos `RAILWAY_PUBLIC_DOMAIN` y `healthcheck.railway.app`. |
| `DATABASE_URL` | **sí** | `${{Postgres.DATABASE_URL}}` (referencia de Railway al servicio PostgreSQL; red privada, sin SSL). Si se usa la URL pública, agregar `?sslmode=require`. |
| `CORS_ALLOWED_ORIGINS` | después | el dominio de Vercel, p. ej. `https://movieverse.vercel.app`. Vacío = ningún origen del navegador puede llamar a la API. |
| `CSRF_TRUSTED_ORIGINS` | después | `https://movieverse.vercel.app`. Se suma solo `https://` + `RAILWAY_PUBLIC_DOMAIN` (para el admin). |
| `TMDB_API_KEY` | **sí** | API Key v3 o Read Access Token v4 de TMDB. Nunca en el frontend ni en Git. |
| `TMDB_LANGUAGE` | no | `es-ES` |
| `TMDB_TIMEOUT_SECONDS` | no | `5` |
| `TMDB_CACHE_DAYS` | no | `7` |
| `TMDB_WATCH_REGION` | no | `AR` |
| `JWT_ACCESS_MINUTES` | no | `15` |
| `JWT_REFRESH_DAYS` | no | `7` |
| `WEB_CONCURRENCY` · `GUNICORN_THREADS` · `GUNICORN_TIMEOUT` | no | `2` · `4` · `60` |
| `SECURE_SSL_REDIRECT` · `SECURE_HSTS_SECONDS` | no | `true` · `2592000` (30 días) |

`DEBUG` no se lee en producción: siempre es `False`. `PORT` y `RAILWAY_PUBLIC_DOMAIN` los define Railway.

### Seguridad que aplica `config/settings/production.py`

- `DEBUG = False`; `SECRET_KEY`, `ALLOWED_HOSTS` y `DATABASE_URL` obligatorias (falla al arrancar si faltan).
- Detrás del proxy HTTPS de Railway: `SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")`, `SECURE_SSL_REDIRECT`, `SESSION_COOKIE_SECURE`, `CSRF_COOKIE_SECURE`, HSTS (30 días, `includeSubDomains`; sin preload, que es para un dominio propio), `nosniff`, `X-Frame-Options: DENY`.
- `/api/v1/health` está exento de la redirección a HTTPS: el healthcheck de Railway llega por HTTP plano dentro de su red.
- CORS sin comodines: sólo los orígenes de `CORS_ALLOWED_ORIGINS`.
- `manage.py check --deploy` pasa sin warnings (lo cubre `tests/common/test_production_settings.py`).

### Health

```text
GET https://<dominio-del-backend>/api/v1/health
200 {"status": "ok", "database": "ok"}
503 {"status": "error", "database": "unavailable"}
```

Público, sin datos sensibles: sólo confirma que el backend responde y que la base de datos acepta un `SELECT 1`. Railway lo usa para dar por bueno cada deploy.

## 3. Vercel — frontend

**Add New → Project →** este repositorio.

| Opción | Valor |
|---|---|
| Root Directory | `frontend` |
| Framework Preset | Vite |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Install Command | `npm install` (default) |

`frontend/vercel.json` fija lo mismo y agrega el **rewrite a `/index.html`**: React Router maneja las rutas en el navegador, así que entrar directo a `/login`, `/search`, `/movies/1`, `/profile` o recargar en cualquiera de ellas sirve la app en vez de un 404. Los archivos que existen (`/assets/*`, `/favicon.svg`) se sirven antes que el rewrite.

### Variables de Vercel

| Variable | Valor |
|---|---|
| `VITE_API_URL` | `https://<dominio-del-backend>/api/v1` (p. ej. `https://movieverse-api.up.railway.app/api/v1`), en **Production** (y Preview si se usa) |

Es la única. Se embebe en el bundle **al compilar**: después de cambiarla hay que hacer **Redeploy**. Si falta, el build avisa (`⚠ VITE_API_URL is not set`) y la app llamaría a `/api/v1` en el propio dominio de Vercel, que no existe. Nunca poner `TMDB_API_KEY` ni otro secreto en variables `VITE_*`: todo lo que empieza con `VITE_` es público.

## 4. CORS: conectar los dos dominios

Cuando Railway y Vercel ya entregaron sus dominios:

1. **Vercel** → Settings → Environment Variables: `VITE_API_URL=https://<backend>.up.railway.app/api/v1` → Redeploy.
2. **Railway** → servicio backend → Variables:
   ```env
   ALLOWED_HOSTS=<backend>.up.railway.app
   CORS_ALLOWED_ORIGINS=https://<frontend>.vercel.app
   CSRF_TRUSTED_ORIGINS=https://<frontend>.vercel.app
   ```
   Railway redeploya solo al guardar.
3. Varios orígenes (p. ej. un dominio propio además del de Vercel): separados por coma, con `https://` y **sin** `/` final.
4. Verificar: abrir el frontend, iniciar sesión y buscar una película. Un error de CORS en la consola del navegador significa que el origen exacto (esquema + dominio) no está en `CORS_ALLOWED_ORIGINS`.

La API autentica con JWT en el header `Authorization` (no con cookies), así que el CSRF de Django no interviene en las llamadas del frontend; `CSRF_TRUSTED_ORIGINS` queda configurado igual por si se usan formularios o el admin desde otro origen.

## 5. Checklist después del primer deploy

- [ ] `GET https://<backend>/api/v1/health` → `200 {"status": "ok", "database": "ok"}`
- [ ] Logs de Railway: migraciones `OK`, `N static files copied`, `Starting gunicorn`
- [ ] `https://<backend>/admin/` carga con estilos (WhiteNoise). Crear un admin: Railway → servicio → shell, `python manage.py createsuperuser`
- [ ] Frontend: registro, login, Inicio (tendencias), Buscar, Descubrir, ficha con "Dónde verla" y mapa
- [ ] Recargar el navegador en `/movies/1` y `/profile`: no da 404

## Desarrollo local (sin cambios)

`docker compose up -d` sigue levantando PostgreSQL + backend con `runserver` y autoreload (`docker-compose.yml` sobreescribe el comando del Dockerfile e instala `requirements-dev.txt`). El frontend se sigue corriendo con `npm run dev`, con `VITE_API_URL` en `frontend/.env`.
