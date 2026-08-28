from decimal import Decimal

from rest_framework import serializers

from .models import (
    AmanahManagementProfile,
    CaseInvestmentPolicy,
    EnvelopeContribution,
    Investment,
    InvestmentAssetClass,
    InvestmentParticipant,
    PatrimonyInvestmentCategory,
)


class InvestmentAssetClassSerializer(serializers.ModelSerializer):
    class Meta:
        model = InvestmentAssetClass
        fields = (
            "id",
            "slug",
            "label",
            "description",
            "weight_min",
            "weight_max",
            "sort_order",
            "is_active",
        )


class InvestmentAssetClassWriteSerializer(serializers.ModelSerializer):
    slug = serializers.SlugField(required=False, allow_blank=True)

    class Meta:
        model = InvestmentAssetClass
        fields = (
            "slug",
            "label",
            "description",
            "weight_min",
            "weight_max",
            "sort_order",
            "is_active",
        )

    def validate(self, attrs):
        label = attrs.get("label", getattr(self.instance, "label", ""))
        slug = attrs.get("slug") or ""
        if not slug and label:
            from django.utils.text import slugify

            base = slugify(label) or "classe-actif"
            slug = base
            counter = 1
            while InvestmentAssetClass.objects.filter(slug=slug).exclude(
                pk=getattr(self.instance, "pk", None)
            ).exists():
                slug = f"{base}-{counter}"
                counter += 1
            attrs["slug"] = slug
        return attrs


class PatrimonyInvestmentCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = PatrimonyInvestmentCategory
        fields = (
            "id",
            "code",
            "label",
            "objective",
            "target_yield_min",
            "target_yield_max",
            "allocation_targets",
            "default_case_types",
            "sort_order",
            "is_active",
        )


class PatrimonyInvestmentCategoryWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = PatrimonyInvestmentCategory
        fields = (
            "label",
            "objective",
            "target_yield_min",
            "target_yield_max",
            "allocation_targets",
            "sort_order",
            "is_active",
        )


class AmanahManagementProfileSerializer(serializers.ModelSerializer):
    linked_category_code = serializers.CharField(
        source="linked_category.code",
        read_only=True,
        allow_null=True,
    )

    class Meta:
        model = AmanahManagementProfile
        fields = (
            "id",
            "slug",
            "label",
            "code_ar",
            "description",
            "target_yield_min",
            "target_yield_max",
            "linked_category_code",
            "sort_order",
        )


class InvestmentParticipantSerializer(serializers.ModelSerializer):
    beneficiary_name = serializers.SerializerMethodField()
    patrimony_category = PatrimonyInvestmentCategorySerializer(read_only=True)
    patrimony_category_id = serializers.PrimaryKeyRelatedField(
        queryset=PatrimonyInvestmentCategory.objects.filter(is_active=True),
        source="patrimony_category",
        write_only=True,
    )

    class Meta:
        model = InvestmentParticipant
        fields = (
            "id",
            "beneficiary",
            "beneficiary_name",
            "patrimony_category",
            "patrimony_category_id",
            "allocated_amount",
            "share_percent",
        )
        read_only_fields = ("id", "beneficiary_name")

    def get_beneficiary_name(self, obj: InvestmentParticipant) -> str:
        return f"{obj.beneficiary.first_name} {obj.beneficiary.last_name}".strip()


class InvestmentParticipantInputSerializer(serializers.Serializer):
    beneficiary_id = serializers.IntegerField()
    patrimony_category_id = serializers.IntegerField()
    allocated_amount = serializers.DecimalField(max_digits=16, decimal_places=2)
    share_percent = serializers.DecimalField(
        max_digits=7,
        decimal_places=4,
        required=False,
        allow_null=True,
    )


class BeneficiaryCapitalSerializer(serializers.Serializer):
    beneficiary_id = serializers.IntegerField()
    display_name = serializers.CharField()
    patrimony_share_percent = serializers.CharField(allow_null=True)
    patrimony_limit = serializers.DecimalField(max_digits=16, decimal_places=2)
    deployed_amount = serializers.DecimalField(max_digits=16, decimal_places=2)
    available_amount = serializers.DecimalField(max_digits=16, decimal_places=2)
    currency = serializers.CharField()


class CaseBeneficiaryCapitalSerializer(serializers.Serializer):
    case_id = serializers.IntegerField()
    patrimony_total = serializers.DecimalField(max_digits=16, decimal_places=2)
    fiduciary_balance = serializers.DecimalField(max_digits=16, decimal_places=2)
    currency = serializers.CharField()
    beneficiaries = BeneficiaryCapitalSerializer(many=True)


class ChartSliceSerializer(serializers.Serializer):
    code = serializers.CharField(required=False)
    label = serializers.CharField()
    amount = serializers.CharField()
    percent = serializers.FloatField()


class PatrimonyEvolutionPointSerializer(serializers.Serializer):
    date = serializers.CharField()
    value = serializers.CharField()
    investment_id = serializers.IntegerField(required=False)
    label = serializers.CharField(required=False)
    asset_class_slug = serializers.CharField(required=False)
    asset_class_label = serializers.CharField(required=False)


class PatrimonyEvolutionSeriesSerializer(serializers.Serializer):
    slug = serializers.CharField()
    label = serializers.CharField()
    points = PatrimonyEvolutionPointSerializer(many=True)


class InvestedVsAvailableSerializer(serializers.Serializer):
    patrimony_total = serializers.CharField()
    planned_investment_amount = serializers.CharField(allow_null=True, required=False)
    invested_amount = serializers.CharField()
    available_amount = serializers.CharField()
    estimated_uninvested = serializers.CharField()
    invested_percent = serializers.FloatField()
    currency = serializers.CharField()


class ParticipantShareSliceSerializer(serializers.Serializer):
    beneficiary_id = serializers.IntegerField()
    beneficiary_name = serializers.CharField()
    category_code = serializers.CharField()
    category_label = serializers.CharField()
    amount = serializers.CharField()
    percent = serializers.FloatField()


class InvestmentChartsSerializer(serializers.Serializer):
    category_distribution = ChartSliceSerializer(many=True)
    patrimony_evolution = PatrimonyEvolutionPointSerializer(many=True)
    patrimony_evolution_by_asset_class = PatrimonyEvolutionSeriesSerializer(many=True)
    invested_vs_available = InvestedVsAvailableSerializer()
    participant_shares = serializers.ListField(child=serializers.DictField())


class InvestmentCatalogSerializer(serializers.Serializer):
    asset_classes = InvestmentAssetClassSerializer(many=True)
    patrimony_categories = PatrimonyInvestmentCategorySerializer(many=True)
    management_profiles = AmanahManagementProfileSerializer(many=True)


class EnvelopeContributionSerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = EnvelopeContribution
        fields = (
            "id",
            "amount",
            "previous_total",
            "new_total",
            "notes",
            "created_by_name",
            "created_at",
        )
        read_only_fields = fields

    def get_created_by_name(self, obj) -> str:
        user = obj.created_by
        if not user:
            return ""
        full_name = user.get_full_name()
        return full_name or user.username


class EnvelopeContributionCreateSerializer(serializers.Serializer):
    amount = serializers.DecimalField(
        max_digits=16,
        decimal_places=2,
        min_value=Decimal("0.01"),
    )
    notes = serializers.CharField(required=False, allow_blank=True, default="")


class CaseInvestmentPolicySerializer(serializers.ModelSerializer):
    patrimony_category = PatrimonyInvestmentCategorySerializer(read_only=True)
    management_profile = AmanahManagementProfileSerializer(read_only=True)
    envelope_history = EnvelopeContributionSerializer(
        source="envelope_contributions",
        many=True,
        read_only=True,
    )
    patrimony_category_id = serializers.PrimaryKeyRelatedField(
        queryset=PatrimonyInvestmentCategory.objects.filter(is_active=True),
        source="patrimony_category",
        write_only=True,
        required=False,
    )
    management_profile_id = serializers.PrimaryKeyRelatedField(
        queryset=AmanahManagementProfile.objects.filter(is_active=True),
        source="management_profile",
        write_only=True,
        required=False,
    )

    class Meta:
        model = CaseInvestmentPolicy
        fields = (
            "id",
            "patrimony_category",
            "management_profile",
            "patrimony_category_id",
            "management_profile_id",
            "sharia_compliance_score",
            "planned_investment_amount",
            "amanah_management_share_percent",
            "scheduled_payments",
            "notes",
            "envelope_history",
            "updated_at",
        )
        read_only_fields = ("id", "updated_at")


class InvestmentSerializer(serializers.ModelSerializer):
    asset_class = InvestmentAssetClassSerializer(read_only=True)
    asset_class_id = serializers.PrimaryKeyRelatedField(
        queryset=InvestmentAssetClass.objects.filter(is_active=True),
        source="asset_class",
        write_only=True,
    )
    latent_gain = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    participants = InvestmentParticipantSerializer(many=True, read_only=True)
    participant_shares = serializers.SerializerMethodField()

    class Meta:
        model = Investment
        fields = (
            "id",
            "case",
            "asset_class",
            "asset_class_id",
            "label",
            "reference",
            "amount_invested",
            "current_value",
            "latent_gain",
            "currency",
            "start_date",
            "maturity_date",
            "status",
            "annual_yield_percent",
            "distributed_income",
            "sharia_compliance_score",
            "requires_purification",
            "purification_amount",
            "notes",
            "risk_summary",
            "participants",
            "participant_shares",
            "created_by_name",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "case", "created_at", "updated_at", "created_by_name")

    def get_created_by_name(self, obj: Investment) -> str | None:
        if not obj.created_by:
            return None
        name = f"{obj.created_by.first_name} {obj.created_by.last_name}".strip()
        return name or obj.created_by.username

    def get_latent_gain(self, obj: Investment):
        return obj.latent_gain

    def get_participant_shares(self, obj: Investment):
        from investments.services import build_participant_share_slices

        return build_participant_share_slices(obj)


class InvestmentCreateSerializer(serializers.ModelSerializer):
    asset_class_id = serializers.PrimaryKeyRelatedField(
        queryset=InvestmentAssetClass.objects.filter(is_active=True),
        source="asset_class",
    )
    participants = InvestmentParticipantInputSerializer(many=True, required=False)

    class Meta:
        model = Investment
        fields = (
            "asset_class_id",
            "label",
            "reference",
            "amount_invested",
            "current_value",
            "currency",
            "start_date",
            "maturity_date",
            "status",
            "annual_yield_percent",
            "distributed_income",
            "sharia_compliance_score",
            "requires_purification",
            "purification_amount",
            "notes",
            "risk_summary",
            "participants",
        )


class InvestmentUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Investment
        fields = (
            "label",
            "reference",
            "amount_invested",
            "current_value",
            "currency",
            "start_date",
            "maturity_date",
            "status",
            "annual_yield_percent",
            "distributed_income",
            "sharia_compliance_score",
            "requires_purification",
            "purification_amount",
            "notes",
            "risk_summary",
        )


class InvestmentDashboardSummarySerializer(serializers.Serializer):
    total_value = serializers.DecimalField(max_digits=16, decimal_places=2)
    asset_count = serializers.IntegerField()
    beneficiary_count = serializers.IntegerField()
    annual_yield_percent = serializers.FloatField(allow_null=True)
    distributed_income = serializers.DecimalField(max_digits=16, decimal_places=2)
    latent_gain = serializers.DecimalField(max_digits=16, decimal_places=2)
    sharia_compliance_score = serializers.FloatField(allow_null=True)
    watchlist_count = serializers.IntegerField()
    purification_total = serializers.DecimalField(max_digits=16, decimal_places=2)
    heirs_count = serializers.IntegerField()
    indivision_risk = serializers.CharField()
    allocation_actual = serializers.DictField(child=serializers.FloatField())
    allocation_target = serializers.DictField(child=serializers.FloatField())


class InvestmentWatchlistItemSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    label = serializers.CharField()
    reason = serializers.CharField()


class CaseInvestmentDashboardSerializer(serializers.Serializer):
    case_id = serializers.IntegerField()
    case_reference = serializers.CharField()
    case_title = serializers.CharField()
    case_type = serializers.CharField()
    policy = CaseInvestmentPolicySerializer()
    investments = InvestmentSerializer(many=True)
    summary = InvestmentDashboardSummarySerializer()
    watchlist = InvestmentWatchlistItemSerializer(many=True)
    charts = InvestmentChartsSerializer()


class InvestmentOverviewCaseSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    reference = serializers.CharField()
    title = serializers.CharField()
    case_type = serializers.CharField()
    investment_count = serializers.IntegerField()
    total_value = serializers.DecimalField(max_digits=16, decimal_places=2)
    planned_investment_amount = serializers.CharField(allow_null=True, required=False)


class ManagementInvestmentAllocationSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    case_id = serializers.IntegerField(allow_null=True)
    case_reference = serializers.CharField(allow_null=True, required=False)
    case_title = serializers.CharField(allow_null=True, required=False)
    amount_invested = serializers.CharField()


class ManagementInvestmentSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    case_id = serializers.IntegerField(allow_null=True)
    case_reference = serializers.CharField(allow_null=True, required=False)
    case_title = serializers.CharField(allow_null=True, required=False)
    label = serializers.CharField()
    amount_invested = serializers.CharField()
    current_value = serializers.CharField()
    latent_gain = serializers.CharField(required=False)
    status = serializers.CharField()
    start_date = serializers.CharField()
    asset_class_slug = serializers.CharField(required=False)
    asset_class_label = serializers.CharField()
    annual_yield_percent = serializers.CharField(allow_null=True, required=False)
    participant_shares = ParticipantShareSliceSerializer(many=True)
    allocated_amount = serializers.CharField(required=False)
    allocation_progress_percent = serializers.FloatField(required=False)
    is_allocation_complete = serializers.BooleanField(required=False)
    is_envelope = serializers.BooleanField(required=False)
    allocations = ManagementInvestmentAllocationSerializer(many=True, required=False)


class InvestmentEnvelopeCreateSerializer(serializers.Serializer):
    asset_class_id = serializers.PrimaryKeyRelatedField(
        queryset=InvestmentAssetClass.objects.filter(is_active=True),
        source="asset_class",
    )
    label = serializers.CharField(max_length=255)
    reference = serializers.CharField(required=False, allow_blank=True, default="")
    notes = serializers.CharField(required=False, allow_blank=True, default="")
    risk_summary = serializers.CharField(required=False, allow_blank=True, default="")
    amount_invested = serializers.DecimalField(max_digits=16, decimal_places=2)
    current_value = serializers.DecimalField(
        max_digits=16, decimal_places=2, required=False
    )
    start_date = serializers.DateField()
    status = serializers.ChoiceField(
        choices=Investment.Status.choices,
        required=False,
        default=Investment.Status.PENDING_VALIDATION,
    )
    annual_yield_percent = serializers.DecimalField(
        max_digits=6, decimal_places=2, required=False, allow_null=True
    )
    allocations = serializers.ListField(
        child=serializers.DictField(),
        required=False,
        default=list,
    )


class InvestmentAllocateSerializer(serializers.Serializer):
    case_id = serializers.IntegerField()
    amount = serializers.DecimalField(max_digits=16, decimal_places=2)


class InvestmentValuationSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    value = serializers.CharField()
    currency = serializers.CharField()
    valued_at = serializers.CharField()
    notes = serializers.CharField()
    created_by_name = serializers.CharField(allow_null=True, required=False)
    created_at = serializers.CharField()


class InvestmentValuationCreateSerializer(serializers.Serializer):
    value = serializers.DecimalField(max_digits=16, decimal_places=2)
    valued_at = serializers.DateField()
    notes = serializers.CharField(required=False, allow_blank=True, default="")


class InvestmentsGlobalDashboardSerializer(serializers.Serializer):
    cases = InvestmentOverviewCaseSerializer(many=True)
    asset_classes = InvestmentAssetClassSerializer(many=True)
    totals = serializers.DictField()
    stats = serializers.DictField()
    distribution = ChartSliceSerializer(many=True)
    patrimony_evolution_by_asset_class = PatrimonyEvolutionSeriesSerializer(many=True)
    management_investments = ManagementInvestmentSerializer(many=True)


class AssetClassDashboardSerializer(serializers.Serializer):
    asset_class = InvestmentAssetClassSerializer()
    stats = serializers.DictField()
    investments = ManagementInvestmentSerializer(many=True)
    cases = InvestmentOverviewCaseSerializer(many=True)
    patrimony_evolution = PatrimonyEvolutionPointSerializer(many=True)


class InvestmentsManagementSerializer(serializers.Serializer):
    cases = InvestmentOverviewCaseSerializer(many=True)
    categories = PatrimonyInvestmentCategorySerializer(many=True)
    profiles = AmanahManagementProfileSerializer(many=True)
    asset_classes = InvestmentAssetClassSerializer(many=True)
    totals = serializers.DictField()
    management_investments = ManagementInvestmentSerializer(many=True)


class InvestmentOverviewSerializer(serializers.Serializer):
    cases = InvestmentOverviewCaseSerializer(many=True)
    categories = PatrimonyInvestmentCategorySerializer(many=True)
    profiles = AmanahManagementProfileSerializer(many=True)
    asset_classes = InvestmentAssetClassSerializer(many=True)
    totals = serializers.DictField()
