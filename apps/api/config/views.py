from django.urls import reverse
from drf_spectacular.utils import extend_schema
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response


@extend_schema(
    summary="Racine de l’API — liens utiles",
    responses={
        200: {
            "type": "object",
            "properties": {
                "name": {"type": "string"},
                "version": {"type": "string"},
                "links": {"type": "object"},
            },
        }
    },
)
@api_view(["GET"])
@permission_classes([AllowAny])
def api_root(request):
    return Response(
        {
            "name": "SOFIGEPAM Connect API",
            "version": "1.0.0",
            "links": {
                "health": request.build_absolute_uri(reverse("health")),
                "swagger": request.build_absolute_uri(reverse("swagger-ui")),
                "redoc": request.build_absolute_uri(reverse("redoc")),
                "schema": request.build_absolute_uri(reverse("schema")),
                "admin": request.build_absolute_uri("/admin/"),
            },
        }
    )


@extend_schema(
    summary="Santé de l’API",
    responses={
        200: {
            "type": "object",
            "properties": {"status": {"type": "string", "example": "OK"}},
        }
    },
)
@api_view(["GET"])
@permission_classes([AllowAny])
def health(request):
    return Response({"status": "OK"})
