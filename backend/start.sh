#!/bin/sh
# Production entrypoint (Railway): migrate, collect static files and serve with Gunicorn.
# Local development does not use it: docker compose runs `runserver` instead.
set -e

export DJANGO_SETTINGS_MODULE="${DJANGO_SETTINGS_MODULE:-config.settings.production}"

python manage.py migrate --noinput
python manage.py collectstatic --noinput

# Railway injects PORT. Threads matter: some requests fan out parallel TMDB calls.
exec gunicorn config.wsgi:application \
  --bind "0.0.0.0:${PORT:-8000}" \
  --workers "${WEB_CONCURRENCY:-2}" \
  --threads "${GUNICORN_THREADS:-4}" \
  --timeout "${GUNICORN_TIMEOUT:-60}" \
  --access-logfile - \
  --error-logfile -
