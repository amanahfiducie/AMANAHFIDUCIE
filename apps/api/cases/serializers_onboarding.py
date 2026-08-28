from rest_framework import serializers

from cases.onboarding import CASE_TYPE_META, get_steps_for_type


class OnboardingSchemaSerializer(serializers.Serializer):
    case_types = serializers.ListField(read_only=True)


class OnboardingAdvanceSerializer(serializers.Serializer):
    step_id = serializers.CharField(max_length=32)
    onboarding_data = serializers.DictField(required=False)
    skip = serializers.BooleanField(default=False, required=False)

    def validate_step_id(self, value: str) -> str:
        case_type = self.context.get("case_type")
        if not case_type:
            return value
        valid_ids = {s.id for s in get_steps_for_type(case_type)}
        if value not in valid_ids:
            raise serializers.ValidationError("Étape inconnue pour ce type de dossier.")
        return value


class OnboardingWaqfSerializer(serializers.Serializer):
    waqf_intention = serializers.CharField(min_length=20, max_length=5000)
