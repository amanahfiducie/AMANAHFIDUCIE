from drf_spectacular.utils import extend_schema
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.authentication import JWTAuthentication

from auditlog.models import AuditLog
from auditlog.permissions import user_can_read_audit_logs, user_can_read_global_audit
from auditlog.serializers import AuditLogSerializer
from cases.access import get_accessible_case_or_404
from cases.models import FiduciaryCase


class AuditLogListView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: AuditLogSerializer(many=True)}, tags=("Audit",))
    def get(self, request):
        if not user_can_read_global_audit(request.user):
            raise PermissionDenied("Accès journal d'audit refusé.")

        qs = AuditLog.objects.select_related("actor", "case").order_by("-timestamp")
        action = request.query_params.get("action", "").strip()
        if action:
            qs = qs.filter(action=action)
        case_id = request.query_params.get("case_id")
        if case_id:
            qs = qs.filter(case_id=case_id)
        limit = min(int(request.query_params.get("limit", 100)), 500)
        return Response(AuditLogSerializer(qs[:limit], many=True).data)


class CaseAuditLogListView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: AuditLogSerializer(many=True)}, tags=("Audit",))
    def get(self, request, case_pk: int):
        if not user_can_read_audit_logs(request.user):
            raise PermissionDenied("Accès journal d'audit refusé.")
        case = get_accessible_case_or_404(request.user, case_pk)
        qs = (
            AuditLog.objects.filter(case=case)
            .select_related("actor", "case")
            .order_by("-timestamp")[:200]
        )
        return Response(AuditLogSerializer(qs, many=True).data)
