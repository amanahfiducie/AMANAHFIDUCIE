from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.authentication import JWTAuthentication

from cases.access import get_accessible_case_or_404
from cases.permissions import user_can_write_case
from rest_framework.exceptions import PermissionDenied
from zakat.models import ZakatAssessment
from zakat.serializers import ZakatAssessmentCreateSerializer, ZakatAssessmentSerializer


class CaseZakatAssessmentView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(
        responses={200: ZakatAssessmentSerializer(many=True)},
        tags=("Zakat",),
    )
    def get(self, request, case_pk: int):
        case = get_accessible_case_or_404(request.user, case_pk)
        qs = ZakatAssessment.objects.filter(case=case).select_related("prepared_by")
        return Response(ZakatAssessmentSerializer(qs, many=True).data)

    @extend_schema(
        request=ZakatAssessmentCreateSerializer,
        responses={201: ZakatAssessmentSerializer},
        tags=("Zakat",),
    )
    def post(self, request, case_pk: int):
        case = get_accessible_case_or_404(request.user, case_pk)
        if not user_can_write_case(request.user):
            raise PermissionDenied("Création zakat non autorisée.")
        serializer = ZakatAssessmentCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        assessment = ZakatAssessment.objects.create(
            case=case,
            prepared_by=request.user,
            **serializer.validated_data,
        )
        return Response(
            ZakatAssessmentSerializer(assessment).data,
            status=status.HTTP_201_CREATED,
        )
