from rest_framework import serializers

from notifications.models import Notification, NotificationPreference


class NotificationSerializer(serializers.ModelSerializer):
    is_read = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = (
            "id",
            "case",
            "notification_type",
            "title",
            "body",
            "action_path",
            "read_at",
            "is_read",
            "metadata_json",
            "created_at",
        )
        read_only_fields = fields

    def get_is_read(self, obj: Notification) -> bool:
        return obj.read_at is not None


class NotificationPreferenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = NotificationPreference
        fields = ("email_enabled", "in_app_enabled", "updated_at")
        read_only_fields = ("updated_at",)
