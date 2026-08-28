from rest_framework import serializers

from waqf.models import WaqfProfile


class WaqfProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = WaqfProfile
        fields = (
            "id",
            "case",
            "waqf_type",
            "waqf_object",
            "waqf_distribution_rules",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "case", "created_at", "updated_at")
