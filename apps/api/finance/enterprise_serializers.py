from rest_framework import serializers

from finance.category_catalog import SERVICE_TYPE_LABELS
from finance.category_utils import make_unique_category_slug, next_category_sort_order, SCOPE_MOVEMENT_TYPE
from finance.models import (
    CategoryScope,
    EnterpriseAccount,
    EnterpriseJustificatif,
    EnterpriseMovement,
    MovementCategory,
    MovementStatus,
    MovementType,
)


class MovementCategorySerializer(serializers.ModelSerializer):
    service_type_label = serializers.SerializerMethodField()
    movement_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = MovementCategory
        fields = (
            "id",
            "slug",
            "label",
            "movement_type",
            "scope",
            "service_type",
            "service_type_label",
            "sort_order",
            "is_active",
            "is_system",
            "movement_count",
        )
        read_only_fields = (
            "id",
            "slug",
            "movement_type",
            "service_type",
            "service_type_label",
            "is_system",
            "movement_count",
        )

    def get_service_type_label(self, obj: MovementCategory) -> str | None:
        if not obj.service_type:
            return None
        return SERVICE_TYPE_LABELS.get(obj.service_type, obj.service_type)


class MovementCategoryCreateSerializer(serializers.Serializer):
    label = serializers.CharField(max_length=128)
    scope = serializers.ChoiceField(choices=[CategoryScope.REVENUE, CategoryScope.EXPENSE])

    def validate_label(self, value: str) -> str:
        label = value.strip()
        if len(label) < 2:
            raise serializers.ValidationError("Libellé trop court (2 caractères minimum).")
        return label

    def create(self, validated_data):
        scope = validated_data["scope"]
        label = validated_data["label"]
        return MovementCategory.objects.create(
            slug=make_unique_category_slug(label, scope),
            label=label,
            scope=scope,
            movement_type=SCOPE_MOVEMENT_TYPE[scope],
            sort_order=next_category_sort_order(scope),
            is_active=True,
            is_system=False,
        )


class MovementCategoryUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = MovementCategory
        fields = ("label", "sort_order", "is_active")

    def validate_label(self, value: str) -> str:
        label = value.strip()
        if len(label) < 2:
            raise serializers.ValidationError("Libellé trop court (2 caractères minimum).")
        return label


class EnterpriseJustificatifSerializer(serializers.ModelSerializer):
    uploaded_by_username = serializers.CharField(source="uploaded_by.username", read_only=True)
    download_url = serializers.SerializerMethodField()

    class Meta:
        model = EnterpriseJustificatif
        fields = (
            "id",
            "movement",
            "title",
            "original_filename",
            "mime_type",
            "size_bytes",
            "uploaded_by",
            "uploaded_by_username",
            "download_url",
            "created_at",
        )
        read_only_fields = fields

    def get_download_url(self, obj: EnterpriseJustificatif) -> str | None:
        request = self.context.get("request")
        if not request or not obj.file:
            return None
        return request.build_absolute_uri(
            f"/api/v1/enterprise/justificatifs/{obj.pk}/download/"
        )


class EnterpriseAccountSerializer(serializers.ModelSerializer):
    current_balance = serializers.SerializerMethodField()
    account_type_label = serializers.CharField(source="get_account_type_display", read_only=True)

    class Meta:
        model = EnterpriseAccount
        fields = (
            "id",
            "name",
            "account_number",
            "account_type",
            "account_type_label",
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
            "created_by",
            "current_balance",
            "created_at",
            "updated_at",
        )

    def get_current_balance(self, obj: EnterpriseAccount) -> str:
        from finance.enterprise_services import compute_enterprise_account_balance

        return str(compute_enterprise_account_balance(obj))


class EnterpriseAccountCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = EnterpriseAccount
        fields = ("name", "account_number", "account_type", "currency", "opening_balance")


class EnterpriseMovementSerializer(serializers.ModelSerializer):
    signed_amount = serializers.SerializerMethodField()
    account_name = serializers.CharField(source="account.name", read_only=True)
    category_label = serializers.CharField(
        source="category.label",
        read_only=True,
        default=None,
    )
    justificatif_count = serializers.SerializerMethodField()
    justificatifs = EnterpriseJustificatifSerializer(many=True, read_only=True)

    class Meta:
        model = EnterpriseMovement
        fields = (
            "id",
            "account",
            "account_name",
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
            "justificatif_count",
            "justificatifs",
            "created_by",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields

    def get_signed_amount(self, obj: EnterpriseMovement) -> str:
        return str(obj.signed_amount)

    def get_justificatif_count(self, obj: EnterpriseMovement) -> int:
        if hasattr(obj, "_justificatif_count"):
            return obj._justificatif_count  # type: ignore[attr-defined]
        return obj.justificatifs.count()


class EnterpriseMovementCreateSerializer(serializers.ModelSerializer):
    account = serializers.PrimaryKeyRelatedField(
        queryset=EnterpriseAccount.objects.filter(is_active=True),
        required=False,
        allow_null=True,
    )

    class Meta:
        model = EnterpriseMovement
        fields = (
            "account",
            "movement_type",
            "category",
            "amount",
            "description",
            "reference",
            "movement_date",
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
        if movement_type == MovementType.INCOME:
            if not category:
                raise serializers.ValidationError(
                    {"category": "Sélectionnez une catégorie de recette."}
                )
            if category.scope != CategoryScope.REVENUE:
                raise serializers.ValidationError(
                    {"category": "La catégorie doit être une recette."}
                )
        if movement_type == MovementType.EXPENSE:
            if not category:
                raise serializers.ValidationError(
                    {"category": "Sélectionnez une catégorie de dépense."}
                )
            if category.scope != CategoryScope.EXPENSE:
                raise serializers.ValidationError(
                    {"category": "La catégorie doit être une dépense."}
                )
        return attrs


class EnterpriseMovementUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = EnterpriseMovement
        fields = (
            "movement_type",
            "category",
            "amount",
            "description",
            "reference",
            "movement_date",
            "status",
        )

    def validate(self, attrs):
        instance: EnterpriseMovement = self.instance
        if instance and instance.status == MovementStatus.APPROVED:
            if any(k for k in attrs if k != "status"):
                raise serializers.ValidationError(
                    "Un mouvement approuvé ne peut plus être modifié."
                )
        return attrs
