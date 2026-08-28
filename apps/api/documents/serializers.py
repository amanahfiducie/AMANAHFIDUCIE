from rest_framework import serializers

from beneficiaries.models import Beneficiary, CaseDonor, Guardian
from mandates.models import Mandate
from documents.models import (
    Document,
    DocumentCategory,
    DocumentShare,
    DocumentTag,
    DocumentVersion,
    DonorIdentityKind,
)


class DocumentTagSerializer(serializers.ModelSerializer):
    class Meta:
        model = DocumentTag
        fields = ("id", "slug", "label")
        read_only_fields = fields


class DocumentVersionSerializer(serializers.ModelSerializer):
    class Meta:
        model = DocumentVersion
        fields = (
            "id",
            "original_filename",
            "mime_type",
            "size_bytes",
            "version_number",
            "uploaded_by",
            "created_at",
        )
        read_only_fields = fields


class CaseDocumentSummarySerializer(serializers.ModelSerializer):
    """Liste légère des documents d'un dossier (détail dossier / onboarding)."""

    original_filename = serializers.SerializerMethodField()

    class Meta:
        model = Document
        fields = (
            "id",
            "title",
            "category",
            "donor",
            "beneficiary",
            "guardian",
            "mandate",
            "identity_kind",
            "original_filename",
            "created_at",
        )
        read_only_fields = fields

    def get_original_filename(self, obj: Document) -> str | None:
        version = obj.current_version
        return version.original_filename if version else None


class DocumentSerializer(serializers.ModelSerializer):
    tags = DocumentTagSerializer(many=True, read_only=True)
    current_version = DocumentVersionSerializer(read_only=True)
    uploaded_by_username = serializers.CharField(
        source="uploaded_by.username",
        read_only=True,
    )

    class Meta:
        model = Document
        fields = (
            "id",
            "case",
            "donor",
            "beneficiary",
            "guardian",
            "mandate",
            "identity_kind",
            "category",
            "title",
            "description",
            "is_confidential",
            "uploaded_by",
            "uploaded_by_username",
            "tags",
            "current_version",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields


class DocumentUploadSerializer(serializers.Serializer):
    case_id = serializers.IntegerField()
    category = serializers.ChoiceField(
        choices=DocumentCategory.choices,
        required=False,
        default=DocumentCategory.OTHER,
    )
    title = serializers.CharField(max_length=255, required=False, allow_blank=True)
    description = serializers.CharField(required=False, allow_blank=True, default="")
    is_confidential = serializers.BooleanField(required=False, default=True)
    file = serializers.FileField()
    donor_id = serializers.IntegerField(required=False)
    identity_kind = serializers.ChoiceField(
        choices=DonorIdentityKind.choices,
        required=False,
    )
    donor_first_name = serializers.CharField(
        max_length=128,
        required=False,
        allow_blank=True,
    )
    donor_last_name = serializers.CharField(
        max_length=128,
        required=False,
        allow_blank=True,
    )
    beneficiary_id = serializers.IntegerField(required=False)
    beneficiary_first_name = serializers.CharField(
        max_length=128,
        required=False,
        allow_blank=True,
    )
    beneficiary_last_name = serializers.CharField(
        max_length=128,
        required=False,
        allow_blank=True,
    )
    guardian_id = serializers.IntegerField(required=False)
    guardian_first_name = serializers.CharField(
        max_length=128,
        required=False,
        allow_blank=True,
    )
    guardian_last_name = serializers.CharField(
        max_length=128,
        required=False,
        allow_blank=True,
    )
    mandate_id = serializers.IntegerField(required=False)
    mandate_type = serializers.CharField(max_length=32, required=False, allow_blank=True)
    mandate_title = serializers.CharField(max_length=255, required=False, allow_blank=True)
    mandate_reference_number = serializers.CharField(
        max_length=128,
        required=False,
        allow_blank=True,
    )
    tag_slugs = serializers.ListField(
        child=serializers.SlugField(),
        required=False,
        allow_empty=True,
    )

    def validate(self, attrs):
        if attrs.get("mandate_id") or (attrs.get("mandate_title") or "").strip():
            return self._validate_mandate_document(attrs)

        identity_kind = attrs.get("identity_kind")
        if not identity_kind:
            if not (attrs.get("title") or "").strip():
                raise serializers.ValidationError(
                    {"title": "Le titre est obligatoire si identity_kind n'est pas fourni."}
                )
            return attrs

        uploaded = attrs.get("file")
        if uploaded:
            name = (getattr(uploaded, "name", "") or "").lower()
            content_type = (getattr(uploaded, "content_type", "") or "").lower()
            if not name.endswith(".pdf") and content_type not in (
                "application/pdf",
                "application/x-pdf",
            ):
                raise serializers.ValidationError(
                    {"file": "Les pièces d'identité doivent être au format PDF."}
                )

        subjects = []
        if attrs.get("donor_id") or (attrs.get("donor_first_name") or "").strip():
            subjects.append("donor")
        if attrs.get("beneficiary_id") or (attrs.get("beneficiary_first_name") or "").strip():
            subjects.append("beneficiary")
        if attrs.get("guardian_id") or (attrs.get("guardian_first_name") or "").strip():
            subjects.append("guardian")
        if len(subjects) > 1:
            raise serializers.ValidationError(
                "Indiquez une seule personne (donateur, bénéficiaire ou tuteur) par pièce."
            )

        case_id = attrs["case_id"]

        if subjects == ["beneficiary"]:
            return self._validate_beneficiary_identity(attrs, identity_kind, case_id)

        if subjects == ["guardian"]:
            return self._validate_guardian_identity(attrs, identity_kind, case_id)

        return self._validate_donor_identity(attrs, identity_kind, case_id)

    def _validate_donor_identity(self, attrs, identity_kind, case_id):
        donor = None
        donor_id = attrs.get("donor_id")
        if donor_id:
            try:
                donor = CaseDonor.objects.get(pk=donor_id, case_id=case_id)
            except CaseDonor.DoesNotExist as exc:
                raise serializers.ValidationError(
                    {"donor_id": "Donateur introuvable pour ce dossier."}
                ) from exc
            first_name = donor.first_name
            last_name = donor.last_name
        else:
            first_name = (attrs.get("donor_first_name") or "").strip()
            last_name = (attrs.get("donor_last_name") or "").strip()
            if not first_name or not last_name:
                raise serializers.ValidationError(
                    {
                        "donor_first_name": (
                            "Prénom et nom du donateur requis pour nommer la pièce "
                            "(ou indiquez donor_id)."
                        )
                    }
                )

        from documents.naming import build_donor_identity_title

        attrs["title"] = build_donor_identity_title(identity_kind, first_name, last_name)
        attrs["_donor"] = donor
        attrs["_beneficiary"] = None
        attrs["_guardian"] = None
        attrs["_donor_first_name"] = first_name
        attrs["_donor_last_name"] = last_name
        attrs["_identity_subject"] = "donor"
        if not attrs.get("category"):
            attrs["category"] = DocumentCategory.IDENTITY
        return attrs

    def _validate_beneficiary_identity(self, attrs, identity_kind, case_id):
        beneficiary = None
        beneficiary_id = attrs.get("beneficiary_id")
        if beneficiary_id:
            try:
                beneficiary = Beneficiary.objects.get(pk=beneficiary_id, case_id=case_id)
            except Beneficiary.DoesNotExist as exc:
                raise serializers.ValidationError(
                    {"beneficiary_id": "Bénéficiaire introuvable pour ce dossier."}
                ) from exc
            first_name = beneficiary.first_name
            last_name = beneficiary.last_name
        else:
            first_name = (attrs.get("beneficiary_first_name") or "").strip()
            last_name = (attrs.get("beneficiary_last_name") or "").strip()
            if not first_name or not last_name:
                raise serializers.ValidationError(
                    {
                        "beneficiary_first_name": (
                            "Prénom et nom du bénéficiaire requis pour nommer la pièce "
                            "(ou indiquez beneficiary_id)."
                        )
                    }
                )

        from documents.naming import build_beneficiary_identity_title

        attrs["title"] = build_beneficiary_identity_title(
            identity_kind, first_name, last_name
        )
        attrs["_donor"] = None
        attrs["_beneficiary"] = beneficiary
        attrs["_guardian"] = None
        attrs["_donor_first_name"] = first_name
        attrs["_donor_last_name"] = last_name
        attrs["_identity_subject"] = "beneficiary"
        if not attrs.get("category"):
            attrs["category"] = DocumentCategory.IDENTITY
        return attrs

    def _validate_guardian_identity(self, attrs, identity_kind, case_id):
        guardian = None
        guardian_id = attrs.get("guardian_id")
        if guardian_id:
            try:
                guardian = Guardian.objects.get(pk=guardian_id, case_id=case_id)
            except Guardian.DoesNotExist as exc:
                raise serializers.ValidationError(
                    {"guardian_id": "Tuteur introuvable pour ce dossier."}
                ) from exc
            first_name = guardian.first_name
            last_name = guardian.last_name
        else:
            first_name = (attrs.get("guardian_first_name") or "").strip()
            last_name = (attrs.get("guardian_last_name") or "").strip()
            if not first_name or not last_name:
                raise serializers.ValidationError(
                    {
                        "guardian_first_name": (
                            "Prénom et nom du tuteur requis pour nommer la pièce "
                            "(ou indiquez guardian_id)."
                        )
                    }
                )

        from documents.naming import build_guardian_identity_title

        attrs["title"] = build_guardian_identity_title(identity_kind, first_name, last_name)
        attrs["_donor"] = None
        attrs["_beneficiary"] = None
        attrs["_guardian"] = guardian
        attrs["_donor_first_name"] = first_name
        attrs["_donor_last_name"] = last_name
        attrs["_identity_subject"] = "guardian"
        if not attrs.get("category"):
            attrs["category"] = DocumentCategory.IDENTITY
        return attrs

    def _validate_mandate_document(self, attrs):
        uploaded = attrs.get("file")
        if uploaded:
            name = (getattr(uploaded, "name", "") or "").lower()
            content_type = (getattr(uploaded, "content_type", "") or "").lower()
            if not name.endswith(".pdf") and content_type not in (
                "application/pdf",
                "application/x-pdf",
            ):
                raise serializers.ValidationError(
                    {"file": "Les actes de mandat doivent être au format PDF."}
                )

        case_id = attrs["case_id"]
        mandate = None
        mandate_id = attrs.get("mandate_id")
        if mandate_id:
            try:
                mandate = Mandate.objects.get(pk=mandate_id, case_id=case_id)
            except Mandate.DoesNotExist as exc:
                raise serializers.ValidationError(
                    {"mandate_id": "Mandat introuvable pour ce dossier."}
                ) from exc
            mandate_type = mandate.mandate_type
            mandate_title = mandate.title
            reference_number = mandate.reference_number
        else:
            mandate_type = (attrs.get("mandate_type") or "").strip()
            mandate_title = (attrs.get("mandate_title") or "").strip()
            reference_number = (attrs.get("mandate_reference_number") or "").strip()
            if not mandate_title:
                raise serializers.ValidationError(
                    {
                        "mandate_title": (
                            "Intitulé du mandat requis pour nommer le fichier "
                            "(ou indiquez mandate_id)."
                        )
                    }
                )
            if not mandate_type:
                mandate_type = "OTHER"

        from documents.naming import build_mandate_document_title

        attrs["title"] = build_mandate_document_title(
            mandate_type, mandate_title, reference_number
        )
        attrs["category"] = DocumentCategory.MANDATE
        attrs["_mandate"] = mandate
        attrs["_mandate_type"] = mandate_type
        attrs["_mandate_title"] = mandate_title
        attrs["_mandate_reference_number"] = reference_number
        attrs["_document_kind"] = "mandate"
        return attrs


class DocumentShareSerializer(serializers.Serializer):
    shared_with_user_id = serializers.IntegerField(required=False)
    shared_with_email = serializers.EmailField(required=False, allow_blank=True)
    message = serializers.CharField(required=False, allow_blank=True, default="")

    def validate(self, attrs):
        user_id = attrs.get("shared_with_user_id")
        email = attrs.get("shared_with_email", "").strip()
        if not user_id and not email:
            raise serializers.ValidationError(
                "Indiquez shared_with_user_id ou shared_with_email."
            )
        return attrs


class DownloadUrlResponseSerializer(serializers.Serializer):
    url = serializers.URLField()
    expires_in = serializers.IntegerField()
    version_id = serializers.IntegerField()
    original_filename = serializers.CharField()
