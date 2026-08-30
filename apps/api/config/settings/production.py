"""Paramètres production (Render, etc.)."""

import os

import dj_database_url

from .base import *  # noqa: F403

DEBUG = False

STATIC_ROOT = BASE_DIR / "staticfiles"  # noqa: F405

if USE_S3:  # noqa: F405
    STORAGES = {  # noqa: F405
        **STORAGES,  # noqa: F405
        "staticfiles": {
            "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
        },
    }
else:
    STORAGES = {
        "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
        "staticfiles": {
            "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
        },
    }

if "whitenoise.middleware.WhiteNoiseMiddleware" not in MIDDLEWARE:  # noqa: F405
    security_idx = MIDDLEWARE.index("django.middleware.security.SecurityMiddleware")  # noqa: F405
    MIDDLEWARE.insert(security_idx + 1, "whitenoise.middleware.WhiteNoiseMiddleware")  # noqa: F405

database_url = os.environ.get("DATABASE_URL", "").strip()
if database_url:
    DATABASES["default"] = dj_database_url.config(  # noqa: F405
        default=database_url,
        conn_max_age=600,
        conn_health_checks=True,
        ssl_require=os.environ.get("DATABASE_SSL", "1").lower() in ("1", "true", "yes"),
    )

render_host = os.environ.get("RENDER_EXTERNAL_HOSTNAME", "").strip()
if render_host and render_host not in ALLOWED_HOSTS:  # noqa: F405
    ALLOWED_HOSTS.append(render_host)  # noqa: F405

SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_SSL_REDIRECT = os.environ.get("SECURE_SSL_REDIRECT", "1").lower() in ("1", "true", "yes")
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True

csrf_origins_raw = os.environ.get("CSRF_TRUSTED_ORIGINS", "").strip()
if csrf_origins_raw:
    CSRF_TRUSTED_ORIGINS = [o.strip() for o in csrf_origins_raw.split(",") if o.strip()]
else:
    CSRF_TRUSTED_ORIGINS = list(CORS_ALLOWED_ORIGINS)  # noqa: F405

LOGIN_OTP_METHOD = os.environ.get("LOGIN_OTP_METHOD", "email").strip() or "email"
LOGIN_OTP_EXPOSE_DEV_CODE = os.environ.get("LOGIN_OTP_EXPOSE_DEV_CODE", "0").lower() in (
    "1",
    "true",
    "yes",
)
