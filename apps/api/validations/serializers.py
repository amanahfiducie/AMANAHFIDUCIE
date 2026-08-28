from rest_framework import serializers

from validations.models import (
    ValidationComment,
    ValidationDecision,
    ValidationRequest,
    ValidationStep,
    ValidationSubjectType,
    ValidationType,
)
from validations.services import (
    get_return_targets,
    observation_required_for_decision,
)


class ValidationDecisionSerializer(serializers.ModelSerializer):
    decided_by_username = serializers.CharField(
        source="decided_by.username",
        read_only=True,
    )
    decided_by_name = serializers.SerializerMethodField()

    class Meta:
        model = ValidationDecision
        fields = (
            "id",
            "step",
            "decision",
            "comment",
            "decided_by",
            "decided_by_username",
            "decided_by_name",
            "created_at",
        )
        read_only_fields = fields

    def get_decided_by_name(self, obj: ValidationDecision) -> str:
        user = obj.decided_by
        if not user:
            return ""
        profile = getattr(user, "profile", None)
        display = (getattr(profile, "display_name", None) or "").strip()
        if display:
            return display
        full = (user.get_full_name() or "").strip()
        if full:
            return full
        return user.get_username() or ""


class ValidationStepSerializer(serializers.ModelSerializer):
    decisions = ValidationDecisionSerializer(many=True, read_only=True)
    step_label = serializers.SerializerMethodField()

    class Meta:
        model = ValidationStep
        fields = (
            "id",
            "step_order",
            "assigned_role",
            "step_label",
            "status",
            "decisions",
            "created_at",
        )
        read_only_fields = fields

    def get_step_label(self, obj: ValidationStep) -> str:
        """Libellé canonique par rôle (évite les anciens labels divergents en base)."""
        from validations.services import STEP_LABEL_BY_ROLE

        return (
            STEP_LABEL_BY_ROLE.get(obj.assigned_role)
            or (obj.step_label or "").strip()
            or obj.assigned_role.replace("_", " ").title()
        )


class ValidationCommentSerializer(serializers.ModelSerializer):
    author_username = serializers.CharField(source="author.username", read_only=True)

    class Meta:
        model = ValidationComment
        fields = ("id", "request", "author", "author_username", "body", "created_at")
        read_only_fields = ("id", "request", "author", "author_username", "created_at")


class ValidationRequestSerializer(serializers.ModelSerializer):
    steps = ValidationStepSerializer(many=True, read_only=True)
    current_step = serializers.SerializerMethodField()
    case_reference = serializers.CharField(source="case.reference", read_only=True)
    case_title = serializers.CharField(source="case.title", read_only=True)
    requested_by_username = serializers.CharField(
        source="requested_by.username",
        read_only=True,
    )
    can_decide = serializers.SerializerMethodField()
    latest_decision_comment = serializers.SerializerMethodField()
    return_targets = serializers.SerializerMethodField()

    class Meta:
        model = ValidationRequest
        fields = (
            "id",
            "case",
            "case_reference",
            "case_title",
            "validation_type",
            "subject_type",
            "title",
            "summary",
            "status",
            "financial_movement",
            "mandate",
            "requested_by",
            "requested_by_username",
            "steps",
            "current_step",
            "can_decide",
            "latest_decision_comment",
            "return_targets",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields

    def get_can_decide(self, obj: ValidationRequest) -> bool:
        request = self.context.get("request")
        user = getattr(request, "user", None) if request else None
        if not user or not user.is_authenticated:
            return False
        from validations.services import get_current_step
        from validations.permissions import user_can_decide_step
        from validations.models import ValidationRequestStatus

        if obj.status not in (
            ValidationRequestStatus.PENDING,
            ValidationRequestStatus.IN_PROGRESS,
        ):
            return False
        step = get_current_step(obj)
        if step is None:
            return False
        return user_can_decide_step(user, step.assigned_role, case=obj.case)

    def get_latest_decision_comment(self, obj: ValidationRequest) -> str:
        for step in reversed(list(obj.steps.all())):
            for decision in step.decisions.all():
                comment = (decision.comment or "").strip()
                if comment:
                    return comment
        return ""

    def get_return_targets(self, obj: ValidationRequest) -> list[dict]:
        return get_return_targets(obj)

    def get_current_step(self, obj: ValidationRequest):
        from validations.services import get_current_step

        step = get_current_step(obj)
        if step is None:
            return None
        return ValidationStepSerializer(step).data


class ValidationRequestCreateSerializer(serializers.ModelSerializer):
    case_id = serializers.IntegerField(write_only=True)
    financial_movement_id = serializers.IntegerField(
        required=False,
        allow_null=True,
        write_only=True,
    )
    mandate_id = serializers.IntegerField(required=False, allow_null=True, write_only=True)

    class Meta:
        model = ValidationRequest
        fields = (
            "case_id",
            "validation_type",
            "subject_type",
            "title",
            "summary",
            "financial_movement_id",
            "mandate_id",
        )

    def validate(self, attrs):
        subject_type = attrs.get("subject_type", ValidationSubjectType.OTHER)
        movement_id = attrs.get("financial_movement_id")
        mandate_id = attrs.get("mandate_id")
        if subject_type == ValidationSubjectType.FINANCIAL_MOVEMENT and not movement_id:
            raise serializers.ValidationError(
                {"financial_movement_id": "Requis pour un mouvement financier."}
            )
        if subject_type == ValidationSubjectType.MANDATE and not mandate_id:
            raise serializers.ValidationError(
                {"mandate_id": "Requis pour un mandat."}
            )
        return attrs


class CaseValidationCreateSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=255)
    summary = serializers.CharField(required=False, allow_blank=True, default="")
    subject_type = serializers.ChoiceField(
        choices=ValidationSubjectType.choices,
        default=ValidationSubjectType.CASE,
    )


class ValidationDecisionInputSerializer(serializers.Serializer):
    comment = serializers.CharField(required=False, allow_blank=True, default="")
    return_to_role = serializers.CharField(
        required=False,
        allow_blank=True,
        default="",
    )

    def validate(self, attrs):
        from validations.models import ValidationDecisionType
        from validations.services import get_current_step, get_return_targets

        request = self.context.get("validation_request")
        decision = self.context.get("decision")
        if request and decision and observation_required_for_decision(
            request.validation_type, decision
        ):
            if not (attrs.get("comment") or "").strip():
                raise serializers.ValidationError(
                    {
                        "comment": (
                            "Le motif est obligatoire pour rejeter "
                            "ou demander des modifications."
                        )
                    }
                )

        return_to_role = (attrs.get("return_to_role") or "").strip()
        attrs["return_to_role"] = return_to_role

        if (
            request
            and decision
            in (
                ValidationDecisionType.REJECTED,
                ValidationDecisionType.REQUEST_CHANGES,
            )
        ):
            targets = get_return_targets(request)
            current = get_current_step(request)
            # Multi-étapes : obligation de désigner le pôle qui corrigera.
            if current and current.step_order > 1:
                if not return_to_role:
                    raise serializers.ValidationError(
                        {
                            "return_to_role": (
                                "Sélectionnez la personne / le pôle concerné "
                                "pour apporter les corrections."
                            )
                        }
                    )
            if return_to_role:
                allowed = {t["role"] for t in targets}
                if return_to_role not in allowed:
                    raise serializers.ValidationError(
                        {
                            "return_to_role": (
                                "Le pôle sélectionné n'est pas éligible "
                                "pour ce renvoi."
                            )
                        }
                    )
        return attrs
