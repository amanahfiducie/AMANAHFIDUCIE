import os

from .development import *  # noqa: F403,F405

# Transport e-mail factice pour les tests OTP
os.environ.setdefault("EMAIL_HOST", "localhost")
os.environ.setdefault("EMAIL_HOST_USER", "test@example.com")
os.environ.setdefault("EMAIL_HOST_PASSWORD", "test-password-ok")
LOGIN_OTP_EXPOSE_DEV_CODE = False
OTP_USE_RESEND = False
OTP_SKIP_SMTP = False

USE_S3 = False

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": ":memory:",
    }
}

PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.MD5PasswordHasher",
]

ALLOWED_HOSTS = ["testserver", "localhost", "127.0.0.1"]
