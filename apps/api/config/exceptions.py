from __future__ import annotations

import logging

from django.core.exceptions import PermissionDenied as DjangoPermissionDenied
from django.http import Http404
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import APIException, ValidationError
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler

logger = logging.getLogger(__name__)


def _error_code(exc: Exception) -> str:
    if isinstance(exc, ValidationError):
        return "VALIDATION_ERROR"
    if isinstance(exc, Http404):
        return "NOT_FOUND"
    if isinstance(exc, DjangoPermissionDenied):
        return "FORBIDDEN"
    if isinstance(exc, APIException):
        return exc.__class__.__name__.upper()
    return "INTERNAL_ERROR"


def _details_from_validation(exc: ValidationError) -> list[dict]:
    detail = exc.detail
    items: list[dict] = []
    if isinstance(detail, dict):
        for field, messages in detail.items():
            if isinstance(messages, list):
                for message in messages:
                    items.append({"field": str(field), "message": str(message)})
            else:
                items.append({"field": str(field), "message": str(messages)})
    elif isinstance(detail, list):
        for message in detail:
            items.append({"field": "non_field_errors", "message": str(message)})
    else:
        items.append({"field": "non_field_errors", "message": str(detail)})
    return items


def api_exception_handler(exc, context):
    response = drf_exception_handler(exc, context)
    request = context.get("request")
    path = request.path if request else ""

    if response is None:
        status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
        message = "Une erreur interne est survenue."
        details: list[dict] = []
        logger.error("Unhandled API error on %s", path, exc_info=exc)
    else:
        status_code = response.status_code
        if isinstance(exc, ValidationError):
            message = "Données invalides."
            details = _details_from_validation(exc)
        elif isinstance(response.data, dict) and "detail" in response.data:
            message = str(response.data["detail"])
            details = []
        elif isinstance(response.data, dict):
            message = "Données invalides."
            details = _details_from_validation(ValidationError(response.data))
        else:
            message = str(response.data)
            details = []

    payload = {
        "timestamp": timezone.now().isoformat(),
        "status": status_code,
        "error": _error_code(exc),
        "message": message,
        "path": path,
        "details": details,
    }
    return Response(payload, status=status_code)
