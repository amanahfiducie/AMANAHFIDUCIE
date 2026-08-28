"""
Paramètres Django partagés (tous environnements).
"""

import os
from datetime import timedelta
from pathlib import Path

from config.env_loader import (
    load_project_env,
    login_otp_method,
    smtp_credentials_valid,
    smtp_from_email,
)

BASE_DIR = Path(__file__).resolve().parent.parent.parent
load_project_env()

SECRET_KEY = os.environ.get("SECRET_KEY", "django-insecure-dev-only-change-me")

DEBUG = os.environ.get("DEBUG", "0").lower() in ("1", "true", "yes")

ALLOWED_HOSTS = [
    h.strip()
    for h in os.environ.get("ALLOWED_HOSTS", "127.0.0.1,localhost").split(",")
    if h.strip()
]

USE_S3 = os.environ.get("USE_S3", "0").lower() in ("1", "true", "yes")
DOCUMENT_DOWNLOAD_URL_EXPIRY = int(os.environ.get("DOCUMENT_DOWNLOAD_URL_EXPIRY", "3600"))

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "rest_framework_simplejwt",
    "drf_spectacular",
    "corsheaders",
    "accounts.apps.AccountsConfig",
    "cases.apps.CasesConfig",
    "mandates.apps.MandatesConfig",
    "beneficiaries.apps.BeneficiariesConfig",
    "assets.apps.AssetsConfig",
    "documents.apps.DocumentsConfig",
    "finance.apps.FinanceConfig",
    "services.apps.ServicesConfig",
    "validations.apps.ValidationsConfig",
    "portals.apps.PortalsConfig",
    "auditlog.apps.AuditlogConfig",
    "reports.apps.ReportsConfig",
    "notifications.apps.NotificationsConfig",
    "waqf.apps.WaqfConfig",
    "zakat.apps.ZakatConfig",
    "faraid.apps.FaraidConfig",
    "investments.apps.InvestmentsConfig",
]

if USE_S3:
    INSTALLED_APPS.append("storages")

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

USE_SQLITE = os.environ.get("USE_SQLITE", "0").lower() in ("1", "true", "yes")

if USE_SQLITE:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": os.environ.get("POSTGRES_DB", "amanah_fiducie"),
            "USER": os.environ.get("POSTGRES_USER", "postgres"),
            "PASSWORD": os.environ.get("POSTGRES_PASSWORD", "pqsser"),
            "HOST": os.environ.get("POSTGRES_HOST", "127.0.0.1"),
            "PORT": os.environ.get("POSTGRES_PORT", "5432"),
        }
    }

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "fr-fr"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"

MEDIA_ROOT = BASE_DIR / "media"
MEDIA_URL = "/media/"

if USE_S3:
    AWS_ACCESS_KEY_ID = os.environ.get("AWS_ACCESS_KEY_ID", "minioadmin")
    AWS_SECRET_ACCESS_KEY = os.environ.get("AWS_SECRET_ACCESS_KEY", "minioadmin")
    AWS_STORAGE_BUCKET_NAME = os.environ.get("AWS_STORAGE_BUCKET_NAME", "sofigepam-documents")
    AWS_S3_ENDPOINT_URL = os.environ.get("AWS_S3_ENDPOINT_URL", "http://127.0.0.1:9000")
    AWS_S3_REGION_NAME = os.environ.get("AWS_S3_REGION_NAME", "us-east-1")
    AWS_S3_USE_SSL = os.environ.get("AWS_S3_USE_SSL", "0").lower() in ("1", "true", "yes")
    AWS_S3_SIGNATURE_VERSION = "s3v4"
    AWS_DEFAULT_ACL = None
    AWS_QUERYSTRING_AUTH = True
    STORAGES = {
        "default": {
            "BACKEND": "storages.backends.s3.S3Storage",
        },
        "staticfiles": {
            "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage",
        },
    }

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "EXCEPTION_HANDLER": "config.exceptions.api_exception_handler",
}


SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=60),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": False,
}

# Courriel — OTP connexion (SMTP ; console si absent)
DEFAULT_FROM_EMAIL = (
    os.environ.get("DEFAULT_FROM_EMAIL", "").strip()
    or (smtp_from_email() if smtp_credentials_valid() else "")
    or "AMANAH Fiducie <noreply@localhost>"
)
SERVER_EMAIL = DEFAULT_FROM_EMAIL

if smtp_credentials_valid():
    EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
    EMAIL_HOST = os.environ.get("EMAIL_HOST", "localhost")
    EMAIL_PORT = int(os.environ.get("EMAIL_PORT", "587"))
    EMAIL_HOST_USER = os.environ.get("EMAIL_HOST_USER", "")
    EMAIL_HOST_PASSWORD = os.environ.get("EMAIL_HOST_PASSWORD", "")
    # Gmail 587 = STARTTLS uniquement ; 465 = SSL uniquement (mutuellement exclusifs)
    if EMAIL_PORT == 465:
        EMAIL_USE_TLS = False
        EMAIL_USE_SSL = True
    else:
        EMAIL_USE_TLS = True
        EMAIL_USE_SSL = False
else:
    EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"

# Connexion OTP — jamais de code à l'écran sauf LOGIN_OTP_EXPOSE_DEV_CODE=1 + mode display
LOGIN_OTP_METHOD = login_otp_method()
LOGIN_OTP_EXPOSE_DEV_CODE = os.environ.get("LOGIN_OTP_EXPOSE_DEV_CODE", "0").lower() in (
    "1",
    "true",
    "yes",
)


cors_origins_raw = os.environ.get(
    "CORS_ALLOWED_ORIGINS",
    "http://127.0.0.1:3000,http://localhost:3000",
)
CORS_ALLOWED_ORIGINS = [o.strip() for o in cors_origins_raw.split(",") if o.strip()]
CORS_ALLOW_CREDENTIALS = True

SPECTACULAR_SETTINGS = {
    "TITLE": "SOFIGEPAM Connect API",
    "DESCRIPTION": "API REST AMANAH FIDUCIE / SOFIGEPAM Connect.",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "APPEND_COMPONENTS": {
        "securitySchemes": {
            "bearerAuth": {
                "type": "http",
                "scheme": "bearer",
                "bearerFormat": "JWT",
            }
        }
    },
}
