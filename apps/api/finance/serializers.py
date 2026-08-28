from rest_framework import serializers

from finance.models import (
    FinancialMovement,
    FiduciaryAccount,
    MovementCategory,
    MovementStatus,
)


class MovementCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = MovementCategory
        fields = ("id", "slug", "label", "movement_type")
        read_only_fields = fields


class FiduciaryAccountSerializer(serializers.ModelSerializer):
    current_balance = serializers.SerializerMethodField()

    class Meta:
        model = FiduciaryAccount
        fields = (
            "id",
            "case",
            "name",
            "account_number",
            "currency",
            "opening_balance",
            "current_balance",
            "is_active",
            "created_by",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "case",
            "created_by",
            "current_balance",
            "created_at",
            "updated_at",
        )

    def get_current_balance(self, obj: FiduciaryAccount) -> str:
        from finance.services import compute_account_balance

        return str(compute_account_balance(obj))


class FiduciaryAccountCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = FiduciaryAccount
        fields = ("name", "account_number", "opening_balance")


class FinancialMovementOverviewSerializer(serializers.ModelSerializer):
    case_id = serializers.IntegerField(source="account.case_id", read_only=True)
    case_reference = serializers.CharField(source="account.case.reference", read_only=True)
    account_name = serializers.CharField(source="account.name", read_only=True)
    category_label = serializers.CharField(
        source="category.label",
        read_only=True,
        default=None,
    )
    signed_amount = serializers.SerializerMethodField()

    class Meta:
        model = FinancialMovement
        fields = (
            "id",
            "case_id",
            "case_reference",
            "account",
            "account_name",
            "movement_type",
            "category_label",
            "amount",
            "signed_amount",
            "currency",
            "description",
            "reference",
            "movement_date",
            "status",
            "created_at",
        )
        read_only_fields = fields

    def get_signed_amount(self, obj: FinancialMovement) -> str:
        return str(obj.signed_amount)


class FinancialMovementSerializer(serializers.ModelSerializer):
    signed_amount = serializers.SerializerMethodField()
    category_label = serializers.CharField(
        source="category.label",
        read_only=True,
        default=None,
    )

    class Meta:
        model = FinancialMovement
        fields = (
            "id",
            "account",
            "movement_type",
            "category",
            "category_label",
            "amount",
            "signed_amount",
            "currency",
            "description",
            "reference",
            "movement_date",
            "status",
            "document",
            "created_by",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields

    def get_signed_amount(self, obj: FinancialMovement) -> str:
        return str(obj.signed_amount)


class FinancialMovementCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = FinancialMovement
        fields = (
            "movement_type",
            "category",
            "amount",
            "description",
            "reference",
            "movement_date",
            "document",
        )

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Le montant doit être strictement positif.")
        return value

    def validate(self, attrs):
        category = attrs.get("category")
        movement_type = attrs.get("movement_type")
        if category and movement_type and category.movement_type != movement_type:
            raise serializers.ValidationError(
                {"category": "La catégorie ne correspond pas au type de mouvement."}
            )
        return attrs


class FinancialMovementUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = FinancialMovement
        fields = (
            "movement_type",
            "category",
            "amount",
            "description",
            "reference",
            "movement_date",
            "document",
        )

    def validate(self, attrs):
        instance: FinancialMovement = self.instance
        if instance and instance.status not in (
            MovementStatus.DRAFT,
            MovementStatus.PENDING_VALIDATION,
        ):
            raise serializers.ValidationError(
                "Seuls les mouvements en brouillon ou en validation peuvent être modifiés."
            )
        return attrs
