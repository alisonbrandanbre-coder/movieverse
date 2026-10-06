FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Production installs only the runtime dependencies; docker compose passes
# requirements-dev.txt (pytest, ruff) for local development.
ARG REQUIREMENTS=requirements.txt
COPY requirements.txt requirements-dev.txt ./
RUN pip install -r ${REQUIREMENTS}

COPY . .

RUN useradd --create-home appuser && chown -R appuser /app
USER appuser

EXPOSE 8000

# Production (Railway): migrate + collectstatic + Gunicorn. docker compose overrides it
# with `runserver` for local development.
CMD ["sh", "start.sh"]
