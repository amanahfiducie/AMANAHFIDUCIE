from django.db import transaction
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.authentication import JWTAuthentication

from cases.access import get_accessible_case_or_404
from cases.models import CaseObservation, CaseObservationKind, CaseObservationStatus
from cases.observation_permissions import (
    observations_visible_to_user,
    user_can_review_observation,
    user_can_view_observation,
)
from cases.observation_services import create_observation, review_observation, share_observation
from cases.serializers_observations import (
    CaseObservationCreateSerializer,
    CaseObservationReviewSerializer,
    CaseObservationSerializer,
    CaseObservationUpdateSerializer,
)


def _get_observation_or_404(case_pk: int, pk: int) -> CaseObservation:
    try:
        return CaseObservation.objects.select_related("case", "author", "reviewed_by").get(
            case_id=case_pk,
            pk=pk,
        )
    except CaseObservation.DoesNotExist as exc:
        raise NotFound("Observation introuvable.") from exc


class CaseObservationListCreateView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(
        responses={200: CaseObservationSerializer(many=True)},
        tags=("Observations",),
    )
    def get(self, request, case_pk: int):
        case = get_accessible_case_or_404(request.user, case_pk)
        qs = observations_visible_to_user(request.user, case)
        return Response(CaseObservationSerializer(qs, many=True).data)

    @extend_schema(
        request=CaseObservationCreateSerializer,
        responses={201: CaseObservationSerializer},
        tags=("Observations",),
    )
    @transaction.atomic
    def post(self, request, case_pk: int):
        case = get_accessible_case_or_404(request.user, case_pk)
        serializer = CaseObservationCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        observation = create_observation(
            case=case,
            author=request.user,
            body=data["body"],
            kind=data["kind"],
            share=data.get("share", False),
            request=request,
        )
        return Response(
            CaseObservationSerializer(observation).data,
            status=status.HTTP_201_CREATED,
        )


class CaseObservationDetailView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: CaseObservationSerializer}, tags=("Observations",))
    def get(self, request, case_pk: int, pk: int):
        observation = _get_observation_or_404(case_pk, pk)
        if not user_can_view_observation(request.user, observation):
            raise PermissionDenied("Accès refusé à cette observation.")
        return Response(CaseObservationSerializer(observation).data)

    @extend_schema(
        request=CaseObservationUpdateSerializer,
        responses={200: CaseObservationSerializer},
        tags=("Observations",),
    )
    @transaction.atomic
    def patch(self, request, case_pk: int, pk: int):
        observation = _get_observation_or_404(case_pk, pk)
        if observation.author_id != request.user.pk:
            raise PermissionDenied("Seul l'auteur peut modifier cette observation.")
        if observation.kind != CaseObservationKind.SUBMISSION:
            raise ValidationError({"kind": "Les remarques internes ne sont pas modifiables."})
        if observation.status != CaseObservationStatus.DRAFT:
            raise ValidationError({"status": "Seuls les brouillons peuvent être modifiés."})

        serializer = CaseObservationUpdateSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        body = serializer.validated_data.get("body", "").strip()
        if not body:
            raise ValidationError({"body": "Le texte est obligatoire."})
        observation.body = body
        observation.save(update_fields=["body", "updated_at"])
        return Response(CaseObservationSerializer(observation).data)


class CaseObservationShareView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: CaseObservationSerializer}, tags=("Observations",))
    @transaction.atomic
    def post(self, request, case_pk: int, pk: int):
        get_accessible_case_or_404(request.user, case_pk)
        observation = _get_observation_or_404(case_pk, pk)
        observation = share_observation(
            observation=observation,
            actor=request.user,
            request=request,
        )
        return Response(CaseObservationSerializer(observation).data)


class CaseObservationApproveView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: CaseObservationSerializer}, tags=("Observations",))
    @transaction.atomic
    def post(self, request, case_pk: int, pk: int):
        get_accessible_case_or_404(request.user, case_pk)
        observation = _get_observation_or_404(case_pk, pk)
        observation = review_observation(
            observation=observation,
            actor=request.user,
            approved=True,
            request=request,
        )
        return Response(CaseObservationSerializer(observation).data)


class CaseObservationRejectView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(
        request=CaseObservationReviewSerializer,
        responses={200: CaseObservationSerializer},
        tags=("Observations",),
    )
    @transaction.atomic
    def post(self, request, case_pk: int, pk: int):
        get_accessible_case_or_404(request.user, case_pk)
        observation = _get_observation_or_404(case_pk, pk)
        serializer = CaseObservationReviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        observation = review_observation(
            observation=observation,
            actor=request.user,
            approved=False,
            review_reason=serializer.validated_data.get("review_reason", ""),
            request=request,
        )
        return Response(CaseObservationSerializer(observation).data)


class ObservationReviewQueueView(APIView):
    """Observations / remarques pour validation direction & comité (tous dossiers)."""

    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(
        responses={200: CaseObservationSerializer(many=True)},
        tags=("Observations",),
    )
    def get(self, request):
        from django.db.models import Q

        from cases.permissions import user_can_access_case

        if not user_can_review_observation(request.user):
            raise PermissionDenied(
                "Seuls la direction et le comité charaïque peuvent consulter cette file."
            )

        qs = CaseObservation.objects.select_related(
            "case",
            "author",
            "reviewed_by",
        ).order_by("-updated_at", "-created_at")

        kind = (request.query_params.get("kind") or "").strip().upper()
        if kind in {CaseObservationKind.SUBMISSION, CaseObservationKind.REMARK}:
            qs = qs.filter(kind=kind)

        status_filter = (request.query_params.get("status") or "").strip().upper()
        if status_filter:
            qs = qs.filter(status=status_filter)
        elif not kind:
            qs = qs.filter(
                Q(kind=CaseObservationKind.REMARK)
                | Q(
                    kind=CaseObservationKind.SUBMISSION,
                    status__in=(
                        CaseObservationStatus.PENDING,
                        CaseObservationStatus.APPROVED,
                        CaseObservationStatus.REJECTED,
                    ),
                )
            )
        elif kind == CaseObservationKind.SUBMISSION:
            qs = qs.filter(
                status__in=(
                    CaseObservationStatus.PENDING,
                    CaseObservationStatus.APPROVED,
                    CaseObservationStatus.REJECTED,
                ),
            )

        q = (request.query_params.get("q") or "").strip()
        if q:
            qs = qs.filter(
                Q(case__reference__icontains=q)
                | Q(case__title__icontains=q)
                | Q(body__icontains=q)
                | Q(author__username__icontains=q)
            )

        actionable = (request.query_params.get("actionable") or "").strip().lower()
        if actionable in ("1", "true", "yes"):
            qs = qs.filter(
                kind=CaseObservationKind.SUBMISSION,
                status=CaseObservationStatus.PENDING,
            )

        items = [
            obs
            for obs in qs[:200]
            if user_can_access_case(request.user, obs.case)
        ]
        return Response(CaseObservationSerializer(items, many=True).data)
