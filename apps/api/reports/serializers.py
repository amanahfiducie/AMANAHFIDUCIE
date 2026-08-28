from rest_framework import serializers

from reports.models import (
    ApprovalDecision,
    Report,
    ReportApproval,
    ReportGenerationJob,
    ReportTemplate,
    ReportType,
)


class ReportTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReportTemplate
        fields = (
            "id",
            "slug",
            "name",
            "report_type",
            "description",
            "is_active",
        )
        read_only_fields = fields


class ReportGenerationJobSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReportGenerationJob
        fields = (
            "id",
            "status",
            "error_message",
            "started_at",
            "finished_at",
            "created_at",
        )
        read_only_fields = fields


class ReportApprovalSerializer(serializers.ModelSerializer):
    decided_by_username = serializers.CharField(
        source="decided_by.username",
        read_only=True,
    )

    class Meta:
        model = ReportApproval
        fields = (
            "id",
            "decision",
            "comment",
            "decided_by",
            "decided_by_username",
            "created_at",
        )
        read_only_fields = fields


class ReportSerializer(serializers.ModelSerializer):
    report_type_label = serializers.CharField(
        source="get_report_type_display",
        read_only=True,
    )
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    generated_by_username = serializers.CharField(
        source="generated_by.username",
        read_only=True,
    )
    approved_by_username = serializers.CharField(
        source="approved_by.username",
        read_only=True,
    )
    generation_job = ReportGenerationJobSerializer(read_only=True)
    can_download = serializers.SerializerMethodField()

    class Meta:
        model = Report
        fields = (
            "id",
            "case",
            "template",
            "report_type",
            "report_type_label",
            "title",
            "status",
            "status_label",
            "period_start",
            "period_end",
            "generated_by",
            "generated_by_username",
            "approved_by",
            "approved_by_username",
            "approved_at",
            "archived_at",
            "metadata_json",
            "generation_job",
            "can_download",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields

    def get_can_download(self, obj: Report) -> bool:
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        from reports.permissions import user_can_download_report

        return user_can_download_report(request.user, obj)


class ReportGenerateSerializer(serializers.Serializer):
    case_id = serializers.IntegerField()
    report_type = serializers.ChoiceField(choices=ReportType.choices)
    title = serializers.CharField(max_length=255, required=False, allow_blank=True)
    template_id = serializers.IntegerField(required=False)
    period_start = serializers.DateField(required=False)
    period_end = serializers.DateField(required=False)

    def validate_title(self, value: str) -> str:
        return value.strip()

    def validate(self, attrs):
        from reports.services import resolve_report_period

        report_type = attrs["report_type"]
        start, end = resolve_report_period(
            report_type,
            attrs.get("period_start"),
            attrs.get("period_end"),
        )
        attrs["period_start"] = start
        attrs["period_end"] = end
        # Titre finalisé côté create_report_draft (dépend du type de service).
        if not attrs.get("title"):
            attrs["title"] = ""
        return attrs


class ReportApproveSerializer(serializers.Serializer):
    comment = serializers.CharField(required=False, allow_blank=True, default="")


class ReportRejectSerializer(serializers.Serializer):
    comment = serializers.CharField(required=False, allow_blank=True, default="")


class DownloadUrlResponseSerializer(serializers.Serializer):
    url = serializers.URLField()
    expires_in = serializers.IntegerField()
    report_id = serializers.IntegerField()
    original_filename = serializers.CharField()
