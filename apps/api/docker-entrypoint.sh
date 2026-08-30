#!/bin/sh
set -eu

echo "==> migrate"
python manage.py migrate --noinput

echo "==> collectstatic"
python manage.py collectstatic --noinput

PORT="${PORT:-8000}"
WORKERS="${WEB_CONCURRENCY:-2}"

echo "==> gunicorn :${PORT} (workers=${WORKERS})"
exec gunicorn config.wsgi:application \
  --bind "0.0.0.0:${PORT}" \
  --workers "${WORKERS}" \
  --timeout 120 \
  --access-logfile - \
  --error-logfile -
