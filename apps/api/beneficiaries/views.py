from django.db import transaction
from drf_spectacular.utils import extend_schema
from rest_framework import mixins, status, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.authentication import JWTAuthentication

from accounts.case_profile_invite import try_auto_provision_profile_access
from auditlog.services import log_audit
from beneficiaries.models import Beneficiary, CaseDonor, DonorTrustedPerson, Guardian
from beneficiaries.serializers import (
    BeneficiaryCreateSerializer,
    BeneficiarySerializer,
    BeneficiaryUpdateSerializer,
    CaseDonorCreateSerializer,
    CaseDonorSerializer,
    CaseDonorUpdateSerializer,
    DonorTrustedPersonCreateSerializer,
    DonorTrustedPersonSerializer,
    GuardianCreateSerializer,
    GuardianSerializer,
    GuardianUpdateSerializer,
)
from cases.access import ensure_case_writable, get_accessible_case_or_404
from cases.services import record_timeline_event
from cases.models import TimelineEventType


class CaseDonorViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    viewsets.GenericViewSet,
):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get_case(self):
        return get_accessible_case_or_404(self.request.user, self.kwargs["case_pk"])

    def get_queryset(self):
        return CaseDonor.objects.filter(case_id=self.kwargs["case_pk"]).prefetch_related(
            "trusted_persons"
        )

    def get_serializer_class(self):
        if self.action == "create":
            return CaseDonorCreateSerializer
        return CaseDonorSerializer

    @extend_schema(tags=("Donateurs",))
    def list(self, request, *args, **kwargs):
        self.get_case()
        return super().list(request, *args, **kwargs)

    @extend_schema(tags=("Donateurs",))
    @transaction.atomic
    def create(self, request, *args, **kwargs):
        case = self.get_case()
        ensure_case_writable(request.user, case)
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        donor = CaseDonor.objects.create(case=case, **serializer.validated_data)
        record_timeline_event(
            case=case,
            event_type=TimelineEventType.UPDATED,
            message=f"Donateur ajouté : {donor}",
            actor=request.user,
            metadata={"donor_id": donor.pk},
        )
        log_audit(
            request=request,
            action="DONOR_CREATED",
            entity_type="CaseDonor",
            entity_id=donor.pk,
            case=case,
        )
        try_auto_provision_profile_access(
            case,
            "donor",
            donor.pk,
            actor=request.user,
        )
        return Response(CaseDonorSerializer(donor).data, status=status.HTTP_201_CREATED)


class CaseDonorDetailViewSet(
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    queryset = CaseDonor.objects.select_related("case")
    http_method_names = ["get", "patch", "head", "options"]

    def get_serializer_class(self):
        if self.action == "partial_update":
            return CaseDonorUpdateSerializer
        return CaseDonorSerializer

    def get_object(self):
        donor = super().get_object()
        get_accessible_case_or_404(self.request.user, donor.case_id)
        return donor

    @extend_schema(tags=("Donateurs",))
    def partial_update(self, request, *args, **kwargs):
        donor = self.get_object()
        ensure_case_writable(request.user, donor.case)
        serializer = CaseDonorUpdateSerializer(donor, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        log_audit(
            request=request,
            action="DONOR_UPDATED",
            entity_type="CaseDonor",
            entity_id=donor.pk,
            case=donor.case,
        )
        return Response(CaseDonorSerializer(donor).data)


class DonorTrustedPersonViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    viewsets.GenericViewSet,
):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get_donor(self) -> CaseDonor:
        case = get_accessible_case_or_404(self.request.user, self.kwargs["case_pk"])
        try:
            return CaseDonor.objects.get(pk=self.kwargs["donor_pk"], case=case)
        except CaseDonor.DoesNotExist as exc:
            from rest_framework.exceptions import NotFound

            raise NotFound("Donateur introuvable pour ce dossier.") from exc

    def get_queryset(self):
        donor = self.get_donor()
        return DonorTrustedPerson.objects.filter(donor=donor)

    def get_serializer_class(self):
        if self.action == "create":
            return DonorTrustedPersonCreateSerializer
        return DonorTrustedPersonSerializer

    @extend_schema(tags=("Personnes de confiance",))
    def list(self, request, *args, **kwargs):
        self.get_donor()
        return super().list(request, *args, **kwargs)

    @extend_schema(tags=("Personnes de confiance",))
    @transaction.atomic
    def create(self, request, *args, **kwargs):
        donor = self.get_donor()
        ensure_case_writable(request.user, donor.case)
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        person = DonorTrustedPerson.objects.create(donor=donor, **serializer.validated_data)
        record_timeline_event(
            case=donor.case,
            event_type=TimelineEventType.UPDATED,
            message=f"Personne de confiance ajoutée : {person}",
            actor=request.user,
            metadata={"donor_id": donor.pk, "trusted_person_id": person.pk},
        )
        log_audit(
            request=request,
            action="DONOR_TRUSTED_PERSON_CREATED",
            entity_type="DonorTrustedPerson",
            entity_id=person.pk,
            case=donor.case,
        )
        try_auto_provision_profile_access(
            donor.case,
            "trusted_person",
            person.pk,
            actor=request.user,
        )
        return Response(
            DonorTrustedPersonSerializer(person).data,
            status=status.HTTP_201_CREATED,
        )


class CaseBeneficiaryViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    viewsets.GenericViewSet,
):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get_case(self):
        return get_accessible_case_or_404(self.request.user, self.kwargs["case_pk"])

    def get_queryset(self):
        return Beneficiary.objects.filter(case_id=self.kwargs["case_pk"]).select_related(
            "donor",
            "guardian",
        )

    def get_serializer_class(self):
        if self.action == "create":
            return BeneficiaryCreateSerializer
        return BeneficiarySerializer

    @extend_schema(tags=("Bénéficiaires",))
    def list(self, request, *args, **kwargs):
        self.get_case()
        return super().list(request, *args, **kwargs)

    @extend_schema(tags=("Bénéficiaires",))
    @transaction.atomic
    def create(self, request, *args, **kwargs):
        case = self.get_case()
        ensure_case_writable(request.user, case)
        serializer = self.get_serializer(
            data=request.data,
            context={"case": case, "request": request},
        )
        serializer.is_valid(raise_exception=True)
        beneficiary = serializer.save()
        record_timeline_event(
            case=case,
            event_type=TimelineEventType.UPDATED,
            message=f"Bénéficiaire ajouté : {beneficiary}",
            actor=request.user,
            metadata={"beneficiary_id": beneficiary.pk},
        )
        log_audit(
            request=request,
            action="BENEFICIARY_CREATED",
            entity_type="Beneficiary",
            entity_id=beneficiary.pk,
            case=case,
        )
        try_auto_provision_profile_access(
            case,
            "beneficiary",
            beneficiary.pk,
            actor=request.user,
        )
        if beneficiary.guardian_id:
            try_auto_provision_profile_access(
                case,
                "guardian",
                beneficiary.guardian_id,
                actor=request.user,
            )
        return Response(
            BeneficiarySerializer(beneficiary).data,
            status=status.HTTP_201_CREATED,
        )


class BeneficiaryViewSet(
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    queryset = Beneficiary.objects.select_related("case")
    http_method_names = ["get", "patch", "delete", "head", "options"]

    def get_serializer_class(self):
        if self.action == "partial_update":
            return BeneficiaryUpdateSerializer
        return BeneficiarySerializer

    def get_object(self):
        beneficiary = super().get_object()
        get_accessible_case_or_404(self.request.user, beneficiary.case_id)
        return beneficiary

    @extend_schema(tags=("Bénéficiaires",))
    def partial_update(self, request, *args, **kwargs):
        beneficiary = self.get_object()
        ensure_case_writable(request.user, beneficiary.case)
        serializer = BeneficiaryUpdateSerializer(
            beneficiary, data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        log_audit(
            request=request,
            action="BENEFICIARY_UPDATED",
            entity_type="Beneficiary",
            entity_id=beneficiary.pk,
            case=beneficiary.case,
        )
        return Response(BeneficiarySerializer(beneficiary).data)

    @extend_schema(tags=("Bénéficiaires",))
    @transaction.atomic
    def destroy(self, request, *args, **kwargs):
        beneficiary = self.get_object()
        ensure_case_writable(request.user, beneficiary.case)
        case = beneficiary.case
        beneficiary_id = beneficiary.pk
        label = str(beneficiary)
        beneficiary.delete()
        record_timeline_event(
            case=case,
            event_type=TimelineEventType.UPDATED,
            message=f"Membre de la famille retiré : {label}",
            actor=request.user,
            metadata={"beneficiary_id": beneficiary_id},
        )
        log_audit(
            request=request,
            action="BENEFICIARY_DELETED",
            entity_type="Beneficiary",
            entity_id=beneficiary_id,
            case=case,
        )
        return Response(status=status.HTTP_204_NO_CONTENT)


class CaseGuardianViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    viewsets.GenericViewSet,
):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get_case(self):
        return get_accessible_case_or_404(self.request.user, self.kwargs["case_pk"])

    def get_queryset(self):
        return Guardian.objects.filter(case_id=self.kwargs["case_pk"]).select_related("user")

    def get_serializer_class(self):
        if self.action == "create":
            return GuardianCreateSerializer
        return GuardianSerializer

    @extend_schema(tags=("Tuteurs",))
    def list(self, request, *args, **kwargs):
        self.get_case()
        return super().list(request, *args, **kwargs)

    @extend_schema(tags=("Tuteurs",))
    @transaction.atomic
    def create(self, request, *args, **kwargs):
        case = self.get_case()
        ensure_case_writable(request.user, case)
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        guardian = Guardian.objects.create(case=case, **serializer.validated_data)
        record_timeline_event(
            case=case,
            event_type=TimelineEventType.UPDATED,
            message=f"Tuteur ajouté : {guardian}",
            actor=request.user,
            metadata={"guardian_id": guardian.pk},
        )
        log_audit(
            request=request,
            action="GUARDIAN_CREATED",
            entity_type="Guardian",
            entity_id=guardian.pk,
            case=case,
        )
        try_auto_provision_profile_access(
            case,
            "guardian",
            guardian.pk,
            actor=request.user,
        )
        return Response(GuardianSerializer(guardian).data, status=status.HTTP_201_CREATED)


class GuardianViewSet(
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    queryset = Guardian.objects.select_related("case", "user")
    http_method_names = ["get", "patch", "head", "options"]

    def get_serializer_class(self):
        if self.action == "partial_update":
            return GuardianUpdateSerializer
        return GuardianSerializer

    def get_object(self):
        guardian = super().get_object()
        get_accessible_case_or_404(self.request.user, guardian.case_id)
        return guardian

    @extend_schema(tags=("Tuteurs",))
    def partial_update(self, request, *args, **kwargs):
        guardian = self.get_object()
        ensure_case_writable(request.user, guardian.case)
        serializer = GuardianUpdateSerializer(guardian, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        log_audit(
            request=request,
            action="GUARDIAN_UPDATED",
            entity_type="Guardian",
            entity_id=guardian.pk,
            case=guardian.case,
        )
        return Response(GuardianSerializer(guardian).data)
