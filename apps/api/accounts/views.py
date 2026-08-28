import logging

from django.conf import settings
from drf_spectacular.utils import extend_schema
from django.contrib.auth import get_user_model
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.generics import RetrieveAPIView
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from django.db import transaction
from django.db.models import ProtectedError, Q

from accounts.case_profile_invite import (
    ProfileInviteError,
    approve_profile_access_request,
    reject_profile_access_request,
)
from accounts.models import (
    ProfileUserAccessRequest,
    ProfileUserAccessRequestStatus,
    RoleAssignment,
    UserRole,
)
from accounts.serializers_profile_access import (
    ProfileUserAccessApproveSerializer,
    ProfileUserAccessPreviewSerializer,
    ProfileUserAccessRejectSerializer,
    ProfileUserAccessRequestSerializer,
)
from accounts.permissions import CanManageUsersOnly, UserScopedAccess, user_can_manage_users
from accounts.user_case_links import (
    build_case_links_by_user_id,
    filter_users_by_account_status,
    filter_users_by_profile_type,
    filter_users_by_role,
    filter_users_by_scope,
    filter_users_by_search,
    revoke_user_case_access,
    user_has_global_case_access,
)
from accounts.emails import (
    CaseInviteEmailError,
    LoginOtpEmailError,
    send_manual_user_welcome_email,
    send_user_password_reset_email,
)
from accounts.login_otp import mask_email, start_login_challenge, verify_login_challenge
from accounts.passwords import generate_initial_password
from accounts.serializers import (
    AssignRoleSerializer,
    ChangePasswordSerializer,
    CustomTokenObtainPairSerializer,
    LoginStartSerializer,
    LoginVerifySerializer,
    MeSerializer,
    VerifyPasswordSerializer,
    UserAdminPatchSerializer,
    UserCreateSerializer,
    UserListSerializer,
    UserSelfPatchSerializer,
)

User = get_user_model()
logger = logging.getLogger(__name__)


def _user_has_super_admin_access(user) -> bool:
    if user.is_superuser:
        return True
    return user.role_assignments.filter(role=UserRole.SUPER_ADMIN).exists()


def _super_admin_user_count(*, exclude_pk: int | None = None) -> int:
    qs = User.objects.filter(
        Q(is_superuser=True) | Q(role_assignments__role=UserRole.SUPER_ADMIN)
    ).distinct()
    if exclude_pk is not None:
        qs = qs.exclude(pk=exclude_pk)
    return qs.count()


@extend_schema(
    summary="JWT — obtention access / refresh",
    tags=("Auth",),
)
class LoginStartView(APIView):
    """Étape 1 : identifiant (e-mail ou téléphone) + mot de passe → envoi OTP par e-mail."""

    authentication_classes = ()
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginStartSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        identifier = serializer.validated_data["identifier"]
        password = serializer.validated_data["password"]
        try:
            challenge = start_login_challenge(identifier, password)
        except ValueError as exc:
            code = str(exc)
            if code == "no_email":
                return Response(
                    {
                        "detail": (
                            "Aucune adresse e-mail n'est associée à ce compte. "
                            "Contactez l'administrateur."
                        ),
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if code == "account_inactive":
                return Response(
                    {
                        "detail": (
                            "Ce compte est bloqué. Contactez un administrateur "
                            "pour le réactiver."
                        ),
                    },
                    status=status.HTTP_403_FORBIDDEN,
                )
            return Response(
                {"detail": "Identifiant ou mot de passe incorrect."},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        except LoginOtpEmailError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        payload = {
            "challenge_token": str(challenge.token),
            "masked_email": mask_email(challenge.sent_to_email),
            "expires_in_seconds": 600,
        }
        dev_code = getattr(challenge, "dev_code", None)
        dev_notice = getattr(challenge, "dev_notice", None)
        delivered_to = getattr(challenge, "delivered_to", None) or challenge.sent_to_email

        if dev_code and getattr(settings, "LOGIN_OTP_EXPOSE_DEV_CODE", False):
            payload["dev_code"] = dev_code
            payload["dev_notice"] = dev_notice or (
                "Utilisez le code affiché ci-dessous pour terminer la connexion."
            )
            payload["delivery"] = "display"
        else:
            payload["delivery"] = "email"
            if (
                delivered_to
                and delivered_to.lower() != challenge.sent_to_email.lower()
            ):
                payload["delivery"] = "admin_relay"
                payload["delivery_notice"] = (
                    f"Mode test : le code a été envoyé à {mask_email(delivered_to)} "
                    f"(relai admin, compte {mask_email(challenge.sent_to_email)}). "
                    "En production, configurez SMTP pour envoyer le code à l'utilisateur."
                )
        return Response(payload, status=status.HTTP_200_OK)


class LoginVerifyView(APIView):
    """Étape 2 : code à 6 chiffres → jetons JWT."""

    authentication_classes = ()
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginVerifySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        token = str(serializer.validated_data["challenge_token"])
        code = serializer.validated_data["code"]
        try:
            user = verify_login_challenge(token, code)
        except ValueError as exc:
            err = str(exc)
            if err == "expired":
                detail = "Ce code a expiré. Reconnectez-vous pour en recevoir un nouveau."
            elif err == "too_many_attempts":
                detail = "Trop de tentatives. Reconnectez-vous pour obtenir un nouveau code."
            elif err == "invalid_challenge":
                detail = "Session de connexion invalide. Recommencez depuis le début."
            else:
                detail = "Code incorrect."
            return Response({"detail": detail}, status=status.HTTP_400_BAD_REQUEST)

        refresh = CustomTokenObtainPairSerializer.get_token(user)
        roles = list(
            RoleAssignment.objects.filter(user=user).values_list("role", flat=True)
        )
        return Response(
            {
                "refresh": str(refresh),
                "access": str(refresh.access_token),
                "user": {
                    "id": user.id,
                    "username": user.username,
                    "email": user.email,
                    "roles": roles,
                },
            },
            status=status.HTTP_200_OK,
        )


class ChangePasswordView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        if not request.user.check_password(serializer.validated_data["current_password"]):
            return Response(
                {"current_password": ["Mot de passe actuel incorrect."]},
                status=status.HTTP_400_BAD_REQUEST,
            )
        request.user.set_password(serializer.validated_data["new_password"])
        request.user.save(update_fields=["password"])
        return Response({"ok": True})


class JWTPublicObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer
    authentication_classes = ()
    permission_classes = [AllowAny]


@extend_schema(
    summary="JWT — rafraîchir l’access token",
    tags=("Auth",),
)
class JWTPublicRefreshView(TokenRefreshView):
    authentication_classes = ()
    permission_classes = [AllowAny]


@extend_schema(
    summary="Profil de l’utilisateur authentifié + rôles",
    responses={200: MeSerializer},
    tags=("Utilisateurs",),
)
@extend_schema(
    summary="Vérifier le mot de passe de l'utilisateur connecté",
    request=VerifyPasswordSerializer,
    responses={200: None},
    tags=("Auth",),
)
class VerifyPasswordView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = VerifyPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        if not request.user.check_password(serializer.validated_data["password"]):
            return Response(
                {"detail": "Mot de passe incorrect."},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        return Response({"ok": True})


class MeView(RetrieveAPIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    serializer_class = MeSerializer
    queryset = User.objects.all()

    def get_object(self):
        return (
            User.objects.prefetch_related("role_assignments")
            .select_related("profile")
            .get(pk=self.request.user.pk)
        )


class UserViewSet(viewsets.ModelViewSet):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated, UserScopedAccess]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_queryset(self):
        qs = User.objects.prefetch_related("role_assignments").select_related("profile").all()
        if user_can_manage_users(self.request.user):
            q = (self.request.query_params.get("q") or "").strip()
            profile_type = (self.request.query_params.get("profile_type") or "").strip()
            role = (self.request.query_params.get("role") or "").strip()
            scope = (self.request.query_params.get("scope") or "").strip()
            account_status = (self.request.query_params.get("status") or "").strip()
            if q:
                qs = filter_users_by_search(qs, q)
            if profile_type:
                qs = filter_users_by_profile_type(qs, profile_type)
            if role:
                qs = filter_users_by_role(qs, role)
            if scope:
                qs = filter_users_by_scope(qs, scope)
            if account_status:
                qs = filter_users_by_account_status(qs, account_status)
            return qs.order_by("-date_joined", "id")
        return qs.filter(id=self.request.user.id)

    def get_serializer_context(self):
        context = super().get_serializer_context()
        if not user_can_manage_users(self.request.user):
            return context
        if self.action == "list":
            queryset = self.filter_queryset(self.get_queryset())
            user_ids = list(queryset.values_list("pk", flat=True))
            context["case_links_by_user_id"] = build_case_links_by_user_id(user_ids)
        elif self.action == "retrieve":
            try:
                user_id = int(self.kwargs.get("pk"))
            except (TypeError, ValueError):
                user_id = None
            if user_id is not None:
                context["case_links_by_user_id"] = build_case_links_by_user_id(
                    [user_id]
                )
        return context

    def get_serializer_class(self):
        if self.action == "create":
            return UserCreateSerializer
        if self.action == "partial_update":
            return (
                UserAdminPatchSerializer
                if user_can_manage_users(self.request.user)
                else UserSelfPatchSerializer
            )
        return UserListSerializer

    @extend_schema(
        summary="Créer un utilisateur (avec rôles facultatifs)",
        request=UserCreateSerializer,
        responses={201: UserListSerializer},
        tags=("Utilisateurs",),


    )
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        initial_password = serializer.validated_data.get("password")
        user = serializer.save()
        payload = UserListSerializer(user).data
        welcome_email_sent = False
        welcome_email_error: str | None = None
        if user.email:
            try:
                profile = getattr(user, "profile", None)
                send_manual_user_welcome_email(
                    user_id=user.pk,
                    to_email=user.email,
                    display_name=(profile.display_name if profile else "")
                    or user.get_full_name()
                    or user.username,
                    username=user.username,
                    phone=(profile.phone if profile else "") or "",
                    temporary_password=initial_password,
                )
                welcome_email_sent = True
            except (CaseInviteEmailError, LoginOtpEmailError) as exc:
                welcome_email_error = str(exc)
                logger.warning("E-mail de bienvenue non envoyé pour %s: %s", user.pk, exc)
            except Exception:
                welcome_email_error = "Envoi de l'e-mail de bienvenue impossible."
                logger.exception("E-mail de bienvenue pour utilisateur %s", user.pk)
        if welcome_email_sent:
            payload["welcome_email_sent"] = True
        elif welcome_email_error:
            payload["welcome_email_error"] = welcome_email_error
        return Response(payload, status=status.HTTP_201_CREATED)

    @extend_schema(
        summary="Liste des utilisateurs (gestionnaires uniquement)",
        tags=("Utilisateurs",),


    )
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)

    @extend_schema(
        summary="Utilisateur détaillé",
        responses={200: UserListSerializer},
        tags=("Utilisateurs",),


    )
    def retrieve(self, request, *args, **kwargs):
        return super().retrieve(request, *args, **kwargs)

    @extend_schema(
        summary="Mise à jour partielle d’un utilisateur",
        responses={200: UserListSerializer},
        tags=("Utilisateurs",),


    )
    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        if (
            instance.pk == request.user.pk
            and request.data.get("is_active") is False
        ):
            return Response(
                {"detail": "Vous ne pouvez pas bloquer votre propre compte."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        pk = kwargs.get("pk")
        response = super().partial_update(request, *args, **kwargs)
        if response.status_code >= status.HTTP_400_BAD_REQUEST:
            return response
        instance = (
            User.objects.prefetch_related("role_assignments")
            .select_related("profile")
            .get(pk=pk)
        )
        link_context = {
            "case_links_by_user_id": build_case_links_by_user_id([instance.pk]),
        }
        return Response(UserListSerializer(instance, context=link_context).data)

    @extend_schema(
        summary="Supprimer un compte utilisateur",
        responses={204: None, 400: None, 409: None},
        tags=("Utilisateurs",),
    )
    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.pk == request.user.pk:
            return Response(
                {"detail": "Vous ne pouvez pas supprimer votre propre compte."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if _user_has_super_admin_access(instance) and _super_admin_user_count(
            exclude_pk=instance.pk
        ) == 0:
            return Response(
                {
                    "detail": (
                        "Impossible de supprimer le dernier compte super administrateur."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            instance.delete()
        except ProtectedError:
            return Response(
                {
                    "detail": (
                        "Ce compte est lié à des données métier. "
                        "Bloquez-le plutôt que de le supprimer."
                    )
                },
                status=status.HTTP_409_CONFLICT,
            )
        return Response(status=status.HTTP_204_NO_CONTENT)

    @extend_schema(
        summary="Réinitialiser le mot de passe d'un utilisateur",
        tags=("Utilisateurs",),
    )
    @action(
        detail=True,
        methods=["post"],
        url_path="reset-password",
        permission_classes=[IsAuthenticated, CanManageUsersOnly],
    )
    def reset_password(self, request, pk=None):
        user_obj = self.get_object()
        if not (user_obj.email or "").strip():
            return Response(
                {
                    "detail": (
                        "Ce compte n'a pas d'e-mail : ajoutez-en un avant de réinitialiser "
                        "le mot de passe (requis pour le code OTP)."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        new_password = generate_initial_password()
        user_obj.set_password(new_password)
        if not user_obj.is_active:
            user_obj.is_active = True
            user_obj.save(update_fields=["password", "is_active"])
        else:
            user_obj.save(update_fields=["password"])

        profile = getattr(user_obj, "profile", None)
        display_name = (profile.display_name if profile else "") or user_obj.get_full_name()
        email_sent = False
        email_error: str | None = None
        try:
            send_user_password_reset_email(
                to_email=user_obj.email,
                display_name=display_name,
                username=user_obj.username,
                temporary_password=new_password,
                phone=(profile.phone if profile else "") or "",
            )
            email_sent = True
        except CaseInviteEmailError as exc:
            email_error = str(exc)
            logger.warning(
                "E-mail reset password non envoyé pour %s: %s", user_obj.pk, exc
            )

        return Response(
            {
                "username": user_obj.username,
                "email": user_obj.email,
                "temporary_password": new_password,
                "email_sent": email_sent,
                "email_error": email_error,
                "is_active": user_obj.is_active,
            }
        )

    @extend_schema(
        summary="Suspendre l'accès d'un utilisateur à un dossier",
        tags=("Utilisateurs",),
    )
    @action(
        detail=True,
        methods=["post"],
        url_path="revoke-case-access",
        permission_classes=[IsAuthenticated, CanManageUsersOnly],
    )
    def revoke_case_access(self, request, pk=None):
        user_obj = self.get_object()
        if user_has_global_case_access(user_obj):
            return Response(
                {
                    "detail": (
                        "Ce compte (Direction, administrateur ou comité charaïque) "
                        "a accès à tous les dossiers : l'accès ne peut pas être "
                        "suspendu dossier par dossier."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        case_id = request.data.get("case_id")
        try:
            case_id = int(case_id)
        except (TypeError, ValueError):
            return Response(
                {"detail": "Identifiant de dossier invalide."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from cases.models import FiduciaryCase

        try:
            case = FiduciaryCase.objects.get(pk=case_id, deleted_at__isnull=True)
        except FiduciaryCase.DoesNotExist:
            return Response(
                {"detail": "Dossier introuvable."},
                status=status.HTTP_404_NOT_FOUND,
            )

        result = revoke_user_case_access(
            user=user_obj,
            case=case,
            actor=request.user,
        )
        if not result["removed_stakeholders"] and not result["cleared_manager"]:
            return Response(
                {"detail": "Aucun accès explicite trouvé pour ce dossier."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        link_context = {
            "case_links_by_user_id": build_case_links_by_user_id([user_obj.pk]),
        }
        user_obj = (
            User.objects.prefetch_related("role_assignments")
            .select_related("profile")
            .get(pk=user_obj.pk)
        )
        return Response(UserListSerializer(user_obj, context=link_context).data)

    @extend_schema(
        summary="Ajouter un rôle métier à un utilisateur",
        request=AssignRoleSerializer,
        responses={200: UserListSerializer},
        tags=("Utilisateurs",),


    )
    @action(
        detail=True,
        methods=["post"],
        url_path="roles",
        permission_classes=[IsAuthenticated, CanManageUsersOnly],
    )
    def roles(self, request, pk=None):
        serializer = AssignRoleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user_obj = self.get_queryset().get(pk=self.kwargs["pk"])
        RoleAssignment.objects.get_or_create(
            user=user_obj, role=serializer.validated_data["role"]
        )
        user_refreshed = (
            User.objects.prefetch_related("role_assignments")
            .select_related("profile")
            .get(pk=user_obj.pk)
        )
        return Response(UserListSerializer(user_refreshed).data)


class ProfileUserAccessRequestViewSet(viewsets.ReadOnlyModelViewSet):
    """File d'attente des comptes à créer depuis les profils de dossiers."""

    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated, CanManageUsersOnly]
    serializer_class = ProfileUserAccessRequestSerializer
    http_method_names = ["get", "post", "head", "options"]

    def get_queryset(self):
        qs = ProfileUserAccessRequest.objects.select_related(
            "case",
            "requested_by",
            "existing_user",
            "created_user",
            "reviewed_by",
        )
        status_param = self.request.query_params.get("status")
        if status_param:
            qs = qs.filter(status=status_param)
        else:
            qs = qs.filter(status=ProfileUserAccessRequestStatus.PENDING)
        return qs.order_by("-created_at")

    @extend_schema(
        summary="Liste des demandes d'accès plateforme (profils de dossiers)",
        tags=("Utilisateurs",),
    )
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)

    @extend_schema(
        summary="Prévisualiser une demande avant validation",
        responses={200: ProfileUserAccessPreviewSerializer},
        tags=("Utilisateurs",),
    )
    @action(detail=True, methods=["get"], url_path="preview")
    def preview(self, request, pk=None):
        access_request = self.get_object()
        serializer = ProfileUserAccessPreviewSerializer(access_request)
        return Response(serializer.data)

    @extend_schema(
        summary="Valider une demande — créer ou rattacher le compte",
        request=ProfileUserAccessApproveSerializer,
        tags=("Utilisateurs",),
    )
    @action(detail=True, methods=["post"], url_path="approve")
    @transaction.atomic
    def approve(self, request, pk=None):
        access_request = self.get_object()
        serializer = ProfileUserAccessApproveSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        try:
            result = approve_profile_access_request(
                access_request,
                email=data["email"],
                confirm_add_existing=data["confirm_add_existing"],
                reviewer=request.user,
                review_notes=data.get("review_notes") or "",
            )
        except ProfileInviteError as exc:
            status_code = status.HTTP_400_BAD_REQUEST
            if exc.code == "confirmation_required":
                status_code = status.HTTP_409_CONFLICT
            return Response(
                {"code": exc.code, "message": exc.message, **exc.extra},
                status=status_code,
            )
        access_request.refresh_from_db()
        return Response(
            {
                "request": ProfileUserAccessRequestSerializer(access_request).data,
                "invite": result,
            },
            status=status.HTTP_200_OK,
        )

    @extend_schema(
        summary="Refuser une demande d'accès plateforme",
        request=ProfileUserAccessRejectSerializer,
        tags=("Utilisateurs",),
    )
    @action(detail=True, methods=["post"], url_path="reject")
    @transaction.atomic
    def reject(self, request, pk=None):
        access_request = self.get_object()
        serializer = ProfileUserAccessRejectSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            reject_profile_access_request(
                access_request,
                reviewer=request.user,
                review_notes=serializer.validated_data.get("review_notes") or "",
            )
        except ProfileInviteError as exc:
            return Response(
                {"code": exc.code, "message": exc.message},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(ProfileUserAccessRequestSerializer(access_request).data)
