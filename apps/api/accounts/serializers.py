from accounts.login_otp import normalize_phone
from accounts.models import (ExternalPartyProfile, ExternalPartyType,
                             RoleAssignment, UserProfile, UserRole)
from accounts.usernames import generate_unique_username
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.db import models
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

User = get_user_model()


class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProfile
        fields = (
            "display_name",
            "phone",
            "timezone",
            "locale",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("created_at", "updated_at")


class VerifyPasswordSerializer(serializers.Serializer):
    password = serializers.CharField(write_only=True, trim_whitespace=False)


class LoginStartSerializer(serializers.Serializer):
    identifier = serializers.CharField(
        help_text="Adresse e-mail ou numéro de téléphone enregistré sur le profil.",
    )
    password = serializers.CharField(write_only=True, trim_whitespace=False)


class LoginVerifySerializer(serializers.Serializer):
    challenge_token = serializers.UUIDField()
    code = serializers.CharField(min_length=6, max_length=6, trim_whitespace=True)


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True, trim_whitespace=False)
    new_password = serializers.CharField(write_only=True, min_length=8, trim_whitespace=False)

    def validate_new_password(self, value: str) -> str:
        validate_password(value)
        return value


class MeSerializer(serializers.ModelSerializer):
    profile = UserProfileSerializer(read_only=True)
    roles = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "is_staff",
            "is_superuser",
            "profile",
            "roles",
        )
        read_only_fields = fields

    def get_roles(self, obj: User) -> list[str]:
        return list(obj.role_assignments.values_list("role", flat=True))


class UserCaseLinkSerializer(serializers.Serializer):
    case_id = serializers.IntegerField()
    reference = serializers.CharField()
    title = serializers.CharField()
    profile_types = serializers.ListField(child=serializers.CharField())
    stakeholder_roles = serializers.ListField(
        child=serializers.CharField(),
        required=False,
    )
    is_case_manager = serializers.BooleanField(required=False)


class UserListSerializer(serializers.ModelSerializer):
    profile = UserProfileSerializer(read_only=True)
    roles = serializers.SerializerMethodField()
    case_links = serializers.SerializerMethodField()
    has_global_case_access = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "is_staff",
            "is_superuser",
            "is_active",
            "profile",
            "roles",
            "case_links",
            "has_global_case_access",
        )
        read_only_fields = fields

    def get_roles(self, obj: User) -> list[str]:
        return list(obj.role_assignments.values_list("role", flat=True))

    def get_case_links(self, obj: User) -> list[dict]:
        by_user = self.context.get("case_links_by_user_id") or {}
        return by_user.get(obj.pk, [])

    def get_has_global_case_access(self, obj: User) -> bool:
        from accounts.user_case_links import user_has_global_case_access

        return user_has_global_case_access(obj)


class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(
        write_only=True,
        min_length=8,
        trim_whitespace=False,
    )
    phone = serializers.CharField(required=True, max_length=64, trim_whitespace=True)
    party_type = serializers.ChoiceField(
        choices=ExternalPartyType.choices,
        required=False,
        allow_blank=True,
    )
    roles = serializers.ListField(
        child=serializers.ChoiceField(choices=UserRole.choices),
        required=True,
        allow_empty=False,
    )

    class Meta:
        model = User
        fields = (
            "email",
            "password",
            "first_name",
            "last_name",
            "phone",
            "party_type",
            "is_staff",
            "roles",
        )

    def validate_password(self, value: str):
        validate_password(value)
        return value

    def validate_email(self, value: str):
        normalized = (value or "").strip().lower()
        if not normalized:
            raise serializers.ValidationError("L'e-mail est obligatoire.")
        if User.objects.filter(email__iexact=normalized).exists():
            raise serializers.ValidationError("Cet e-mail est déjà utilisé.")
        return normalized

    def validate_phone(self, value: str):
        raw = (value or "").strip()
        if not raw:
            raise serializers.ValidationError("Le numéro de téléphone est obligatoire.")
        digits = normalize_phone(raw)
        if len(digits) < 8:
            raise serializers.ValidationError(
                "Numéro de téléphone invalide (8 chiffres minimum)."
            )
        qs = UserProfile.objects.exclude(phone="").filter(phone__isnull=False)
        for profile in qs.select_related("user"):
            if normalize_phone(profile.phone) == digits:
                raise serializers.ValidationError(
                    "Ce numéro est déjà associé à un autre compte."
                )
        return raw

    def validate(self, attrs):
        roles = attrs.get("roles") or []
        party_type = (attrs.get("party_type") or "").strip()
        if UserRole.FAMILLE_TUTEUR in roles and not party_type:
            raise serializers.ValidationError(
                {
                    "party_type": (
                        "Indiquez Famille (identifiant H…) ou Tuteur (T…) pour ce profil."
                    )
                }
            )
        if party_type and UserRole.FAMILLE_TUTEUR not in roles:
            raise serializers.ValidationError(
                {
                    "party_type": (
                        "Le type famille/tuteur ne s'applique qu'avec le rôle Famille / tuteur."
                    )
                }
            )
        return attrs

    def create(self, validated_data):
        roles = validated_data.pop("roles", [])
        party_type = (validated_data.pop("party_type", None) or "").strip() or None
        phone = validated_data.pop("phone", "")
        password = validated_data.pop("password")
        username = generate_unique_username(roles, party_type=party_type)
        display_name = " ".join(
            p
            for p in (
                validated_data.get("first_name") or "",
                validated_data.get("last_name") or "",
            )
            if p
        ).strip()
        user = User.objects.create_user(
            username=username,
            email=validated_data.get("email") or "",
            password=password,
            first_name=validated_data.get("first_name") or "",
            last_name=validated_data.get("last_name") or "",
            is_staff=validated_data.get("is_staff", False),
            is_active=True,
        )
        UserProfile.objects.update_or_create(
            user=user,
            defaults={
                "phone": phone,
                "display_name": display_name,
            },
        )
        for role in roles:
            RoleAssignment.objects.get_or_create(user=user, role=role)
        if party_type:
            ExternalPartyProfile.objects.update_or_create(
                user=user,
                defaults={"party_type": party_type},
            )
        return User.objects.select_related("profile").get(pk=user.pk)


class AssignRoleSerializer(serializers.Serializer):
    role = serializers.ChoiceField(choices=UserRole.choices)


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Ajoute les rôles dans la réponse JSON et comme claims JWT."""

    default_error_messages = {
        **TokenObtainPairSerializer.default_error_messages,
    }

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        roles = list(
            RoleAssignment.objects.filter(user=user).values_list("role", flat=True)
        )
        token["roles"] = roles
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        roles = list(
            RoleAssignment.objects.filter(user=self.user).values_list("role", flat=True)
        )
        data["user"] = {
            "id": self.user.id,
            "username": self.user.username,
            "email": self.user.email,
            "roles": roles,
        }
        return data


class ProfileNestedUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProfile
        fields = ("display_name", "phone", "timezone", "locale")


class UserSelfPatchSerializer(serializers.ModelSerializer):
    profile = ProfileNestedUpdateSerializer(required=False)

    class Meta:
        model = User
        fields = ("email", "first_name", "last_name", "profile")

    def update(self, instance, validated_data):
        profile_data = validated_data.pop("profile", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if profile_data is not None:
            profile, _created = UserProfile.objects.get_or_create(user=instance)
            nested = ProfileNestedUpdateSerializer(
                profile,
                data=profile_data,
                partial=True,
            )
            nested.is_valid(raise_exception=True)
            nested.save()
        return instance


def _validate_phone_unique(phone: str, *, exclude_user_id: int | None = None) -> str:
    raw = (phone or "").strip()
    if not raw:
        raise serializers.ValidationError("Le numéro de téléphone est obligatoire.")
    digits = normalize_phone(raw)
    if len(digits) < 8:
        raise serializers.ValidationError(
            "Numéro de téléphone invalide (8 chiffres minimum)."
        )
    qs = UserProfile.objects.exclude(phone="").filter(phone__isnull=False)
    if exclude_user_id is not None:
        qs = qs.exclude(user_id=exclude_user_id)
    for profile in qs.select_related("user"):
        if normalize_phone(profile.phone) == digits:
            raise serializers.ValidationError(
                "Ce numéro est déjà associé à un autre compte."
            )
    return raw


class UserAdminPatchSerializer(serializers.ModelSerializer):
    profile = ProfileNestedUpdateSerializer(required=False)
    roles = serializers.ListField(
        child=serializers.ChoiceField(choices=UserRole.choices),
        required=False,
    )
    party_type = serializers.ChoiceField(
        choices=ExternalPartyType.choices,
        required=False,
        allow_blank=True,
    )

    class Meta:
        model = User
        fields = (
            "email",
            "first_name",
            "last_name",
            "is_staff",
            "is_active",
            "profile",
            "roles",
            "party_type",
        )
        read_only_fields = ("username",)

    def validate_email(self, value: str):
        normalized = (value or "").strip().lower()
        if not normalized:
            raise serializers.ValidationError("L'e-mail est obligatoire.")
        qs = User.objects.filter(email__iexact=normalized)
        if self.instance is not None:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("Cet e-mail est déjà utilisé.")
        return normalized

    def validate(self, attrs):
        roles = attrs.get("roles")
        party_type = (attrs.get("party_type") or "").strip()
        effective_roles = roles
        if effective_roles is None and self.instance is not None:
            effective_roles = list(
                self.instance.role_assignments.values_list("role", flat=True)
            )
        if roles is not None and len(roles) == 0:
            raise serializers.ValidationError(
                {"roles": "Sélectionnez au moins un rôle métier."}
            )
        if effective_roles and UserRole.FAMILLE_TUTEUR in effective_roles and not party_type:
            if self.instance and hasattr(self.instance, "external_party"):
                party_type = self.instance.external_party.party_type
            if not party_type:
                raise serializers.ValidationError(
                    {
                        "party_type": (
                            "Indiquez Famille (identifiant H…) ou Tuteur (T…) pour ce profil."
                        )
                    }
                )
        if party_type and effective_roles and UserRole.FAMILLE_TUTEUR not in effective_roles:
            raise serializers.ValidationError(
                {
                    "party_type": (
                        "Le type famille/tuteur ne s'applique qu'avec le rôle Famille / tuteur."
                    )
                }
            )
        if self.instance is not None and attrs.get("is_active") is False:
            is_super = self.instance.is_superuser or self.instance.role_assignments.filter(
                role=UserRole.SUPER_ADMIN
            ).exists()
            if is_super:
                remaining = (
                    User.objects.filter(
                        models.Q(is_superuser=True)
                        | models.Q(role_assignments__role=UserRole.SUPER_ADMIN)
                    )
                    .distinct()
                    .exclude(pk=self.instance.pk)
                    .count()
                )
                if remaining == 0:
                    raise serializers.ValidationError(
                        {
                            "is_active": (
                                "Impossible de bloquer le dernier compte super administrateur."
                            )
                        }
                    )
        profile_data = attrs.get("profile")
        if profile_data and "phone" in profile_data:
            exclude_id = self.instance.pk if self.instance else None
            attrs["profile"] = {
                **profile_data,
                "phone": _validate_phone_unique(
                    profile_data["phone"],
                    exclude_user_id=exclude_id,
                ),
            }
        return attrs

    def update(self, instance, validated_data):
        roles = validated_data.pop("roles", None)
        party_type = validated_data.pop("party_type", None)
        profile_data = validated_data.pop("profile", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if profile_data is not None:
            profile, _created = UserProfile.objects.get_or_create(user=instance)
            nested = ProfileNestedUpdateSerializer(
                profile,
                data=profile_data,
                partial=True,
            )
            nested.is_valid(raise_exception=True)
            nested.save()
        if roles is not None:
            current = set(instance.role_assignments.values_list("role", flat=True))
            target = set(roles)
            for role in current - target:
                RoleAssignment.objects.filter(user=instance, role=role).delete()
            for role in target - current:
                RoleAssignment.objects.get_or_create(user=instance, role=role)
        if party_type is not None:
            party_type = party_type.strip() or None
            if party_type:
                ExternalPartyProfile.objects.update_or_create(
                    user=instance,
                    defaults={"party_type": party_type},
                )
            else:
                ExternalPartyProfile.objects.filter(user=instance).delete()
        return instance
