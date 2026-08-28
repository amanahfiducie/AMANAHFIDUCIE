from rest_framework import serializers

from faraid.models import (
    FaraidCommitteeReview,
    FaraidHeir,
    FaraidHeirDecision,
    FaraidHeirDecisionStatus,
    FaraidSettlementAction,
)


class FaraidHeirSerializer(serializers.ModelSerializer):
    class Meta:
        model = FaraidHeir
        fields = (
            "id",
            "case",
            "beneficiary",
            "full_name",
            "relationship_label",
            "share_fraction",
            "notes",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "case", "created_at", "updated_at")


class FaraidHeirCreateSerializer(serializers.ModelSerializer):
    beneficiary = serializers.IntegerField(required=False, allow_null=True)

    class Meta:
        model = FaraidHeir
        fields = (
            "beneficiary",
            "full_name",
            "relationship_label",
            "share_fraction",
            "notes",
        )

    def validate_beneficiary(self, value):
        if value in (None, ""):
            return None
        return value


class FaraidHeirDecisionSerializer(serializers.ModelSerializer):
    class Meta:
        model = FaraidHeirDecision
        fields = (
            "id",
            "beneficiary",
            "source",
            "full_name",
            "relationship_label",
            "faraid_role",
            "status",
            "rejection_justification",
            "share_fraction",
            "share_amount",
            "committee_notes",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "source", "created_at", "updated_at")


class FaraidHeirDecisionCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = FaraidHeirDecision
        fields = (
            "full_name",
            "relationship_label",
            "faraid_role",
            "status",
            "rejection_justification",
            "share_fraction",
            "share_amount",
            "committee_notes",
            "beneficiary",
        )

    def validate(self, attrs):
        status = attrs.get("status", FaraidHeirDecisionStatus.PENDING)
        justification = (attrs.get("rejection_justification") or "").strip()
        if status == FaraidHeirDecisionStatus.REJECTED and not justification:
            raise serializers.ValidationError(
                {"rejection_justification": "Justification obligatoire pour une exclusion."}
            )
        return attrs


class FaraidHeirDecisionUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = FaraidHeirDecision
        fields = (
            "full_name",
            "relationship_label",
            "faraid_role",
            "status",
            "rejection_justification",
            "share_fraction",
            "share_amount",
            "committee_notes",
        )

    def validate(self, attrs):
        status = attrs.get("status", getattr(self.instance, "status", None))
        justification = attrs.get(
            "rejection_justification",
            getattr(self.instance, "rejection_justification", ""),
        )
        if status == FaraidHeirDecisionStatus.REJECTED and not str(justification).strip():
            raise serializers.ValidationError(
                {"rejection_justification": "Justification obligatoire pour une exclusion."}
            )
        return attrs


class FaraidSettlementActionSerializer(serializers.ModelSerializer):
    created_by_username = serializers.CharField(
        source="created_by.username",
        read_only=True,
    )

    class Meta:
        model = FaraidSettlementAction
        fields = (
            "id",
            "action_type",
            "title",
            "description",
            "beneficiary",
            "asset",
            "amount",
            "currency",
            "created_by",
            "created_by_username",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_by", "created_by_username", "created_at", "updated_at")


class FaraidSettlementActionCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = FaraidSettlementAction
        fields = (
            "action_type",
            "title",
            "description",
            "beneficiary",
            "asset",
            "amount",
            "currency",
        )


class FaraidCommitteeReviewSerializer(serializers.ModelSerializer):
    heir_decisions = FaraidHeirDecisionSerializer(many=True, read_only=True)
    settlement_actions = FaraidSettlementActionSerializer(many=True, read_only=True)
    requested_by_username = serializers.CharField(
        source="requested_by.username",
        read_only=True,
    )
    finalized_by_username = serializers.CharField(
        source="finalized_by.username",
        read_only=True,
    )

    class Meta:
        model = FaraidCommitteeReview
        fields = (
            "id",
            "case",
            "status",
            "net_estate",
            "currency",
            "committee_notes",
            "requested_at",
            "requested_by",
            "requested_by_username",
            "finalized_at",
            "finalized_by",
            "finalized_by_username",
            "heir_decisions",
            "settlement_actions",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "case",
            "status",
            "requested_at",
            "requested_by",
            "requested_by_username",
            "finalized_at",
            "finalized_by",
            "finalized_by_username",
            "heir_decisions",
            "settlement_actions",
            "created_at",
            "updated_at",
        )


class FaraidCommitteeReviewUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = FaraidCommitteeReview
        fields = ("net_estate", "currency", "committee_notes")


class FaraidReviewSyncSerializer(serializers.Serializer):
    deceased_gender = serializers.ChoiceField(choices=("M", "F"), default="M")
