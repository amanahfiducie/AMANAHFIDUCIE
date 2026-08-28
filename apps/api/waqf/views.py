from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.authentication import JWTAuthentication

from cases.access import ensure_case_writable, get_accessible_case_or_404
from waqf.models import WaqfProfile
from waqf.serializers import WaqfProfileSerializer


class CaseWaqfView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: WaqfProfileSerializer}, tags=("Waqf",))
    def get(self, request, case_pk: int):
        case = get_accessible_case_or_404(request.user, case_pk)
        profile, _created = WaqfProfile.objects.get_or_create(
            case=case,
            defaults=_defaults_from_onboarding(case),
        )
        return Response(WaqfProfileSerializer(profile).data)

    @extend_schema(
        request=WaqfProfileSerializer,
        responses={200: WaqfProfileSerializer},
        tags=("Waqf",),
    )
    def patch(self, request, case_pk: int):
        case = get_accessible_case_or_404(request.user, case_pk)
        ensure_case_writable(request.user, case)
        profile, _created = WaqfProfile.objects.get_or_create(
            case=case,
            defaults=_defaults_from_onboarding(case),
        )
        serializer = WaqfProfileSerializer(profile, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


def _defaults_from_onboarding(case) -> dict:
    data = case.onboarding_data if isinstance(case.onboarding_data, dict) else {}
    return {
        "waqf_type": data.get("waqf_type", "FAMILY"),
        "waqf_object": data.get("waqf_object", data.get("waqf_intention", "")),
        "waqf_distribution_rules": data.get("waqf_distribution_rules", ""),
    }
