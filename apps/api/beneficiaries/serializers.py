from rest_framework import serializers

from beneficiaries.patrimony import (
    compute_beneficiary_patrimony_share_value,
    get_case_patrimony_total,
)
from cases.models import CaseType
from beneficiaries.models import (
    Beneficiary,
    CaseDonor,
    DonorTrustedPerson,
    FamilyRelation,
    FamilyRelationType,
    Guardian,
    RelationToDonorType,
)


class DonorTrustedPersonSerializer(serializers.ModelSerializer):
    class Meta:
        model = DonorTrustedPerson
        fields = (
            "id",
            "donor",
            "first_name",
            "last_name",
            "phone",
            "email",
            "relationship_label",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "donor", "created_at", "updated_at")


class DonorTrustedPersonCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = DonorTrustedPerson
        fields = (
            "first_name",
            "last_name",
            "phone",
            "email",
            "relationship_label",
        )


class CaseDonorSerializer(serializers.ModelSerializer):
    trusted_persons = DonorTrustedPersonSerializer(many=True, read_only=True)

    class Meta:
        model = CaseDonor
        fields = (
            "id",
            "case",
            "first_name",
            "last_name",
            "date_of_birth",
            "nationality",
            "identification_number",
            "email",
            "phone",
            "address",
            "notes",
            "trusted_persons",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "case", "created_at", "updated_at", "trusted_persons")


class CaseDonorCreateSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(required=False, allow_blank=True)

    class Meta:
        model = CaseDonor
        fields = (
            "first_name",
            "last_name",
            "date_of_birth",
            "nationality",
            "identification_number",
            "email",
            "phone",
            "address",
            "notes",
        )


class CaseDonorUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = CaseDonor
        fields = (
            "first_name",
            "last_name",
            "date_of_birth",
            "nationality",
            "identification_number",
            "email",
            "phone",
            "address",
            "notes",
        )


class GuardianSerializer(serializers.ModelSerializer):
    class Meta:
        model = Guardian
        fields = (
            "id",
            "case",
            "user",
            "first_name",
            "last_name",
            "email",
            "phone",
            "relationship_label",
            "notes",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "case", "created_at", "updated_at")


class GuardianCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Guardian
        fields = (
            "user",
            "first_name",
            "last_name",
            "email",
            "phone",
            "relationship_label",
            "notes",
        )


class GuardianInlineCreateSerializer(serializers.Serializer):
    """Création d'un tuteur lors de l'ajout d'un héritier."""

    first_name = serializers.CharField(max_length=128)
    last_name = serializers.CharField(max_length=128)
    email = serializers.EmailField(required=False, allow_blank=True)
    phone = serializers.CharField(max_length=64, required=False, allow_blank=True)
    relationship_label = serializers.CharField(max_length=128, required=False, allow_blank=True)


class GuardianUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Guardian
        fields = (
            "user",
            "first_name",
            "last_name",
            "email",
            "phone",
            "relationship_label",
            "notes",
        )


def validate_patrimony_share_percent_value(value):
    if value is None:
        return value
    if value < 0 or value > 100:
        raise serializers.ValidationError(
            "La part patrimoniale doit être comprise entre 0 et 100 %."
        )
    return value


class BeneficiarySerializer(serializers.ModelSerializer):
    relation_to_donor_label = serializers.CharField(
        source="get_relation_to_donor_display",
        read_only=True,
    )
    donor_name = serializers.SerializerMethodField()
    guardian_name = serializers.SerializerMethodField()
    case_patrimony_total = serializers.SerializerMethodField()
    case_patrimony_currency = serializers.SerializerMethodField()
    patrimony_share_value = serializers.SerializerMethodField()
    father_name = serializers.SerializerMethodField()
    mother_name = serializers.SerializerMethodField()

    def get_father_name(self, obj: Beneficiary) -> str | None:
        if not obj.father_id:
            return None
        return f"{obj.father.first_name} {obj.father.last_name}".strip()

    def get_mother_name(self, obj: Beneficiary) -> str | None:
        if not obj.mother_id:
            return None
        return f"{obj.mother.first_name} {obj.mother.last_name}".strip()

    def get_donor_name(self, obj: Beneficiary) -> str | None:
        if not obj.donor_id:
            return None
        return f"{obj.donor.first_name} {obj.donor.last_name}"

    def get_guardian_name(self, obj: Beneficiary) -> str | None:
        if not obj.guardian_id:
            return None
        g = obj.guardian
        return f"{g.first_name} {g.last_name}"

    def get_case_patrimony_total(self, obj: Beneficiary) -> str:
        total, _currency = get_case_patrimony_total(obj.case)
        return str(total)

    def get_case_patrimony_currency(self, obj: Beneficiary) -> str:
        _total, currency = get_case_patrimony_total(obj.case)
        return currency

    def get_patrimony_share_value(self, obj: Beneficiary) -> str | None:
        value = compute_beneficiary_patrimony_share_value(
            obj.case,
            obj.patrimony_share_percent,
        )
        return str(value) if value is not None else None

    class Meta:
        model = Beneficiary
        fields = (
            "id",
            "case",
            "donor",
            "donor_name",
            "guardian",
            "guardian_name",
            "relation_to_donor",
            "relation_to_donor_label",
            "gender",
            "father",
            "mother",
            "father_name",
            "mother_name",
            "first_name",
            "last_name",
            "date_of_birth",
            "nationality",
            "identification_number",
            "is_minor",
            "notes",
            "patrimony_share_percent",
            "patrimony_share_value",
            "case_patrimony_total",
            "case_patrimony_currency",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "case",
            "created_at",
            "updated_at",
            "donor_name",
            "guardian_name",
            "relation_to_donor_label",
            "patrimony_share_value",
            "case_patrimony_total",
            "case_patrimony_currency",
        )


class BeneficiaryCreateSerializer(serializers.ModelSerializer):
    patrimony_share_percent = serializers.DecimalField(
        max_digits=7,
        decimal_places=4,
        required=False,
        allow_null=True,
    )
    relation_to_donor = serializers.ChoiceField(
        choices=RelationToDonorType.choices,
        required=False,
        allow_blank=True,
    )
    guardian_id = serializers.PrimaryKeyRelatedField(
        queryset=Guardian.objects.all(),
        source="guardian",
        required=False,
        allow_null=True,
    )
    new_guardian = GuardianInlineCreateSerializer(required=False)
    father_id = serializers.PrimaryKeyRelatedField(
        queryset=Beneficiary.objects.all(),
        source="father",
        required=False,
        allow_null=True,
    )
    mother_id = serializers.PrimaryKeyRelatedField(
        queryset=Beneficiary.objects.all(),
        source="mother",
        required=False,
        allow_null=True,
    )
    gender = serializers.ChoiceField(
        choices=(("M", "Homme"), ("F", "Femme")),
        required=False,
        allow_blank=True,
    )

    class Meta:
        model = Beneficiary
        fields = (
            "donor",
            "relation_to_donor",
            "gender",
            "father_id",
            "mother_id",
            "first_name",
            "last_name",
            "date_of_birth",
            "nationality",
            "identification_number",
            "is_minor",
            "notes",
            "patrimony_share_percent",
            "guardian_id",
            "new_guardian",
        )

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        case = self.context.get("case")
        if case is not None:
            self.fields["guardian_id"].queryset = Guardian.objects.filter(case=case)
            family_qs = Beneficiary.objects.filter(case=case)
            self.fields["father_id"].queryset = family_qs
            self.fields["mother_id"].queryset = family_qs

    def validate_patrimony_share_percent(self, value):
        return validate_patrimony_share_percent_value(value)

    def validate(self, attrs):
        case = self.context.get("case")
        donor = attrs.get("donor")
        if donor and case and donor.case_id != case.pk:
            raise serializers.ValidationError(
                {"donor": "Ce donateur n'appartient pas à ce dossier."}
            )

        guardian = attrs.get("guardian")
        new_guardian = attrs.get("new_guardian")
        if guardian and new_guardian:
            raise serializers.ValidationError(
                "Choisissez un tuteur existant ou créez-en un nouveau, pas les deux."
            )
        if guardian and case and guardian.case_id != case.pk:
            raise serializers.ValidationError(
                {"guardian_id": "Ce tuteur n'appartient pas à ce dossier."}
            )

        is_minor = attrs.get("is_minor", False)
        errors: dict[str, list[str]] = {}
        succession = case and case.case_type == CaseType.SUCCESSION

        if succession:
            relation = attrs.get("relation_to_donor") or ""
            gender = (attrs.get("gender") or "").strip()
            existing_qs = Beneficiary.objects.filter(case=case)

            if relation == RelationToDonorType.PARENT:
                if gender == "M" and existing_qs.filter(
                    relation_to_donor=RelationToDonorType.PARENT, gender="M"
                ).exists():
                    errors.setdefault("relation_to_donor", []).append(
                        "Le père du défunt est déjà enregistré dans ce dossier."
                    )
                if gender == "F" and existing_qs.filter(
                    relation_to_donor=RelationToDonorType.PARENT, gender="F"
                ).exists():
                    errors.setdefault("relation_to_donor", []).append(
                        "La mère du défunt est déjà enregistrée dans ce dossier."
                    )

            if relation == RelationToDonorType.SPOUSE and gender == "M":
                if existing_qs.filter(
                    relation_to_donor=RelationToDonorType.SPOUSE, gender="M"
                ).exists():
                    errors.setdefault("relation_to_donor", []).append(
                        "L'époux du défunt est déjà enregistré dans ce dossier."
                    )

            if relation == RelationToDonorType.CHILD:
                father = attrs.get("father")
                mother = attrs.get("mother")
                wives = existing_qs.filter(relation_to_donor=RelationToDonorType.SPOUSE).exclude(
                    gender="M"
                )
                husbands = existing_qs.filter(
                    relation_to_donor=RelationToDonorType.SPOUSE, gender="M"
                )
                if wives.exists() and not mother:
                    errors.setdefault("mother_id", []).append(
                        "Indiquez la mère de l'enfant parmi les épouses du défunt."
                    )
                if husbands.exists() and not father:
                    errors.setdefault("father_id", []).append(
                        "Indiquez le père de l'enfant (époux du défunt)."
                    )
                if mother and wives.count() > 1 and not wives.filter(pk=mother.pk).exists():
                    errors.setdefault("mother_id", []).append(
                        "La mère doit être l'une des épouses enregistrées du défunt."
                    )
                if mother and wives.count() == 1 and not wives.filter(pk=mother.pk).exists():
                    errors.setdefault("mother_id", []).append(
                        "La mère doit être l'épouse enregistrée du défunt."
                    )
                if not (attrs.get("gender") or "").strip():
                    errors.setdefault("gender", []).append(
                        "Indiquez fils ou fille pour l'enfant."
                    )
                if not father and not mother:
                    errors.setdefault("father_id", []).append(
                        "Pour un enfant, renseignez au moins le père ou la mère "
                        "(enregistrez-les avant si besoin)."
                    )
                if father and father.case_id != case.pk:
                    errors.setdefault("father_id", []).append(
                        "Le père doit être un membre de la famille du dossier."
                    )
                if mother and mother.case_id != case.pk:
                    errors.setdefault("mother_id", []).append(
                        "La mère doit être un membre de la famille du dossier."
                    )
            elif relation == RelationToDonorType.OTHER:
                father = attrs.get("father")
                mother = attrs.get("mother")
                if not father and not mother:
                    errors.setdefault("father_id", []).append(
                        "Pour un lien indirect, renseignez au moins le père ou la mère "
                        "déjà présent dans l'arbre familial."
                    )
                if father and father.case_id != case.pk:
                    errors.setdefault("father_id", []).append(
                        "Le père doit être un membre de la famille du dossier."
                    )
                if mother and mother.case_id != case.pk:
                    errors.setdefault("mother_id", []).append(
                        "La mère doit être un membre de la famille du dossier."
                    )
        elif is_minor and not guardian and not new_guardian:
            raise serializers.ValidationError(
                "Un tuteur est obligatoire pour un bénéficiaire mineur "
                "(sélectionnez un tuteur existant ou créez-en un nouveau)."
            )

        if errors:
            raise serializers.ValidationError(errors)

        if new_guardian:
            if not new_guardian.get("first_name", "").strip() or not new_guardian.get(
                "last_name", ""
            ).strip():
                raise serializers.ValidationError(
                    {"new_guardian": "Prénom et nom du tuteur sont obligatoires."}
                )
        return attrs

    def create(self, validated_data):
        case = self.context["case"]
        new_guardian_data = validated_data.pop("new_guardian", None)
        guardian = validated_data.pop("guardian", None)

        if new_guardian_data:
            guardian = Guardian.objects.create(case=case, **new_guardian_data)

        beneficiary = Beneficiary.objects.create(
            case=case,
            guardian=guardian,
            **validated_data,
        )

        if guardian:
            FamilyRelation.objects.create(
                case=case,
                from_beneficiary=beneficiary,
                to_guardian=guardian,
                relation_type=FamilyRelationType.GUARDIAN,
            )

        father = beneficiary.father
        mother = beneficiary.mother
        if father:
            FamilyRelation.objects.create(
                case=case,
                from_beneficiary=father,
                to_beneficiary=beneficiary,
                relation_type=FamilyRelationType.CHILD,
            )
        if mother:
            FamilyRelation.objects.create(
                case=case,
                from_beneficiary=mother,
                to_beneficiary=beneficiary,
                relation_type=FamilyRelationType.CHILD,
            )

        return beneficiary


class BeneficiaryUpdateSerializer(serializers.ModelSerializer):
    patrimony_share_percent = serializers.DecimalField(
        max_digits=7,
        decimal_places=4,
        required=False,
        allow_null=True,
    )
    guardian_id = serializers.PrimaryKeyRelatedField(
        queryset=Guardian.objects.all(),
        source="guardian",
        required=False,
        allow_null=True,
    )
    father_id = serializers.PrimaryKeyRelatedField(
        queryset=Beneficiary.objects.all(),
        source="father",
        required=False,
        allow_null=True,
    )
    mother_id = serializers.PrimaryKeyRelatedField(
        queryset=Beneficiary.objects.all(),
        source="mother",
        required=False,
        allow_null=True,
    )
    gender = serializers.ChoiceField(
        choices=(("M", "Homme"), ("F", "Femme")),
        required=False,
        allow_blank=True,
    )

    class Meta:
        model = Beneficiary
        fields = (
            "donor",
            "guardian_id",
            "relation_to_donor",
            "gender",
            "father_id",
            "mother_id",
            "first_name",
            "last_name",
            "date_of_birth",
            "nationality",
            "identification_number",
            "is_minor",
            "notes",
            "patrimony_share_percent",
        )

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        instance = self.instance
        if instance is not None:
            family_qs = Beneficiary.objects.filter(case_id=instance.case_id).exclude(
                pk=instance.pk
            )
            self.fields["father_id"].queryset = family_qs
            self.fields["mother_id"].queryset = family_qs
            self.fields["guardian_id"].queryset = Guardian.objects.filter(
                case_id=instance.case_id
            )

    def validate_patrimony_share_percent(self, value):
        return validate_patrimony_share_percent_value(value)


class FamilyRelationSerializer(serializers.ModelSerializer):
    class Meta:
        model = FamilyRelation
        fields = (
            "id",
            "case",
            "from_beneficiary",
            "to_beneficiary",
            "to_guardian",
            "relation_type",
            "notes",
            "created_at",
        )
        read_only_fields = ("id", "case", "created_at")
