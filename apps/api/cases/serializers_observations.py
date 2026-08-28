from rest_framework import serializers

from cases.models import CaseObservation, CaseObservationKind, CaseObservationStatus


class CaseObservationSerializer(serializers.ModelSerializer):
    author_username = serializers.CharField(source="author.username", read_only=True)
    author_display = serializers.SerializerMethodField()
    reviewed_by_username = serializers.CharField(
        source="reviewed_by.username",
        read_only=True,
        allow_null=True,
    )
    kind_label = serializers.CharField(source="get_kind_display", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    case = serializers.IntegerField(source="case_id", read_only=True)
    case_reference = serializers.CharField(source="case.reference", read_only=True)
    case_title = serializers.CharField(source="case.title", read_only=True)

    class Meta:
        model = CaseObservation
        fields = (
            "id",
            "case",
            "case_reference",
            "case_title",
            "kind",
            "kind_label",
            "status",
            "status_label",
            "body",
            "author",
            "author_username",
            "author_display",
            "shared_at",
            "reviewed_by",
            "reviewed_by_username",
            "reviewed_at",
            "review_reason",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields

    def get_author_display(self, obj: CaseObservation) -> str:
        user = obj.author
        name = f"{user.first_name} {user.last_name}".strip()
        return name or user.username


class CaseObservationCreateSerializer(serializers.Serializer):
    body = serializers.CharField()
    kind = serializers.ChoiceField(
        choices=CaseObservationKind.choices,
        default=CaseObservationKind.SUBMISSION,
    )
    share = serializers.BooleanField(
        default=False,
        help_text="Partager immédiatement pour validation (observations uniquement).",
    )


class CaseObservationUpdateSerializer(serializers.Serializer):
    body = serializers.CharField()


class CaseObservationReviewSerializer(serializers.Serializer):
    review_reason = serializers.CharField(required=False, allow_blank=True, default="")
