from decimal import Decimal

from django.db import transaction
from drf_spectacular.utils import extend_schema
from rest_framework import mixins, status, viewsets
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.authentication import JWTAuthentication

from auditlog.services import log_audit
from cases.access import ensure_case_writable, get_accessible_case_or_404
from cases.permissions import user_can_write_case
from investments.permissions import CanAccessInvestments

from .models import (
    AmanahManagementProfile,
    EnvelopeContribution,
    Investment,
    InvestmentAssetClass,
    PatrimonyInvestmentCategory,
)
from .serializers import (
    AssetClassDashboardSerializer,
    CaseBeneficiaryCapitalSerializer,
    CaseInvestmentDashboardSerializer,
    CaseInvestmentPolicySerializer,
    EnvelopeContributionCreateSerializer,
    EnvelopeContributionSerializer,
    InvestmentAllocateSerializer,
    InvestmentAssetClassSerializer,
    InvestmentAssetClassWriteSerializer,
    InvestmentCatalogSerializer,
    InvestmentCreateSerializer,
    InvestmentEnvelopeCreateSerializer,
    InvestmentOverviewSerializer,
    InvestmentValuationCreateSerializer,
    InvestmentValuationSerializer,
    InvestmentsGlobalDashboardSerializer,
    InvestmentsManagementSerializer,
    InvestmentSerializer,
    InvestmentUpdateSerializer,
    PatrimonyInvestmentCategorySerializer,
    PatrimonyInvestmentCategoryWriteSerializer,
)
from .services import (
    allocate_investment_to_case,
    build_asset_class_dashboard,
    build_case_investment_dashboard,
    build_investments_global_dashboard,
    build_investments_management,
    build_investments_overview,
    case_supports_investments,
    create_investment_envelope,
    create_investment_participants,
    ensure_case_investment_policy,
    serialize_case_overview,
    get_case_beneficiary_capital,
    build_investment_valuation_evolution,
    record_investment_valuation,
    resolve_investment_envelope,
    serialize_investment_valuation,
    validate_investment_participants,
    _serialize_management_investment,
)


class InvestmentCatalogView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated, CanAccessInvestments]

    @extend_schema(
        summary="Catalogue PIGFI (classes d'actifs, catégories, profils)",
        tags=("Investissements",),
        responses=InvestmentCatalogSerializer,
    )
    def get(self, request):
        payload = {
            "asset_classes": InvestmentAssetClass.objects.filter(is_active=True),
            "patrimony_categories": PatrimonyInvestmentCategory.objects.filter(
                is_active=True
            ),
            "management_profiles": AmanahManagementProfile.objects.filter(is_active=True),
        }
        return Response(InvestmentCatalogSerializer(payload).data)


class InvestmentsOverviewView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated, CanAccessInvestments]

    @extend_schema(
        summary="Vue d'ensemble investissements (dossiers S1/S2)",
        tags=("Investissements",),
        responses=InvestmentOverviewSerializer,
    )
    def get(self, request):
        overview = build_investments_overview(request.user)
        cases_payload = [serialize_case_overview(case) for case in overview["cases"]]
        return Response(
            InvestmentOverviewSerializer(
                {
                    "cases": cases_payload,
                    "categories": overview["categories"],
                    "profiles": overview["profiles"],
                    "asset_classes": overview["asset_classes"],
                    "totals": {
                        "case_count": overview["totals"]["case_count"],
                        "total_value": str(overview["totals"]["total_value"]),
                        "investment_count": overview["totals"]["investment_count"],
                    },
                }
            ).data
        )


class InvestmentsManagementView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated, CanAccessInvestments]

    @extend_schema(
        summary="Gestion investissements (catégories + positions + parts clients)",
        tags=("Investissements",),
        responses=InvestmentsManagementSerializer,
    )
    def get(self, request):
        data = build_investments_management(request.user)
        cases_payload = [serialize_case_overview(case) for case in data["cases"]]
        management_investments = [
            _serialize_management_investment(row) for row in data["management_investments"]
        ]
        return Response(
            InvestmentsManagementSerializer(
                {
                    "cases": cases_payload,
                    "categories": data["categories"],
                    "profiles": data["profiles"],
                    "asset_classes": data["asset_classes"],
                    "totals": {
                        "case_count": data["totals"]["case_count"],
                        "total_value": str(data["totals"]["total_value"]),
                        "investment_count": data["totals"]["investment_count"],
                    },
                    "management_investments": management_investments,
                }
            ).data
        )


class InvestmentsGlobalDashboardView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated, CanAccessInvestments]

    @extend_schema(
        summary="Tableau de bord global PIGFI",
        tags=("Investissements",),
        responses=InvestmentsGlobalDashboardSerializer,
    )
    def get(self, request):
        data = build_investments_global_dashboard(request.user)
        payload = {
            **data,
            "cases": [serialize_case_overview(c) for c in data["cases"]],
            "totals": {
                "case_count": data["totals"]["case_count"],
                "total_value": str(data["totals"]["total_value"]),
                "investment_count": data["totals"]["investment_count"],
            },
        }
        return Response(InvestmentsGlobalDashboardSerializer(payload).data)


class AssetClassDashboardView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated, CanAccessInvestments]

    @extend_schema(
        summary="Tableau de bord d'une catégorie d'investissement (classe d'actif)",
        tags=("Investissements",),
        responses=AssetClassDashboardSerializer,
    )
    def get(self, request, slug: str):
        data = build_asset_class_dashboard(request.user, slug)
        if not data:
            raise ValidationError("Catégorie d'investissement introuvable.")
        payload = {
            **data,
            "cases": [serialize_case_overview(c) for c in data["cases"]],
        }
        return Response(AssetClassDashboardSerializer(payload).data)


class CaseBeneficiaryCapitalView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated, CanAccessInvestments]

    @extend_schema(
        summary="Capital disponible par client (bénéficiaire) du dossier",
        tags=("Investissements",),
        responses=CaseBeneficiaryCapitalSerializer,
    )
    def get(self, request, case_pk: int):
        case = get_accessible_case_or_404(request.user, case_pk)
        if not case_supports_investments(case):
            raise ValidationError("Dossier non éligible aux investissements PIGFI.")
        payload = get_case_beneficiary_capital(case)
        payload["patrimony_total"] = str(payload["patrimony_total"])
        payload["fiduciary_balance"] = str(payload["fiduciary_balance"])
        for row in payload["beneficiaries"]:
            row["patrimony_limit"] = str(row["patrimony_limit"])
            row["deployed_amount"] = str(row["deployed_amount"])
            row["available_amount"] = str(row["available_amount"])
        return Response(CaseBeneficiaryCapitalSerializer(payload).data)


class CaseInvestmentDashboardView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated, CanAccessInvestments]

    @extend_schema(
        summary="Tableau de bord investissement d'un dossier",
        tags=("Investissements",),
        responses=CaseInvestmentDashboardSerializer,
    )
    def get(self, request, case_pk: int):
        case = get_accessible_case_or_404(request.user, case_pk)
        if not case_supports_investments(case):
            raise ValidationError(
                "Les investissements PIGFI ne s'appliquent qu'aux mandats fiduciaires "
                "et tutelles / cantonnements."
            )
        dashboard = build_case_investment_dashboard(case)
        asset_class_slug = request.query_params.get("asset_class") or None
        if asset_class_slug:
            active = [
                inv
                for inv in dashboard["investments"]
                if inv.status != Investment.Status.CLOSED
            ]
            from investments.services import (
                build_patrimony_evolution,
                build_patrimony_evolution_by_asset_class,
            )

            dashboard["charts"]["patrimony_evolution"] = build_patrimony_evolution(
                active,
                asset_class_slug=asset_class_slug,
            )
            all_series = build_patrimony_evolution_by_asset_class(active)
            dashboard["charts"]["patrimony_evolution_by_asset_class"] = [
                s for s in all_series if s["slug"] == asset_class_slug
            ]
        return Response(CaseInvestmentDashboardSerializer(dashboard).data)


class CaseInvestmentPolicyView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated, CanAccessInvestments]

    @extend_schema(
        summary="Politique d'investissement du dossier",
        tags=("Investissements",),
        responses=CaseInvestmentPolicySerializer,
    )
    def get(self, request, case_pk: int):
        case = get_accessible_case_or_404(request.user, case_pk)
        if not case_supports_investments(case):
            raise ValidationError("Dossier non éligible aux investissements PIGFI.")
        policy = ensure_case_investment_policy(case)
        return Response(CaseInvestmentPolicySerializer(policy).data)

    @extend_schema(
        summary="Mettre à jour la politique d'investissement",
        tags=("Investissements",),
        request=CaseInvestmentPolicySerializer,
        responses=CaseInvestmentPolicySerializer,
    )
    @transaction.atomic
    def patch(self, request, case_pk: int):
        case = get_accessible_case_or_404(request.user, case_pk)
        ensure_case_writable(request.user, case)
        if not case_supports_investments(case):
            raise ValidationError("Dossier non éligible aux investissements PIGFI.")
        policy = ensure_case_investment_policy(case)
        serializer = CaseInvestmentPolicySerializer(
            policy,
            data=request.data,
            partial=True,
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        log_audit(
            request=request,
            action="CASE_INVESTMENT_POLICY_UPDATED",
            entity_type="CaseInvestmentPolicy",
            entity_id=policy.id,
            case=case,
            metadata={"case_reference": case.reference},
        )
        return Response(CaseInvestmentPolicySerializer(policy).data)


class CaseEnvelopeContributionView(APIView):
    """Historique et ajout de sommes à l'enveloppe à investir du dossier."""

    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated, CanAccessInvestments]

    @extend_schema(
        summary="Historique des ajouts à l'enveloppe à investir",
        tags=("Investissements",),
        responses=EnvelopeContributionSerializer(many=True),
    )
    def get(self, request, case_pk: int):
        case = get_accessible_case_or_404(request.user, case_pk)
        if not case_supports_investments(case):
            raise ValidationError("Dossier non éligible aux investissements PIGFI.")
        policy = ensure_case_investment_policy(case)
        contributions = policy.envelope_contributions.select_related("created_by")
        return Response(EnvelopeContributionSerializer(contributions, many=True).data)

    @extend_schema(
        summary="Ajouter une somme à l'enveloppe à investir",
        tags=("Investissements",),
        request=EnvelopeContributionCreateSerializer,
        responses=CaseInvestmentPolicySerializer,
    )
    @transaction.atomic
    def post(self, request, case_pk: int):
        case = get_accessible_case_or_404(request.user, case_pk)
        ensure_case_writable(request.user, case)
        if not case_supports_investments(case):
            raise ValidationError("Dossier non éligible aux investissements PIGFI.")
        serializer = EnvelopeContributionCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        amount = serializer.validated_data["amount"]
        notes = serializer.validated_data.get("notes", "")

        policy = ensure_case_investment_policy(case)
        previous_total = policy.planned_investment_amount or Decimal("0")
        new_total = previous_total + amount

        contribution = EnvelopeContribution.objects.create(
            policy=policy,
            amount=amount,
            previous_total=previous_total,
            new_total=new_total,
            notes=notes,
            created_by=request.user,
        )
        policy.planned_investment_amount = new_total
        policy.save(update_fields=["planned_investment_amount", "updated_at"])

        log_audit(
            request=request,
            action="CASE_ENVELOPE_CONTRIBUTION_ADDED",
            entity_type="EnvelopeContribution",
            entity_id=contribution.id,
            case=case,
            metadata={
                "case_reference": case.reference,
                "amount": str(amount),
                "previous_total": str(previous_total),
                "new_total": str(new_total),
            },
        )
        return Response(
            CaseInvestmentPolicySerializer(policy).data,
            status=status.HTTP_201_CREATED,
        )


class CaseInvestmentViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    viewsets.GenericViewSet,
):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated, CanAccessInvestments]

    def get_case(self):
        case = get_accessible_case_or_404(self.request.user, self.kwargs["case_pk"])
        if not case_supports_investments(case):
            raise ValidationError("Dossier non éligible aux investissements PIGFI.")
        return case

    def get_queryset(self):
        self.get_case()
        return Investment.objects.filter(case_id=self.kwargs["case_pk"]).select_related(
            "asset_class",
            "created_by",
        ).prefetch_related(
            "allocations",
            "allocations__case",
            "valuations",
            "valuations__created_by",
            "participants__beneficiary",
            "participants__patrimony_category",
        )

    def get_serializer_class(self):
        if self.action == "create":
            return InvestmentCreateSerializer
        return InvestmentSerializer

    @extend_schema(tags=("Investissements",))
    def list(self, request, *args, **kwargs):
        self.get_case()
        return super().list(request, *args, **kwargs)

    @extend_schema(tags=("Investissements",))
    @transaction.atomic
    def create(self, request, *args, **kwargs):
        if not user_can_write_case(request.user):
            raise PermissionDenied("Création d'investissement non autorisée.")
        case = self.get_case()
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        validated = serializer.validated_data
        participants_data = validated.pop("participants", [])
        validate_investment_participants(
            case,
            validated["amount_invested"],
            participants_data,
        )
        investment = Investment.objects.create(
            case=case,
            created_by=request.user,
            **validated,
        )
        if participants_data:
            create_investment_participants(investment, participants_data)
        log_audit(
            request=request,
            action="INVESTMENT_CREATED",
            entity_type="Investment",
            entity_id=investment.id,
            case=case,
            metadata={"label": investment.label},
        )
        return Response(
            InvestmentSerializer(investment).data,
            status=status.HTTP_201_CREATED,
        )


class InvestmentDetailViewSet(
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated, CanAccessInvestments]

    def get_queryset(self):
        return Investment.objects.select_related(
            "asset_class",
            "created_by",
            "case",
        ).prefetch_related(
            "allocations",
            "allocations__case",
            "allocations__asset_class",
            "participants__beneficiary",
            "participants__patrimony_category",
        )

    def get_serializer_class(self):
        if self.action in ("update", "partial_update"):
            return InvestmentUpdateSerializer
        return InvestmentSerializer

    def get_object(self):
        investment = super().get_object()
        if investment.case_id is not None:
            get_accessible_case_or_404(self.request.user, investment.case_id)
        elif (
            not user_can_write_case(self.request.user)
            and self.request.method not in ("GET", "HEAD", "OPTIONS")
        ):
            raise PermissionDenied("Accès à cet investissement non autorisé.")
        return investment

    @extend_schema(tags=("Investissements",))
    def retrieve(self, request, *args, **kwargs):
        investment = resolve_investment_envelope(self.get_object())
        from investments.services import build_participant_share_slices

        payload = _serialize_management_investment(
            {
                "investment": investment,
                "participant_shares": build_participant_share_slices(investment),
            }
        )
        valuations = [
            serialize_investment_valuation(v) for v in investment.valuations.all()
        ]
        latest = valuations[0] if valuations else None
        payload.update(
            {
                "reference": investment.reference or "",
                "notes": investment.notes or "",
                "risk_summary": investment.risk_summary or "",
                "currency": investment.currency,
                "maturity_date": (
                    investment.maturity_date.isoformat()
                    if investment.maturity_date
                    else None
                ),
                "distributed_income": str(investment.distributed_income),
                "sharia_compliance_score": (
                    str(investment.sharia_compliance_score)
                    if investment.sharia_compliance_score is not None
                    else None
                ),
                "requires_purification": investment.requires_purification,
                "purification_amount": (
                    str(investment.purification_amount)
                    if investment.purification_amount is not None
                    else None
                ),
                "created_by_name": (
                    (
                        f"{investment.created_by.first_name} {investment.created_by.last_name}".strip()
                        or investment.created_by.username
                    )
                    if investment.created_by
                    else None
                ),
                "created_at": investment.created_at.isoformat(),
                "updated_at": investment.updated_at.isoformat(),
                "remaining_amount": str(
                    max(investment.amount_invested - investment.allocated_amount(), 0)
                ),
                "allocation_count": len(payload.get("allocations") or []),
                "valuation_history": valuations,
                "valuation_evolution": build_investment_valuation_evolution(investment),
                "latest_valuation_date": latest["valued_at"] if latest else None,
                "latest_valuation_value": latest["value"] if latest else None,
            }
        )
        return Response(payload)

    @extend_schema(tags=("Investissements",))
    @transaction.atomic
    def partial_update(self, request, *args, **kwargs):
        if not user_can_write_case(request.user):
            raise PermissionDenied("Modification d'investissement non autorisée.")
        investment = self.get_object()
        serializer = self.get_serializer(investment, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        log_audit(
            request=request,
            action="INVESTMENT_UPDATED",
            entity_type="Investment",
            entity_id=investment.id,
            case=investment.case,
            metadata={"label": investment.label},
        )
        return Response(InvestmentSerializer(investment).data)


class InvestmentValuationView(APIView):
    """Enregistrer une nouvelle estimation de valeur."""

    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated, CanAccessInvestments]

    @extend_schema(
        summary="Nouvelle estimation de valeur",
        tags=("Investissements",),
        request=InvestmentValuationCreateSerializer,
    )
    @transaction.atomic
    def post(self, request, pk: int):
        if not user_can_write_case(request.user):
            raise PermissionDenied("Estimation non autorisée.")
        investment = Investment.objects.filter(pk=pk).first()
        if not investment:
            raise ValidationError("Investissement introuvable.")
        if investment.case_id is not None:
            get_accessible_case_or_404(request.user, investment.case_id)

        serializer = InvestmentValuationCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        valuation = record_investment_valuation(
            investment,
            value=data["value"],
            valued_at=data["valued_at"],
            notes=data.get("notes") or "",
            user=request.user,
        )
        log_audit(
            request=request,
            action="INVESTMENT_VALUATION_CREATED",
            entity_type="InvestmentValuation",
            entity_id=valuation.id,
            case=resolve_investment_envelope(investment).case,
            metadata={
                "investment_id": resolve_investment_envelope(investment).id,
                "value": str(valuation.value),
                "valued_at": valuation.valued_at.isoformat(),
            },
        )
        return Response(
            serialize_investment_valuation(valuation),
            status=status.HTTP_201_CREATED,
        )


def _ensure_catalog_writable(user) -> None:
    if not user_can_write_case(user):
        raise PermissionDenied("Gestion du catalogue investissements non autorisée.")


class InvestmentAssetClassViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    """Classes d'investissement concrètes : Immobilier, Or, Sukuk…"""

    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated, CanAccessInvestments]
    queryset = InvestmentAssetClass.objects.all().order_by("sort_order", "label")

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return InvestmentAssetClassWriteSerializer
        return InvestmentAssetClassSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        if self.request.query_params.get("active_only") == "1":
            return qs.filter(is_active=True)
        return qs

    @extend_schema(tags=("Investissements",))
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)

    @extend_schema(tags=("Investissements",))
    @transaction.atomic
    def create(self, request, *args, **kwargs):
        _ensure_catalog_writable(request.user)
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        asset_class = serializer.save()
        log_audit(
            request=request,
            action="INVESTMENT_ASSET_CLASS_CREATED",
            entity_type="InvestmentAssetClass",
            entity_id=asset_class.id,
            metadata={"label": asset_class.label},
        )
        return Response(
            InvestmentAssetClassSerializer(asset_class).data,
            status=status.HTTP_201_CREATED,
        )

    @extend_schema(tags=("Investissements",))
    @transaction.atomic
    def partial_update(self, request, *args, **kwargs):
        _ensure_catalog_writable(request.user)
        asset_class = self.get_object()
        serializer = self.get_serializer(asset_class, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        log_audit(
            request=request,
            action="INVESTMENT_ASSET_CLASS_UPDATED",
            entity_type="InvestmentAssetClass",
            entity_id=asset_class.id,
            metadata={"label": asset_class.label},
        )
        return Response(InvestmentAssetClassSerializer(asset_class).data)


class PatrimonyInvestmentCategoryViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    """Types patrimoniaux PIGFI A–D (mineurs, successoraux, familial, waqf)."""

    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated, CanAccessInvestments]
    queryset = PatrimonyInvestmentCategory.objects.all().order_by("sort_order", "code")

    def get_serializer_class(self):
        if self.action in ("update", "partial_update"):
            return PatrimonyInvestmentCategoryWriteSerializer
        return PatrimonyInvestmentCategorySerializer

    @extend_schema(tags=("Investissements",))
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)

    @extend_schema(tags=("Investissements",))
    @transaction.atomic
    def partial_update(self, request, *args, **kwargs):
        _ensure_catalog_writable(request.user)
        category = self.get_object()
        serializer = self.get_serializer(category, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        log_audit(
            request=request,
            action="PATRIMONY_INVESTMENT_CATEGORY_UPDATED",
            entity_type="PatrimonyInvestmentCategory",
            entity_id=category.id,
            metadata={"code": category.code},
        )
        return Response(PatrimonyInvestmentCategorySerializer(category).data)


class InvestmentEnvelopeView(APIView):
    """Créer une enveloppe d'investissement (dossiers clients optionnels)."""

    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated, CanAccessInvestments]

    @extend_schema(
        summary="Créer un investissement (enveloppe) avec allocations optionnelles",
        tags=("Investissements",),
        request=InvestmentEnvelopeCreateSerializer,
    )
    @transaction.atomic
    def post(self, request):
        if not user_can_write_case(request.user):
            raise PermissionDenied("Création d'investissement non autorisée.")
        serializer = InvestmentEnvelopeCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        amount = data["amount_invested"]
        envelope = create_investment_envelope(
            user=request.user,
            asset_class=data["asset_class"],
            label=data["label"],
            amount_invested=amount,
            current_value=data.get("current_value"),
            start_date=data["start_date"],
            reference=data.get("reference") or "",
            notes=data.get("notes") or "",
            risk_summary=data.get("risk_summary") or "",
            annual_yield_percent=data.get("annual_yield_percent"),
            status=data.get("status") or Investment.Status.PENDING_VALIDATION,
        )

        for row in data.get("allocations") or []:
            case_id = row.get("case_id")
            alloc_amount = row.get("amount") or row.get("amount_invested")
            if not case_id or alloc_amount is None:
                raise ValidationError(
                    {"allocations": "Chaque allocation requiert case_id et amount."}
                )
            case = get_accessible_case_or_404(request.user, int(case_id))
            if not case_supports_investments(case):
                raise ValidationError(
                    {"allocations": f"Dossier {case.reference} non éligible."}
                )
            allocate_investment_to_case(
                envelope=envelope,
                case=case,
                amount=_decimal_amount(alloc_amount),
                user=request.user,
            )

        log_audit(
            request=request,
            action="INVESTMENT_CREATED",
            entity_type="Investment",
            entity_id=envelope.id,
            case=None,
            metadata={"label": envelope.label, "envelope": True},
        )
        envelope.refresh_from_db()
        return Response(
            _serialize_management_investment(
                {
                    "investment": envelope,
                    "participant_shares": [],
                }
            ),
            status=status.HTTP_201_CREATED,
        )


class InvestmentAllocateView(APIView):
    """Compléter l'allocation d'une enveloppe vers un dossier client."""

    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated, CanAccessInvestments]

    @extend_schema(
        summary="Allouer une part d'investissement à un dossier",
        tags=("Investissements",),
        request=InvestmentAllocateSerializer,
    )
    @transaction.atomic
    def post(self, request, pk: int):
        if not user_can_write_case(request.user):
            raise PermissionDenied("Allocation non autorisée.")
        envelope = Investment.objects.filter(pk=pk, parent__isnull=True).first()
        if not envelope:
            raise ValidationError("Investissement introuvable.")
        if envelope.case_id is not None:
            get_accessible_case_or_404(request.user, envelope.case_id)

        serializer = InvestmentAllocateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        case = get_accessible_case_or_404(
            request.user, serializer.validated_data["case_id"]
        )
        if not case_supports_investments(case):
            raise ValidationError("Dossier non éligible aux investissements PIGFI.")

        child = allocate_investment_to_case(
            envelope=envelope,
            case=case,
            amount=serializer.validated_data["amount"],
            user=request.user,
        )
        log_audit(
            request=request,
            action="INVESTMENT_ALLOCATED",
            entity_type="Investment",
            entity_id=child.id,
            case=case,
            metadata={"parent_id": envelope.id, "amount": str(child.amount_invested)},
        )
        envelope.refresh_from_db()
        return Response(
            _serialize_management_investment(
                {
                    "investment": envelope,
                    "participant_shares": [],
                }
            ),
            status=status.HTTP_201_CREATED,
        )


def _decimal_amount(value):
    from decimal import Decimal

    return Decimal(str(value))
