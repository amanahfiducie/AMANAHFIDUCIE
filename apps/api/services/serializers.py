from rest_framework import serializers

from services.models import (
    BillingFormula,
    BillingPeriodicity,
    ServiceBillingRule,
    ServiceOffer,
)


class ServiceBillingRuleSerializer(serializers.ModelSerializer):
    formula_label = serializers.CharField(source="get_formula_display", read_only=True)
    periodicity_label = serializers.CharField(
        source="get_periodicity_display",
        read_only=True,
    )
    created_by_username = serializers.CharField(
        source="created_by.username",
        read_only=True,
        default=None,
    )

    class Meta:
        model = ServiceBillingRule
        fields = (
            "id",
            "service",
            "formula",
            "formula_label",
            "label",
            "description",
            "rate_percent",
            "rate_min_percent",
            "rate_max_percent",
            "fixed_amount",
            "fixed_amount_min",
            "fixed_amount_max",
            "base_min",
            "base_max",
            "currency",
            "periodicity",
            "periodicity_label",
            "is_active",
            "sort_order",
            "effective_from",
            "effective_to",
            "notes",
            "created_by",
            "created_by_username",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "service",
            "created_by",
            "created_at",
            "updated_at",
            "formula_label",
            "periodicity_label",
            "created_by_username",
        )

    def validate(self, attrs):
        formula = attrs.get("formula") or getattr(self.instance, "formula", None)
        rate = attrs.get("rate_percent")
        if rate is None and self.instance is not None and "rate_percent" not in attrs:
            rate = self.instance.rate_percent
        fixed = attrs.get("fixed_amount")
        if fixed is None and self.instance is not None and "fixed_amount" not in attrs:
            fixed = self.instance.fixed_amount
        rate_min = attrs.get("rate_min_percent")
        if (
            rate_min is None
            and self.instance is not None
            and "rate_min_percent" not in attrs
        ):
            rate_min = self.instance.rate_min_percent
        rate_max = attrs.get("rate_max_percent")
        if (
            rate_max is None
            and self.instance is not None
            and "rate_max_percent" not in attrs
        ):
            rate_max = self.instance.rate_max_percent

        percent_formulas = {
            BillingFormula.MANAGEMENT_FEE_AUM,
            BillingFormula.PERFORMANCE_FEE,
        }
        fixed_formulas = {
            BillingFormula.OPENING_FEE,
            BillingFormula.MISSION_FEE,
        }

        if formula in percent_formulas and rate is None:
            raise serializers.ValidationError(
                {"rate_percent": "Un taux (%) est requis pour cette formule."}
            )
        if formula in fixed_formulas and fixed is None and rate is None:
            # forfait peut rester vide au démarrage (à compléter), on accepte
            pass
        if rate_min is not None and rate_max is not None and rate_min > rate_max:
            raise serializers.ValidationError(
                {"rate_max_percent": "Le taux max doit être ≥ au taux min."}
            )
        if rate is not None and rate_min is not None and rate < rate_min:
            raise serializers.ValidationError(
                {"rate_percent": "Le taux doit être ≥ au taux min."}
            )
        if rate is not None and rate_max is not None and rate > rate_max:
            raise serializers.ValidationError(
                {"rate_percent": "Le taux doit être ≤ au taux max."}
            )
        return attrs


class ServiceBillingRuleWriteSerializer(ServiceBillingRuleSerializer):
    class Meta(ServiceBillingRuleSerializer.Meta):
        read_only_fields = (
            "id",
            "service",
            "created_by",
            "created_at",
            "updated_at",
            "formula_label",
            "periodicity_label",
            "created_by_username",
        )


class ServiceOfferListSerializer(serializers.ModelSerializer):
    case_type_label = serializers.CharField(
        source="get_case_type_display",
        read_only=True,
    )
    active_rules_count = serializers.SerializerMethodField()

    class Meta:
        model = ServiceOffer
        fields = (
            "id",
            "case_type",
            "case_type_label",
            "name",
            "description",
            "is_active",
            "sort_order",
            "active_rules_count",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields

    def get_active_rules_count(self, obj: ServiceOffer) -> int:
        prefetched = getattr(obj, "_active_rules_count", None)
        if prefetched is not None:
            return prefetched
        return obj.billing_rules.filter(is_active=True).count()


class ServiceOfferDetailSerializer(serializers.ModelSerializer):
    case_type_label = serializers.CharField(
        source="get_case_type_display",
        read_only=True,
    )
    billing_rules = ServiceBillingRuleSerializer(many=True, read_only=True)

    class Meta:
        model = ServiceOffer
        fields = (
            "id",
            "case_type",
            "case_type_label",
            "name",
            "description",
            "is_active",
            "sort_order",
            "billing_rules",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "case_type",
            "case_type_label",
            "billing_rules",
            "created_at",
            "updated_at",
        )


class ServiceOfferUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ServiceOffer
        fields = ("name", "description", "is_active", "sort_order")


class BillingMetaSerializer(serializers.Serializer):
    formulas = serializers.ListField()
    periodicities = serializers.ListField()
