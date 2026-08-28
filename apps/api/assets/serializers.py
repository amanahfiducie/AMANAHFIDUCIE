from datetime import date

from rest_framework import serializers

from assets.validators import rename_justification_upload, validate_pdf_upload
from assets.models import (
    Asset,
    AssetEvent,
    AssetEventCategory,
    AssetEventStatus,
    AssetEventType,
    AssetIncome,
    AssetRisk,
    AssetValuation,
    ExpenseKind,
    GainReference,
    ValuationFrequency,
)


class AssetValuationSerializer(serializers.ModelSerializer):
    created_by_username = serializers.CharField(
        source="created_by.username",
        read_only=True,
    )

    class Meta:
        model = AssetValuation
        fields = (
            "id",
            "value",
            "currency",
            "valued_at",
            "method",
            "notes",
            "created_by",
            "created_by_username",
            "created_at",
        )
        read_only_fields = ("id", "created_by", "created_by_username", "created_at")


class AssetRiskSerializer(serializers.ModelSerializer):
    created_by_username = serializers.CharField(
        source="created_by.username",
        read_only=True,
    )

    class Meta:
        model = AssetRisk
        fields = (
            "id",
            "risk_level",
            "category",
            "description",
            "identified_at",
            "created_by",
            "created_by_username",
            "created_at",
        )
        read_only_fields = ("id", "created_by", "created_by_username", "created_at")


class AssetIncomeSerializer(serializers.ModelSerializer):
    class Meta:
        model = AssetIncome
        fields = (
            "id",
            "amount",
            "currency",
            "income_type",
            "period_start",
            "period_end",
            "notes",
            "created_at",
        )
        read_only_fields = fields


class AssetEventCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = AssetEventCategory
        fields = (
            "id",
            "event_type",
            "name",
            "description",
            "billing_kind",
            "default_amount",
            "created_at",
        )
        read_only_fields = ("id", "created_at")


class AssetEventCategoryCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = AssetEventCategory
        fields = (
            "event_type",
            "name",
            "description",
            "billing_kind",
            "default_amount",
        )

    def validate_name(self, value: str) -> str:
        name = (value or "").strip()
        if not name:
            raise serializers.ValidationError("Le nom est requis.")
        return name

    def validate(self, attrs):
        billing = attrs.get("billing_kind", ExpenseKind.VARIABLE)
        amount = attrs.get("default_amount")
        if billing == ExpenseKind.FIXED:
            if amount is None:
                raise serializers.ValidationError(
                    {"default_amount": ["Montant fixe requis pour une catégorie fixe."]},
                )
        elif amount is not None:
            attrs["default_amount"] = None
        return attrs


class AssetEventSerializer(serializers.ModelSerializer):
    created_by_username = serializers.CharField(
        source="created_by.username",
        read_only=True,
    )
    justification_filename = serializers.SerializerMethodField()
    has_justification = serializers.SerializerMethodField()
    category_name = serializers.CharField(source="category.name", read_only=True, default=None)
    category_description = serializers.CharField(
        source="category.description",
        read_only=True,
        default=None,
    )
    category_billing_kind = serializers.CharField(
        source="category.billing_kind",
        read_only=True,
        default=None,
    )

    class Meta:
        model = AssetEvent
        fields = (
            "id",
            "event_type",
            "status",
            "category",
            "category_name",
            "category_description",
            "category_billing_kind",
            "reference",
            "title",
            "description",
            "amount",
            "currency",
            "event_date",
            "justification_filename",
            "has_justification",
            "expense_kind",
            "created_by",
            "created_by_username",
            "created_at",
            "updated_at",
            "cancelled_at",
        )
        read_only_fields = (
            "id",
            "status",
            "justification_filename",
            "has_justification",
            "created_by",
            "created_by_username",
            "created_at",
            "updated_at",
            "cancelled_at",
        )

    def get_justification_filename(self, obj: AssetEvent) -> str | None:
        if not obj.justification_file:
            return None
        return obj.justification_file.name.split("/")[-1]

    def get_has_justification(self, obj: AssetEvent) -> bool:
        return bool(obj.justification_file)


def _apply_custom_category_defaults(attrs: dict) -> dict:
    category = attrs.get("category")
    if not category:
        return attrs
    attrs["event_type"] = category.event_type
    if category.event_type == AssetEventType.GAIN and not attrs.get("reference"):
        attrs["reference"] = GainReference.OTHER
    if category.event_type in (AssetEventType.EXPENSE, AssetEventType.GAIN):
        attrs["expense_kind"] = category.billing_kind
    elif category.event_type == AssetEventType.OTHER and not (attrs.get("title") or "").strip():
        attrs["title"] = category.name
    if (
        category.billing_kind == ExpenseKind.FIXED
        and category.default_amount is not None
        and attrs.get("amount") is None
    ):
        attrs["amount"] = category.default_amount
    return attrs


def _validate_asset_event_fields(attrs: dict, *, partial: bool = False) -> dict:
    attrs = _apply_custom_category_defaults(attrs)
    event_type = attrs.get("event_type")
    if not event_type and not partial:
        raise serializers.ValidationError({"event_type": "Type requis."})

    errors: dict[str, list[str]] = {}

    if attrs.get("category"):
        if attrs["category"].event_type != event_type:
            errors["category"] = ["La catégorie ne correspond pas au type d’événement."]
        if (
            attrs["category"].billing_kind == ExpenseKind.FIXED
            and attrs["category"].default_amount is None
        ):
            errors["category"] = ["Catégorie fixe sans montant configuré."]
        if event_type == AssetEventType.GAIN:
            if attrs.get("amount") is None:
                errors["amount"] = ["Montant requis."]
            if not attrs.get("event_date"):
                errors["event_date"] = ["Date requise."]
        elif event_type == AssetEventType.EXPENSE:
            if attrs.get("amount") is None:
                errors["amount"] = ["Montant requis."]
            if not attrs.get("event_date"):
                errors["event_date"] = ["Date requise."]
        elif event_type == AssetEventType.ESTIMATION:
            if not attrs.get("event_date"):
                errors["event_date"] = ["Date requise."]
            if attrs.get("amount") is None:
                errors["amount"] = ["Montant requis."]
        elif event_type == AssetEventType.OTHER:
            if not (attrs.get("title") or "").strip():
                errors["title"] = ["Titre requis."]
        if errors:
            raise serializers.ValidationError(errors)
        return attrs

    if event_type == AssetEventType.GAIN:
        if not attrs.get("reference"):
            errors["reference"] = ["Référence de gain requise."]
        if attrs.get("amount") is None:
            errors["amount"] = ["Montant requis."]
        if not attrs.get("event_date"):
            errors["event_date"] = ["Date requise."]
    elif event_type == AssetEventType.EXPENSE:
        if not attrs.get("expense_kind"):
            errors["expense_kind"] = ["Type de dépense (fixe ou variable) requis."]
        if attrs.get("amount") is None:
            errors["amount"] = ["Montant requis."]
        if not attrs.get("event_date"):
            errors["event_date"] = ["Date requise."]
    elif event_type == AssetEventType.ESTIMATION:
        if not attrs.get("event_date"):
            errors["event_date"] = ["Date requise."]
        if attrs.get("amount") is None:
            errors["amount"] = ["Montant requis."]
    elif event_type == AssetEventType.OTHER:
        if not (attrs.get("title") or "").strip():
            errors["title"] = ["Titre requis."]

    if errors:
        raise serializers.ValidationError(errors)
    return attrs


def _event_label_from_attrs(attrs: dict) -> str:
    category = attrs.get("category")
    if category is not None:
        return category.name
    event_type = attrs.get("event_type")
    if event_type == AssetEventType.OTHER:
        return (attrs.get("title") or "").strip() or "autre"
    if event_type == AssetEventType.GAIN:
        ref = attrs.get("reference") or ""
        return dict(GainReference.choices).get(ref, ref) or "gain"
    if event_type == AssetEventType.EXPENSE:
        kind = attrs.get("expense_kind") or ""
        return dict(ExpenseKind.choices).get(kind, kind) or "depense"
    if event_type == AssetEventType.ESTIMATION:
        return "estimation"
    return "evenement"


def _rename_justification_in_attrs(attrs: dict) -> dict:
    uploaded = attrs.get("justification_file")
    if uploaded is not None:
        rename_justification_upload(
            uploaded,
            label=_event_label_from_attrs(attrs),
            event_date=attrs.get("event_date"),
        )
    return attrs


class AssetEventCreateSerializer(serializers.ModelSerializer):
    justification_file = serializers.FileField()
    category_id = serializers.PrimaryKeyRelatedField(
        source="category",
        queryset=AssetEventCategory.objects.all(),
        required=False,
        allow_null=True,
    )

    class Meta:
        model = AssetEvent
        fields = (
            "event_type",
            "category_id",
            "reference",
            "title",
            "description",
            "amount",
            "currency",
            "event_date",
            "justification_file",
            "expense_kind",
        )

    def validate_category_id(self, category):
        asset = self.context.get("asset")
        if category and asset and category.asset_id != asset.pk:
            raise serializers.ValidationError("Catégorie invalide pour cet actif.")
        return category

    def validate(self, attrs):
        if not attrs.get("justification_file"):
            raise serializers.ValidationError(
                {"justification_file": ["Le justificatif PDF est obligatoire."]},
            )
        category = attrs.get("category")
        if category:
            attrs["event_type"] = category.event_type
        elif not attrs.get("event_type"):
            raise serializers.ValidationError(
                {"category_id": ["La catégorie est obligatoire."]},
            )
        attrs = _validate_asset_event_fields(attrs)
        return _rename_justification_in_attrs(attrs)


class AssetEventUpdateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, trim_whitespace=False)
    justification_file = serializers.FileField(required=False, allow_null=True)
    category_id = serializers.PrimaryKeyRelatedField(
        source="category",
        queryset=AssetEventCategory.objects.all(),
        required=False,
        allow_null=True,
    )

    class Meta:
        model = AssetEvent
        fields = (
            "password",
            "category_id",
            "reference",
            "title",
            "description",
            "amount",
            "currency",
            "event_date",
            "justification_file",
            "expense_kind",
        )

    def validate_justification_file(self, value):
        if value is not None:
            validate_pdf_upload(value)
        return value

    def validate(self, attrs):
        attrs = super().validate(attrs)
        password = attrs.pop("password", None)
        request = self.context.get("request")
        if not password or not request or not request.user.check_password(password):
            raise serializers.ValidationError(
                {"password": "Mot de passe incorrect."},
            )
        merged = {}
        if self.instance:
            merged["event_type"] = self.instance.event_type
            merged["category"] = attrs.get("category", self.instance.category)
            for field in (
                "reference",
                "title",
                "description",
                "amount",
                "event_date",
                "expense_kind",
            ):
                if field in attrs:
                    merged[field] = attrs[field]
                else:
                    merged[field] = getattr(self.instance, field, None)
            has_file = bool(attrs.get("justification_file")) or bool(
                self.instance.justification_file,
            )
            if not has_file:
                raise serializers.ValidationError(
                    {
                        "justification_file": [
                            "Le justificatif PDF est obligatoire.",
                        ],
                    },
                )
            if attrs.get("justification_file") is not None:
                merged["justification_file"] = attrs["justification_file"]
        merged = _validate_asset_event_fields(merged, partial=True)
        return _rename_justification_in_attrs(merged)


class AssetEventCancelSerializer(serializers.Serializer):
    password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate_password(self, value: str) -> str:
        request = self.context.get("request")
        if not request or not request.user.check_password(value):
            raise serializers.ValidationError("Mot de passe incorrect.")
        return value


class AssetSerializer(serializers.ModelSerializer):
    valuations = AssetValuationSerializer(many=True, read_only=True)
    risks = AssetRiskSerializer(many=True, read_only=True)
    events = AssetEventSerializer(many=True, read_only=True)
    latest_value = serializers.SerializerMethodField()
    latest_currency = serializers.SerializerMethodField()
    valuation_overdue = serializers.SerializerMethodField()

    class Meta:
        model = Asset
        fields = (
            "id",
            "case",
            "asset_type",
            "label",
            "description",
            "location",
            "currency",
            "quantity",
            "unit",
            "is_active",
            "valuation_frequency",
            "valuation_next_due",
            "valuation_overdue",
            "created_by",
            "created_at",
            "updated_at",
            "valuations",
            "risks",
            "events",
            "latest_value",
            "latest_currency",
        )
        read_only_fields = (
            "id",
            "case",
            "created_by",
            "created_at",
            "updated_at",
            "valuations",
            "risks",
            "events",
            "latest_value",
            "latest_currency",
            "valuation_next_due",
            "valuation_overdue",
        )

    def get_valuation_overdue(self, obj: Asset) -> bool:
        due = obj.valuation_next_due
        return bool(due and due < date.today())

    def get_latest_value(self, obj: Asset) -> str | None:
        latest = obj.latest_valuation
        return str(latest.value) if latest else None

    def get_latest_currency(self, obj: Asset) -> str | None:
        latest = obj.latest_valuation
        return latest.currency if latest else obj.currency


class AssetCreateSerializer(serializers.ModelSerializer):
    valuation_frequency = serializers.ChoiceField(
        choices=ValuationFrequency.choices,
        default=ValuationFrequency.QUARTERLY,
    )

    class Meta:
        model = Asset
        fields = (
            "asset_type",
            "label",
            "description",
            "location",
            "quantity",
            "unit",
            "valuation_frequency",
        )


class AssetUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Asset
        fields = (
            "asset_type",
            "label",
            "description",
            "location",
            "quantity",
            "unit",
            "is_active",
            "valuation_frequency",
        )


class AssetValuationCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = AssetValuation
        fields = ("value", "valued_at", "method", "notes")


class AssetRiskCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = AssetRisk
        fields = ("risk_level", "category", "description", "identified_at")
