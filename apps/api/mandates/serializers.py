from rest_framework import serializers

from mandates.models import Mandate, MandateValidation, MandateValidationDecision


class MandateValidationSerializer(serializers.ModelSerializer):
    validated_by_username = serializers.CharField(
        source="validated_by.username",
        read_only=True,
    )

    class Meta:
        model = MandateValidation
        fields = (
            "id",
            "decision",
            "comment",
            "validated_by",
            "validated_by_username",
            "created_at",
        )
        read_only_fields = fields


class MandateSerializer(serializers.ModelSerializer):
    validations = MandateValidationSerializer(many=True, read_only=True)
    latest_decision = serializers.SerializerMethodField()

    class Meta:
        model = Mandate
        fields = (
            "id",
            "case",
            "mandate_type",
            "title",
            "reference_number",
            "issuing_authority",
            "signed_at",
            "effective_from",
            "effective_to",
            "notes",
            "created_by",
            "created_at",
            "updated_at",
            "validations",
            "latest_decision",
        )
        read_only_fields = ("id", "case", "created_by", "created_at", "updated_at", "validations", "latest_decision")

    def get_latest_decision(self, obj: Mandate) -> str | None:
        latest = obj.latest_validation
        return latest.decision if latest else None


class MandateCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Mandate
        fields = (
            "mandate_type",
            "title",
            "reference_number",
            "issuing_authority",
            "signed_at",
            "effective_from",
            "effective_to",
            "notes",
        )


class MandateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Mandate
        fields = (
            "mandate_type",
            "title",
            "reference_number",
            "issuing_authority",
            "signed_at",
            "effective_from",
            "effective_to",
            "notes",
        )


class MandateValidateSerializer(serializers.Serializer):
    decision = serializers.ChoiceField(choices=MandateValidationDecision.choices)
    comment = serializers.CharField(required=False, allow_blank=True, default="")
