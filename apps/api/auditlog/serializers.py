from rest_framework import serializers

from auditlog.models import AuditLog


class AuditLogSerializer(serializers.ModelSerializer):
    actor_username = serializers.CharField(
        source="actor.username",
        read_only=True,
        default=None,
    )
    case_reference = serializers.CharField(
        source="case.reference",
        read_only=True,
        default=None,
    )

    class Meta:
        model = AuditLog
        fields = (
            "id",
            "actor",
            "actor_username",
            "actor_role",
            "action",
            "entity_type",
            "entity_id",
            "case",
            "case_reference",
            "ip_address",
            "timestamp",
            "metadata_json",
        )
        read_only_fields = fields
