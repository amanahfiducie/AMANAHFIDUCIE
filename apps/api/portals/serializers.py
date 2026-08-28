from rest_framework import serializers

from beneficiaries.serializers import BeneficiarySerializer
from mandates.serializers import MandateSerializer


class PortalCaseListSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    reference = serializers.CharField()
    title = serializers.CharField()
    status = serializers.CharField()
    case_type = serializers.CharField(required=False)
    case_type_label = serializers.CharField(required=False)
    updated_at = serializers.DateTimeField()


class PortalPatrimonySummarySerializer(serializers.Serializer):
    asset_count = serializers.IntegerField()
    total_estimated_value = serializers.CharField()
    currency = serializers.CharField()


class PortalDocumentSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    title = serializers.CharField()
    category = serializers.CharField()
    created_at = serializers.DateTimeField()
    is_shared = serializers.BooleanField()


class PortalReportSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    title = serializers.CharField()
    report_type = serializers.CharField()
    report_type_label = serializers.CharField()
    status = serializers.CharField()
    approved_at = serializers.DateTimeField(allow_null=True)
    created_at = serializers.DateTimeField()
    metadata_json = serializers.JSONField(required=False, allow_null=True)


class PortalCaseDetailSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    reference = serializers.CharField()
    title = serializers.CharField()
    status = serializers.CharField()
    case_type = serializers.CharField(required=False)
    case_type_label = serializers.CharField(required=False)
    description = serializers.CharField()
    updated_at = serializers.DateTimeField()
    patrimony_summary = PortalPatrimonySummarySerializer(allow_null=True)
    patrimony_evolution = serializers.ListField(
        child=serializers.DictField(),
        required=False,
    )
    mandates = MandateSerializer(many=True, required=False)
    beneficiaries = BeneficiarySerializer(many=True, required=False)
