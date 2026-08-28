from django.contrib.auth import get_user_model
from rest_framework import serializers

from assets.serializers import AssetSerializer
from beneficiaries.serializers import (
    BeneficiarySerializer,
    CaseDonorSerializer,
    GuardianSerializer,
)
from documents.serializers import CaseDocumentSummarySerializer
from mandates.serializers import MandateSerializer
from cases.models import (
    CaseAssignment,
    CaseNote,
    CaseOrigin,
    CaseStakeholder,
    CaseStatus,
    CaseTimelineEvent,
    CaseType,
    FiduciaryCase,
    StakeholderRole,
)
from cases.onboarding import get_onboarding_progress, get_onboarding_step_label

User = get_user_model()


class CaseTimelineEventSerializer(serializers.ModelSerializer):
    actor_username = serializers.SerializerMethodField()

    def get_actor_username(self, obj: CaseTimelineEvent) -> str | None:
        return obj.actor.username if obj.actor_id else None

    class Meta:
        model = CaseTimelineEvent
        fields = (
            "id",
            "event_type",
            "actor",
            "actor_username",
            "message",
            "metadata_json",
            "created_at",
        )
        read_only_fields = fields


class CaseAssignmentSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)
    display_name = serializers.SerializerMethodField()
    assigned_by_username = serializers.SerializerMethodField()
    assigned_by_name = serializers.SerializerMethodField()
    is_current = serializers.BooleanField(read_only=True)

    class Meta:
        model = CaseAssignment
        fields = (
            "id",
            "user",
            "username",
            "display_name",
            "assigned_by",
            "assigned_by_username",
            "assigned_by_name",
            "started_at",
            "ended_at",
            "is_current",
        )
        read_only_fields = fields

    def _user_display(self, user) -> str:
        if not user:
            return ""
        profile = getattr(user, "profile", None)
        display = (getattr(profile, "display_name", None) or "").strip()
        if display:
            return display
        full = (user.get_full_name() or "").strip()
        return full or user.get_username() or ""

    def get_display_name(self, obj: CaseAssignment) -> str:
        return self._user_display(obj.user) or obj.user.username

    def get_assigned_by_username(self, obj: CaseAssignment) -> str | None:
        if not obj.assigned_by_id:
            return None
        return obj.assigned_by.username

    def get_assigned_by_name(self, obj: CaseAssignment) -> str | None:
        if not obj.assigned_by_id:
            return None
        return self._user_display(obj.assigned_by) or obj.assigned_by.username


class CaseStakeholderSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)

    class Meta:
        model = CaseStakeholder
        fields = ("id", "user", "username", "role", "created_at")
        read_only_fields = ("id", "username", "created_at")


class FiduciaryCaseListSerializer(serializers.ModelSerializer):
    created_by_username = serializers.CharField(
        source="created_by.username",
        read_only=True,
    )
    assigned_to_username = serializers.CharField(
        source="assigned_to.username",
        read_only=True,
        allow_null=True,
    )
    primary_donor_name = serializers.SerializerMethodField()
    onboarding_step_label = serializers.SerializerMethodField()
    donors_count = serializers.SerializerMethodField()
    beneficiaries_count = serializers.SerializerMethodField()
    mandates_count = serializers.SerializerMethodField()

    def get_primary_donor_name(self, obj: FiduciaryCase) -> str | None:
        donor = obj.donors.all().first()
        if not donor:
            return None
        name = f"{donor.first_name} {donor.last_name}".strip()
        return name or None

    def get_onboarding_step_label(self, obj: FiduciaryCase) -> str | None:
        if not obj.onboarding_step:
            return None
        return get_onboarding_step_label(obj.case_type, obj.onboarding_step)

    def get_donors_count(self, obj: FiduciaryCase) -> int:
        return len(obj.donors.all())

    def get_beneficiaries_count(self, obj: FiduciaryCase) -> int:
        return len(obj.beneficiaries.all())

    def get_mandates_count(self, obj: FiduciaryCase) -> int:
        return len(obj.mandates.all())

    class Meta:
        model = FiduciaryCase
        fields = (
            "id",
            "reference",
            "case_type",
            "title",
            "case_origin",
            "status",
            "onboarding_step",
            "onboarding_step_label",
            "onboarding_completed_at",
            "created_by",
            "created_by_username",
            "assigned_to",
            "assigned_to_username",
            "primary_donor_name",
            "donors_count",
            "beneficiaries_count",
            "mandates_count",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields


class FiduciaryCaseDetailSerializer(serializers.ModelSerializer):
    created_by_username = serializers.CharField(
        source="created_by.username",
        read_only=True,
    )
    assigned_to_username = serializers.CharField(
        source="assigned_to.username",
        read_only=True,
        allow_null=True,
    )
    onboarding = serializers.SerializerMethodField()
    assignment_history = CaseAssignmentSerializer(many=True, read_only=True)
    stakeholders = CaseStakeholderSerializer(many=True, read_only=True)
    timeline_events = CaseTimelineEventSerializer(many=True, read_only=True)
    mandates = MandateSerializer(many=True, read_only=True)
    donors = CaseDonorSerializer(many=True, read_only=True)
    beneficiaries = BeneficiarySerializer(many=True, read_only=True)
    guardians = GuardianSerializer(many=True, read_only=True)
    assets = AssetSerializer(many=True, read_only=True)
    documents = CaseDocumentSummarySerializer(many=True, read_only=True)

    class Meta:
        model = FiduciaryCase
        fields = (
            "id",
            "reference",
            "case_type",
            "title",
            "case_origin",
            "description",
            "status",
            "onboarding_step",
            "onboarding_completed_at",
            "onboarding",
            "created_by",
            "created_by_username",
            "assigned_to",
            "assigned_to_username",
            "assignment_history",
            "created_at",
            "updated_at",
            "stakeholders",
            "timeline_events",
            "mandates",
            "donors",
            "beneficiaries",
            "guardians",
            "assets",
            "documents",
        )
        read_only_fields = (
            "id",
            "reference",
            "status",
            "onboarding",
            "created_by",
            "created_by_username",
            "assigned_to_username",
            "assignment_history",
            "created_at",
            "updated_at",
            "stakeholders",
            "timeline_events",
            "mandates",
            "beneficiaries",
            "guardians",
            "assets",
            "documents",
        )

    def get_onboarding(self, obj: FiduciaryCase) -> dict:
        return get_onboarding_progress(obj)


class FiduciaryCaseCreateSerializer(serializers.ModelSerializer):
    case_type = serializers.ChoiceField(
        choices=CaseType.choices,
        default=CaseType.MANDAT_FIDUCIAIRE,
        required=False,
    )

    class Meta:
        model = FiduciaryCase
        fields = ("case_type", "title", "case_origin", "description", "assigned_to")

    def validate_assigned_to(self, value):
        if value is None:
            return value
        if not User.objects.filter(pk=value.pk).exists():
            raise serializers.ValidationError("Utilisateur assigné introuvable.")
        return value


class FiduciaryCaseUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = FiduciaryCase
        fields = (
            "title",
            "case_origin",
            "description",
            "assigned_to",
            "onboarding_step",
            "onboarding_data",
        )

    def validate_assigned_to(self, value):
        if value is None:
            return value
        from accounts.models import RoleAssignment, UserRole

        is_agent = (
            value.is_superuser
            or RoleAssignment.objects.filter(
                user=value, role=UserRole.AGENT_FIDUCIAIRE
            ).exists()
        )
        if not is_agent:
            raise serializers.ValidationError(
                "Le chargé de dossier doit être un agent fiduciaire."
            )
        return value

    def validate_onboarding_data(self, value):
        if value is None:
            return {}
        if not isinstance(value, dict):
            raise serializers.ValidationError("Format onboarding_data invalide.")
        return value

    def validate(self, attrs):
        instance: FiduciaryCase = self.instance
        if instance and instance.status in (
            CaseStatus.CLOSED,
            CaseStatus.REJECTED,
        ):
            raise serializers.ValidationError(
                "Un dossier clôturé ou rejeté ne peut plus être modifié."
            )
        return attrs


class CaseNoteSerializer(serializers.ModelSerializer):
    author_username = serializers.CharField(source="author.username", read_only=True)

    class Meta:
        model = CaseNote
        fields = ("id", "body", "author", "author_username", "created_at", "updated_at")
        read_only_fields = ("id", "author", "author_username", "created_at", "updated_at")
