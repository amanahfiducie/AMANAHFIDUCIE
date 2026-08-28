from django.db import transaction
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.authentication import JWTAuthentication

from assets.models import Asset
from beneficiaries.models import Beneficiary
from cases.access import get_accessible_case_or_404
from cases.permissions import user_can_write_case
from faraid.models import (
    FaraidCommitteeReview,
    FaraidHeir,
    FaraidHeirDecision,
    FaraidHeirDecisionSource,
    FaraidReviewStatus,
    FaraidSettlementAction,
)
from faraid.permissions import user_can_review_faraid
from faraid.serializers import (
    FaraidCommitteeReviewSerializer,
    FaraidCommitteeReviewUpdateSerializer,
    FaraidHeirCreateSerializer,
    FaraidHeirDecisionCreateSerializer,
    FaraidHeirDecisionSerializer,
    FaraidHeirDecisionUpdateSerializer,
    FaraidHeirSerializer,
    FaraidReviewSyncSerializer,
    FaraidSettlementActionCreateSerializer,
    FaraidSettlementActionSerializer,
)
from faraid.services import finalize_faraid_review, get_or_create_review, sync_review_from_genealogy
from notifications.services import notify_faraid_review_requested


def _ensure_review_writable(review: FaraidCommitteeReview) -> None:
    if review.status == FaraidReviewStatus.FINALIZED:
        raise ValidationError({"status": "Cette revue farāʾiḍ est finalisée."})


def _get_review(case_pk: int, user) -> FaraidCommitteeReview:
    case = get_accessible_case_or_404(user, case_pk)
    return get_or_create_review(case)


class CaseFaraidHeirView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(
        responses={200: FaraidHeirSerializer(many=True)},
        tags=("Farāʾiḍ",),
    )
    def get(self, request, case_pk: int):
        case = get_accessible_case_or_404(request.user, case_pk)
        qs = FaraidHeir.objects.filter(case=case).select_related("beneficiary")
        return Response(FaraidHeirSerializer(qs, many=True).data)

    @extend_schema(
        request=FaraidHeirCreateSerializer,
        responses={201: FaraidHeirSerializer},
        tags=("Farāʾiḍ",),
    )
    def post(self, request, case_pk: int):
        case = get_accessible_case_or_404(request.user, case_pk)
        if not user_can_write_case(request.user):
            raise PermissionDenied("Création farāʾiḍ non autorisée.")
        serializer = FaraidHeirCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        beneficiary = None
        beneficiary_id = data.pop("beneficiary", None)
        if beneficiary_id:
            try:
                beneficiary = Beneficiary.objects.get(pk=beneficiary_id, case=case)
            except Beneficiary.DoesNotExist as exc:
                raise ValidationError({"beneficiary": "Bénéficiaire introuvable."}) from exc
        heir = FaraidHeir.objects.create(
            case=case,
            beneficiary=beneficiary,
            **data,
        )
        return Response(
            FaraidHeirSerializer(heir).data,
            status=status.HTTP_201_CREATED,
        )


class CaseFaraidHeirDetailView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={204: None}, tags=("Farāʾiḍ",))
    def delete(self, request, case_pk: int, pk: int):
        case = get_accessible_case_or_404(request.user, case_pk)
        if not user_can_write_case(request.user):
            raise PermissionDenied("Suppression farāʾiḍ non autorisée.")
        try:
            heir = FaraidHeir.objects.get(pk=pk, case=case)
        except FaraidHeir.DoesNotExist as exc:
            raise ValidationError({"detail": "Héritier introuvable."}) from exc
        heir.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class CaseFaraidReviewView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: FaraidCommitteeReviewSerializer}, tags=("Farāʾiḍ",))
    def get(self, request, case_pk: int):
        review = _get_review(case_pk, request.user)
        review = (
            FaraidCommitteeReview.objects.select_related(
                "requested_by",
                "finalized_by",
            )
            .prefetch_related("heir_decisions", "settlement_actions__created_by")
            .get(pk=review.pk)
        )
        return Response(FaraidCommitteeReviewSerializer(review).data)

    @extend_schema(
        request=FaraidCommitteeReviewUpdateSerializer,
        responses={200: FaraidCommitteeReviewSerializer},
        tags=("Farāʾiḍ",),
    )
    def patch(self, request, case_pk: int):
        if not user_can_review_faraid(request.user):
            raise PermissionDenied("Réservé au comité charaïque.")
        review = _get_review(case_pk, request.user)
        _ensure_review_writable(review)
        serializer = FaraidCommitteeReviewUpdateSerializer(
            review,
            data=request.data,
            partial=True,
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(FaraidCommitteeReviewSerializer(review).data)


class CaseFaraidReviewRequestView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: FaraidCommitteeReviewSerializer}, tags=("Farāʾiḍ",))
    @transaction.atomic
    def post(self, request, case_pk: int):
        case = get_accessible_case_or_404(request.user, case_pk)
        if not user_can_write_case(request.user):
            raise PermissionDenied("Soumission non autorisée.")
        review = get_or_create_review(case)
        _ensure_review_writable(review)
        review.requested_at = timezone.now()
        review.requested_by = request.user
        review.save(update_fields=["requested_at", "requested_by", "updated_at"])
        notify_faraid_review_requested(case, actor=request.user)
        return Response(FaraidCommitteeReviewSerializer(review).data)


class CaseFaraidReviewSyncView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(
        request=FaraidReviewSyncSerializer,
        responses={200: FaraidCommitteeReviewSerializer},
        tags=("Farāʾiḍ",),
    )
    @transaction.atomic
    def post(self, request, case_pk: int):
        if not user_can_review_faraid(request.user):
            raise PermissionDenied("Réservé au comité charaïque.")
        review = _get_review(case_pk, request.user)
        _ensure_review_writable(review)
        serializer = FaraidReviewSyncSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        sync_review_from_genealogy(
            review,
            deceased_gender=serializer.validated_data["deceased_gender"],
        )
        review.refresh_from_db()
        review = (
            FaraidCommitteeReview.objects.prefetch_related(
                "heir_decisions",
                "settlement_actions__created_by",
            )
            .get(pk=review.pk)
        )
        return Response(FaraidCommitteeReviewSerializer(review).data)


class CaseFaraidReviewHeirListCreateView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: FaraidHeirDecisionSerializer(many=True)}, tags=("Farāʾiḍ",))
    def get(self, request, case_pk: int):
        review = _get_review(case_pk, request.user)
        qs = review.heir_decisions.select_related("beneficiary")
        return Response(FaraidHeirDecisionSerializer(qs, many=True).data)

    @extend_schema(
        request=FaraidHeirDecisionCreateSerializer,
        responses={201: FaraidHeirDecisionSerializer},
        tags=("Farāʾiḍ",),
    )
    @transaction.atomic
    def post(self, request, case_pk: int):
        if not user_can_review_faraid(request.user):
            raise PermissionDenied("Réservé au comité charaïque.")
        review = _get_review(case_pk, request.user)
        _ensure_review_writable(review)
        serializer = FaraidHeirDecisionCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        beneficiary = None
        beneficiary_id = data.get("beneficiary")
        if beneficiary_id:
            try:
                beneficiary = Beneficiary.objects.get(
                    pk=beneficiary_id,
                    case=review.case,
                )
            except Beneficiary.DoesNotExist as exc:
                raise ValidationError({"beneficiary": "Bénéficiaire introuvable."}) from exc
        decision = FaraidHeirDecision.objects.create(
            review=review,
            beneficiary=beneficiary,
            source=FaraidHeirDecisionSource.MANUAL,
            **{k: v for k, v in data.items() if k != "beneficiary"},
        )
        return Response(
            FaraidHeirDecisionSerializer(decision).data,
            status=status.HTTP_201_CREATED,
        )


class CaseFaraidReviewHeirDetailView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def _get_decision(self, case_pk: int, pk: int, user) -> FaraidHeirDecision:
        review = _get_review(case_pk, user)
        try:
            return review.heir_decisions.get(pk=pk)
        except FaraidHeirDecision.DoesNotExist as exc:
            raise NotFound("Personne introuvable dans la revue.") from exc

    @extend_schema(
        request=FaraidHeirDecisionUpdateSerializer,
        responses={200: FaraidHeirDecisionSerializer},
        tags=("Farāʾiḍ",),
    )
    @transaction.atomic
    def patch(self, request, case_pk: int, pk: int):
        if not user_can_review_faraid(request.user):
            raise PermissionDenied("Réservé au comité charaïque.")
        decision = self._get_decision(case_pk, pk, request.user)
        _ensure_review_writable(decision.review)
        serializer = FaraidHeirDecisionUpdateSerializer(
            decision,
            data=request.data,
            partial=True,
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(FaraidHeirDecisionSerializer(decision).data)

    @extend_schema(responses={204: None}, tags=("Farāʾiḍ",))
    @transaction.atomic
    def delete(self, request, case_pk: int, pk: int):
        if not user_can_review_faraid(request.user):
            raise PermissionDenied("Réservé au comité charaïque.")
        decision = self._get_decision(case_pk, pk, request.user)
        _ensure_review_writable(decision.review)
        if decision.source != FaraidHeirDecisionSource.MANUAL:
            raise ValidationError(
                {"detail": "Seules les personnes ajoutées manuellement peuvent être retirées."}
            )
        decision.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class CaseFaraidReviewActionListCreateView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(
        responses={200: FaraidSettlementActionSerializer(many=True)},
        tags=("Farāʾiḍ",),
    )
    def get(self, request, case_pk: int):
        review = _get_review(case_pk, request.user)
        qs = review.settlement_actions.select_related("created_by", "beneficiary", "asset")
        return Response(FaraidSettlementActionSerializer(qs, many=True).data)

    @extend_schema(
        request=FaraidSettlementActionCreateSerializer,
        responses={201: FaraidSettlementActionSerializer},
        tags=("Farāʾiḍ",),
    )
    @transaction.atomic
    def post(self, request, case_pk: int):
        if not user_can_review_faraid(request.user):
            raise PermissionDenied("Réservé au comité charaïque.")
        review = _get_review(case_pk, request.user)
        _ensure_review_writable(review)
        serializer = FaraidSettlementActionCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        beneficiary = None
        asset = None
        beneficiary_id = data.get("beneficiary")
        asset_id = data.get("asset")
        if beneficiary_id:
            try:
                beneficiary = Beneficiary.objects.get(pk=beneficiary_id, case=review.case)
            except Beneficiary.DoesNotExist as exc:
                raise ValidationError({"beneficiary": "Bénéficiaire introuvable."}) from exc
        if asset_id:
            try:
                asset = Asset.objects.get(pk=asset_id, case=review.case, is_active=True)
            except Asset.DoesNotExist as exc:
                raise ValidationError({"asset": "Bien introuvable."}) from exc
        action = FaraidSettlementAction.objects.create(
            review=review,
            beneficiary=beneficiary,
            asset=asset,
            created_by=request.user,
            **{k: v for k, v in data.items() if k not in ("beneficiary", "asset")},
        )
        return Response(
            FaraidSettlementActionSerializer(action).data,
            status=status.HTTP_201_CREATED,
        )


class CaseFaraidReviewActionDetailView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def _get_action(self, case_pk: int, pk: int, user) -> FaraidSettlementAction:
        review = _get_review(case_pk, user)
        try:
            return review.settlement_actions.get(pk=pk)
        except FaraidSettlementAction.DoesNotExist as exc:
            raise NotFound("Action introuvable.") from exc

    @extend_schema(
        request=FaraidSettlementActionCreateSerializer,
        responses={200: FaraidSettlementActionSerializer},
        tags=("Farāʾiḍ",),
    )
    @transaction.atomic
    def patch(self, request, case_pk: int, pk: int):
        if not user_can_review_faraid(request.user):
            raise PermissionDenied("Réservé au comité charaïque.")
        action = self._get_action(case_pk, pk, request.user)
        _ensure_review_writable(action.review)
        serializer = FaraidSettlementActionCreateSerializer(
            action,
            data=request.data,
            partial=True,
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(FaraidSettlementActionSerializer(action).data)

    @extend_schema(responses={204: None}, tags=("Farāʾiḍ",))
    @transaction.atomic
    def delete(self, request, case_pk: int, pk: int):
        if not user_can_review_faraid(request.user):
            raise PermissionDenied("Réservé au comité charaïque.")
        action = self._get_action(case_pk, pk, request.user)
        _ensure_review_writable(action.review)
        action.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class CaseFaraidReviewFinalizeView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: FaraidCommitteeReviewSerializer}, tags=("Farāʾiḍ",))
    @transaction.atomic
    def post(self, request, case_pk: int):
        if not user_can_review_faraid(request.user):
            raise PermissionDenied("Réservé au comité charaïque.")
        review = _get_review(case_pk, request.user)
        _ensure_review_writable(review)
        try:
            finalize_faraid_review(review, actor=request.user)
        except ValueError as exc:
            raise ValidationError({"detail": str(exc)}) from exc
        review.refresh_from_db()
        review = (
            FaraidCommitteeReview.objects.prefetch_related(
                "heir_decisions",
                "settlement_actions__created_by",
            )
            .get(pk=review.pk)
        )
        return Response(FaraidCommitteeReviewSerializer(review).data)
