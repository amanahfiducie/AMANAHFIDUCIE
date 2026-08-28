from rest_framework import serializers

from zakat.models import ZakatAssessment


class ZakatAssessmentSerializer(serializers.ModelSerializer):
    prepared_by_username = serializers.CharField(
        source="prepared_by.username",
        read_only=True,
    )

    class Meta:
        model = ZakatAssessment
        fields = (
            "id",
            "case",
            "assessment_year",
            "nisab_amount",
            "zakatable_wealth",
            "zakat_due",
            "currency",
            "notes",
            "status",
            "prepared_by",
            "prepared_by_username",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "case", "prepared_by", "prepared_by_username", "created_at", "updated_at")


class ZakatAssessmentCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ZakatAssessment
        fields = (
            "assessment_year",
            "nisab_amount",
            "zakatable_wealth",
            "zakat_due",
            "currency",
            "notes",
        )
