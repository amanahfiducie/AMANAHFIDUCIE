from rest_framework import serializers

from accounts.case_profile_invite import PROFILE_TYPE_LABELS, preview_profile_invite
from accounts.models import ProfileUserAccessRequest


class ProfileUserAccessRequestSerializer(serializers.ModelSerializer):
    case_reference = serializers.CharField(source="case.reference", read_only=True)
    case_title = serializers.CharField(source="case.title", read_only=True)
    profile_type_label = serializers.SerializerMethodField()
    requested_by_username = serializers.CharField(
        source="requested_by.username",
        read_only=True,
    )
    existing_user_username = serializers.SerializerMethodField()
    created_user_username = serializers.SerializerMethodField()

    class Meta:
        model = ProfileUserAccessRequest
        fields = (
            "id",
            "case",
            "case_reference",
            "case_title",
            "profile_type",
            "profile_type_label",
            "profile_id",
            "status",
            "email",
            "phone",
            "display_name",
            "preview_status",
            "existing_user",
            "existing_user_username",
            "created_user",
            "created_user_username",
            "requested_by",
            "requested_by_username",
            "reviewed_by",
            "reviewed_at",
            "review_notes",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields

    def get_profile_type_label(self, obj: ProfileUserAccessRequest) -> str:
        return PROFILE_TYPE_LABELS.get(obj.profile_type, obj.profile_type)

    def get_existing_user_username(self, obj: ProfileUserAccessRequest) -> str | None:
        if obj.existing_user_id:
            return obj.existing_user.username
        return None

    def get_created_user_username(self, obj: ProfileUserAccessRequest) -> str | None:
        if obj.created_user_id:
            return obj.created_user.username
        return None


class ProfileUserAccessApproveSerializer(serializers.Serializer):
    email = serializers.EmailField()
    confirm_add_existing = serializers.BooleanField(default=False)
    review_notes = serializers.CharField(required=False, allow_blank=True)


class ProfileUserAccessRejectSerializer(serializers.Serializer):
    review_notes = serializers.CharField(required=False, allow_blank=True)


class ProfileUserAccessPreviewSerializer(serializers.Serializer):
    """Prévisualisation à jour avant validation."""

    def to_representation(self, instance: ProfileUserAccessRequest):
        return preview_profile_invite(
            instance.case,
            profile_type=instance.profile_type,
            profile_id=instance.profile_id,
            email=instance.email,
        )
