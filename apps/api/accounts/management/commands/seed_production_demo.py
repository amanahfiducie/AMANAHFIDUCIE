"""Réinitialise la base (sauf amadyfsy@gmail.com) et charge un jeu de données
réaliste « comme en production » : équipe interne, dossiers, patrimoine,
investissements, comptabilité entreprise, validations et notifications.

Usage :
    python manage.py seed_production_demo
"""

from __future__ import annotations

import datetime as dt
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from accounts.models import RoleAssignment, UserProfile, UserRole
from assets.models import Asset, AssetType, AssetValuation, ValuationMethod
from beneficiaries.models import Beneficiary, CaseDonor, Guardian, RelationToDonorType
from cases.models import (
    CaseAssignment,
    CaseOrigin,
    CaseStakeholder,
    CaseStatus,
    CaseTimelineEvent,
    CaseType,
    FiduciaryCase,
    StakeholderRole,
    TimelineEventType,
)
from cases.services import generate_case_reference
from finance.models import (
    EnterpriseAccount,
    EnterpriseAccountType,
    EnterpriseMovement,
    FiduciaryAccount,
    FinancialMovement,
    MovementCategory,
    MovementStatus,
    MovementType,
)
from investments.models import (
    CaseInvestmentPolicy,
    EnvelopeContribution,
    Investment,
    InvestmentAssetClass,
    InvestmentValuation,
)
from investments.services import ensure_case_investment_policy
from notifications.models import Notification, NotificationType
from validations.models import (
    ValidationRequest,
    ValidationStep,
    ValidationSubjectType,
    ValidationType,
)

KEEP_EMAIL = "amadyfsy@gmail.com"
DEMO_PASSWORD = "Amanah#2026"

D = Decimal
TODAY = dt.date(2026, 7, 17)


def aware(date: dt.date, hour: int = 10) -> dt.datetime:
    return timezone.make_aware(dt.datetime(date.year, date.month, date.day, hour, 0))


def backdate(instance, date: dt.date, hour: int = 10, fields=("created_at",)) -> None:
    """Force les horodatages auto_now_add après création."""
    updates = {f: aware(date, hour) for f in fields}
    type(instance).objects.filter(pk=instance.pk).update(**updates)


class Command(BaseCommand):
    help = "Purge toutes les données (sauf amadyfsy@gmail.com) puis charge un jeu de démo production."

    @transaction.atomic
    def handle(self, *args, **options):
        User = get_user_model()
        keeper = User.objects.filter(email=KEEP_EMAIL).first()
        if keeper is None:
            self.stderr.write(f"Utilisateur {KEEP_EMAIL} introuvable — abandon.")
            return

        self._purge(keeper)
        users = self._seed_users(keeper)
        cases = self._seed_cases(users)
        self._seed_investments(cases, users)
        self._seed_case_finance(cases, users)
        self._seed_enterprise_finance(users)
        self._seed_validations(cases, users)
        self._seed_notifications(keeper, cases)

        self.stdout.write(self.style.SUCCESS("Base réinitialisée et données de démo chargées."))
        self.stdout.write(f"Compte conservé : {KEEP_EMAIL} (mot de passe inchangé)")
        self.stdout.write(f"Comptes internes créés — mot de passe commun : {DEMO_PASSWORD}")

    # ------------------------------------------------------------------ purge

    def _purge(self, keeper) -> None:
        from auditlog.models import AuditLog
        from django.contrib.admin.models import LogEntry
        from django.contrib.sessions.models import Session
        from documents.models import (
            Document,
            DocumentAccessLog,
            DocumentShare,
            DocumentTag,
            DocumentVersion,
        )
        from faraid.models import (
            FaraidCommitteeReview,
            FaraidHeir,
            FaraidHeirDecision,
            FaraidSettlementAction,
        )
        from finance.models import EnterpriseJustificatif, Fee, Reconciliation
        from mandates.models import Mandate, MandateValidation
        from reports.models import Report, ReportApproval, ReportGenerationJob, ReportTemplate
        from validations.models import ValidationComment, ValidationDecision
        from waqf.models import WaqfProfile
        from zakat.models import ZakatAssessment
        from accounts.models import (
            ExternalPartyProfile,
            LoginOtpChallenge,
            ProfileUserAccessRequest,
        )
        from assets.models import AssetEvent, AssetIncome, AssetRisk
        from beneficiaries.models import DonorTrustedPerson, FamilyRelation
        from cases.models import CaseNote, CaseObservation
        from investments.models import InvestmentParticipant
        from notifications.models import NotificationPreference

        ordered = [
            LogEntry,
            Session,
            AuditLog,
            Notification,
            NotificationPreference,
            ValidationDecision,
            ValidationComment,
            ValidationStep,
            ValidationRequest,
            InvestmentValuation,
            InvestmentParticipant,
            Investment,
            EnvelopeContribution,
            CaseInvestmentPolicy,
            EnterpriseJustificatif,
            EnterpriseMovement,
            EnterpriseAccount,
            Reconciliation,
            Fee,
            FinancialMovement,
            FiduciaryAccount,
            ReportApproval,
            ReportGenerationJob,
            Report,
            ReportTemplate,
            FaraidSettlementAction,
            FaraidHeirDecision,
            FaraidCommitteeReview,
            FaraidHeir,
            ZakatAssessment,
            WaqfProfile,
            DocumentShare,
            DocumentAccessLog,
            DocumentVersion,
            Document,
            DocumentTag,
            AssetIncome,
            AssetEvent,
            AssetRisk,
            AssetValuation,
            Asset,
            MandateValidation,
            Mandate,
            FamilyRelation,
            Beneficiary,
            Guardian,
            DonorTrustedPerson,
            CaseDonor,
            CaseObservation,
            CaseNote,
            CaseTimelineEvent,
            CaseAssignment,
            CaseStakeholder,
            FiduciaryCase,
            ExternalPartyProfile,
            ProfileUserAccessRequest,
            LoginOtpChallenge,
        ]
        for model in ordered:
            model.objects.all().delete()

        RoleAssignment.objects.exclude(user=keeper).delete()
        UserProfile.objects.exclude(user=keeper).delete()
        get_user_model().objects.exclude(pk=keeper.pk).delete()
        self.stdout.write("Purge terminée.")

    # ------------------------------------------------------------------ users

    def _seed_users(self, keeper) -> dict:
        User = get_user_model()

        keeper.is_active = True
        keeper.is_staff = True
        keeper.is_superuser = True
        keeper.first_name = keeper.first_name or "Amady Farba"
        keeper.last_name = keeper.last_name or "Sy"
        keeper.save()
        RoleAssignment.objects.get_or_create(user=keeper, role=UserRole.SUPER_ADMIN)
        UserProfile.objects.get_or_create(
            user=keeper, defaults={"display_name": "Amady Farba Sy", "phone": "+221 77 123 45 67"}
        )

        spec = [
            ("direction", "Mariama", "Bâ", "mariama.ba@amanah-fiducie.sn", UserRole.DIRECTION, "+221 77 640 12 08"),
            ("agent", "Ousmane", "Diallo", "ousmane.diallo@amanah-fiducie.sn", UserRole.AGENT_FIDUCIAIRE, "+221 78 552 09 41"),
            ("agent2", "Aïssatou", "Ndoye", "aissatou.ndoye@amanah-fiducie.sn", UserRole.AGENT_FIDUCIAIRE, "+221 77 214 66 30"),
            ("juriste", "Fatou", "Ndiaye", "fatou.ndiaye@amanah-fiducie.sn", UserRole.JURIDIQUE_CONFORMITE, "+221 76 981 44 12"),
            ("comptable", "Ibrahima", "Sarr", "ibrahima.sarr@amanah-fiducie.sn", UserRole.COMPTABLE_FIDUCIAIRE, "+221 77 305 58 27"),
            ("charia", "Moustapha", "Guèye", "moustapha.gueye@amanah-fiducie.sn", UserRole.COMITE_CHARAIQUE, "+221 78 119 73 55"),
            ("auditeur", "Awa", "Cissé", "awa.cisse@amanah-fiducie.sn", UserRole.AUDITEUR, "+221 76 447 21 90"),
            ("juge", "Abdoulaye", "Sow", "abdoulaye.sow@justice.sn", UserRole.JUGE, "+221 77 802 15 63"),
            ("notaire", "Khadidiatou", "Diop", "etude.diop@notaires.sn", UserRole.NOTAIRE, "+221 78 664 30 18"),
            ("famille", "Rokhaya", "Ndiaye", "rokhaya.ndiaye@gmail.com", UserRole.FAMILLE_TUTEUR, "+221 77 590 26 84"),
        ]
        users = {"keeper": keeper}
        for key, first, last, email, role, phone in spec:
            username = email.split("@")[0].replace(".", "_")
            user = User.objects.create_user(
                username=username,
                email=email,
                password=DEMO_PASSWORD,
                first_name=first,
                last_name=last,
            )
            RoleAssignment.objects.get_or_create(user=user, role=role)
            UserProfile.objects.update_or_create(
                user=user,
                defaults={"display_name": f"{first} {last}", "phone": phone},
            )
            users[key] = user
        self.stdout.write(f"{len(spec) + 1} comptes utilisateurs prêts.")
        return users

    # ------------------------------------------------------------------ cases

    def _create_case(
        self,
        *,
        title: str,
        case_type: str,
        status: str,
        origin: str,
        created_by,
        assigned_to,
        created_on: dt.date,
        description: str,
    ) -> FiduciaryCase:
        case = FiduciaryCase.objects.create(
            reference=generate_case_reference(),
            title=title,
            case_type=case_type,
            status=status,
            case_origin=origin,
            description=description,
            created_by=created_by,
            assigned_to=assigned_to,
            onboarding_step="done",
            onboarding_completed_at=aware(created_on, 16),
        )
        backdate(case, created_on, fields=("created_at", "updated_at"))
        CaseAssignment.objects.create(
            case=case,
            user=assigned_to,
            assigned_by=created_by,
            started_at=aware(created_on, 11),
        )
        CaseStakeholder.objects.get_or_create(
            case=case, user=assigned_to, role=StakeholderRole.FIDUCIARY_AGENT
        )
        ev = CaseTimelineEvent.objects.create(
            case=case,
            event_type=TimelineEventType.CREATED,
            actor=created_by,
            message=f"Ouverture du dossier « {title} ».",
        )
        backdate(ev, created_on)
        if status != CaseStatus.DRAFT:
            ev2 = CaseTimelineEvent.objects.create(
                case=case,
                event_type=TimelineEventType.STATUS_CHANGED,
                actor=created_by,
                message=f"Statut du dossier : {CaseStatus(status).label}.",
                metadata_json={"to": status},
            )
            backdate(ev2, created_on + dt.timedelta(days=6))
        return case

    def _seed_cases(self, users) -> dict:
        agent = users["agent"]
        agent2 = users["agent2"]
        keeper = users["keeper"]

        cases = {}

        # 1 — Tutelle Ndiaye (ACTIVE, le dossier vitrine)
        c1 = self._create_case(
            title="Tutelle et cantonnement — mineurs Ndiaye",
            case_type=CaseType.TUTELLE_CANTONNEMENT,
            status=CaseStatus.ACTIVE,
            origin=CaseOrigin.COURT,
            created_by=agent,
            assigned_to=agent,
            created_on=dt.date(2025, 9, 10),
            description=(
                "Cantonnement du patrimoine des trois enfants mineurs de feu Mamadou Ndiaye, "
                "ordonné par le Tribunal de grande instance hors classe de Dakar "
                "(ordonnance n°2025-1147). Gestion sous mandat AMANAH Protection."
            ),
        )
        CaseStakeholder.objects.get_or_create(case=c1, user=users["juge"], role=StakeholderRole.JUDGE)
        CaseStakeholder.objects.get_or_create(case=c1, user=users["famille"], role=StakeholderRole.GUARDIAN)
        donor1 = CaseDonor.objects.create(
            case=c1,
            first_name="Mamadou",
            last_name="Ndiaye",
            date_of_birth=dt.date(1968, 3, 14),
            nationality="Sénégalaise",
            identification_number="1 682 1968 00314",
            address="Cité Keur Gorgui, Villa 27, Dakar",
            notes="Défunt père des mineurs — patrimoine placé sous cantonnement judiciaire.",
        )
        guardian1 = Guardian.objects.create(
            case=c1,
            user=users["famille"],
            first_name="Rokhaya",
            last_name="Ndiaye",
            email="rokhaya.ndiaye@gmail.com",
            phone="+221 77 590 26 84",
            relationship_label="Mère et tutrice légale",
        )
        for first, birth, share in (
            ("Serigne", dt.date(2012, 5, 4), D("40")),
            ("Mame Diarra", dt.date(2015, 1, 22), D("30")),
            ("Cheikh", dt.date(2018, 9, 30), D("30")),
        ):
            Beneficiary.objects.create(
                case=c1,
                donor=donor1,
                relation_to_donor=RelationToDonorType.CHILD,
                first_name=first,
                last_name="Ndiaye",
                date_of_birth=birth,
                nationality="Sénégalaise",
                is_minor=True,
                guardian=guardian1,
                patrimony_share_percent=share,
            )
        self._asset_with_valuations(
            c1, agent, AssetType.REAL_ESTATE,
            "Villa familiale — Almadies", "Route des Almadies, lot 14, Dakar",
            [(dt.date(2025, 9, 20), D("180000000")), (dt.date(2026, 3, 15), D("186000000"))],
        )
        self._asset_with_valuations(
            c1, agent, AssetType.BANK_ACCOUNT,
            "Compte d'attente BIS — succession Ndiaye", "Banque Islamique du Sénégal",
            [(dt.date(2025, 9, 20), D("45000000"))],
        )
        cases["tutelle_ndiaye"] = c1

        # 2 — Succession Diop (ACTIVE)
        c2 = self._create_case(
            title="Succession El Hadj Ibrahima Diop",
            case_type=CaseType.SUCCESSION,
            status=CaseStatus.ACTIVE,
            origin=CaseOrigin.NOTARY,
            created_by=agent2,
            assigned_to=agent2,
            created_on=dt.date(2025, 11, 20),
            description=(
                "Conseil successoral et gestion transitoire du patrimoine de feu El Hadj Ibrahima Diop, "
                "transmis par l'étude Diop & Associés. Partage farāʾiḍ validé par le comité charaïque."
            ),
        )
        CaseStakeholder.objects.get_or_create(case=c2, user=users["notaire"], role=StakeholderRole.NOTARY)
        donor2 = CaseDonor.objects.create(
            case=c2,
            first_name="El Hadj Ibrahima",
            last_name="Diop",
            date_of_birth=dt.date(1949, 11, 2),
            nationality="Sénégalaise",
            address="Sacré-Cœur 3, Villa 9540, Dakar",
            notes="De cujus — décédé le 12 octobre 2025.",
        )
        heirs = (
            ("Sokhna", "F", RelationToDonorType.SPOUSE, dt.date(1958, 6, 17), D("12.5")),
            ("Moussa", "M", RelationToDonorType.CHILD, dt.date(1980, 2, 9), D("29.17")),
            ("Pape", "M", RelationToDonorType.CHILD, dt.date(1984, 7, 25), D("29.17")),
            ("Ndèye Astou", "F", RelationToDonorType.CHILD, dt.date(1987, 12, 3), D("14.58")),
            ("Yacine", "F", RelationToDonorType.CHILD, dt.date(1991, 4, 18), D("14.58")),
        )
        for first, gender, rel, birth, share in heirs:
            Beneficiary.objects.create(
                case=c2,
                donor=donor2,
                relation_to_donor=rel,
                gender=gender,
                first_name=first,
                last_name="Diop",
                date_of_birth=birth,
                nationality="Sénégalaise",
                patrimony_share_percent=share,
            )
        self._asset_with_valuations(
            c2, agent2, AssetType.LAND,
            "Terrain 600 m² — Diamniadio pôle urbain", "Diamniadio, zone 12",
            [(dt.date(2025, 12, 1), D("48000000")), (dt.date(2026, 6, 1), D("52000000"))],
        )
        self._asset_with_valuations(
            c2, agent2, AssetType.REAL_ESTATE,
            "Immeuble R+3 — Sacré-Cœur", "Sacré-Cœur 3, Dakar",
            [(dt.date(2025, 12, 1), D("240000000")), (dt.date(2026, 5, 10), D("247000000"))],
        )
        cases["succession_diop"] = c2

        # 3 — Mandat Kane (ACTIVE)
        c3 = self._create_case(
            title="Mandat fiduciaire — famille Kane",
            case_type=CaseType.MANDAT_FIDUCIAIRE,
            status=CaseStatus.ACTIVE,
            origin=CaseOrigin.FAMILY_REQUEST,
            created_by=agent,
            assigned_to=agent,
            created_on=dt.date(2026, 1, 8),
            description=(
                "Mandat de gestion patrimoniale long terme confié par Cheikh Kane au profit "
                "de ses deux enfants. Profil AMANAH Croissance, revue annuelle."
            ),
        )
        donor3 = CaseDonor.objects.create(
            case=c3,
            first_name="Cheikh",
            last_name="Kane",
            date_of_birth=dt.date(1972, 8, 30),
            nationality="Sénégalaise",
            email="cheikh.kane@outlook.com",
            phone="+221 77 456 88 02",
            address="Point E, rue de Kaolack, Dakar",
        )
        for first, birth, share in (("Mouhamed", dt.date(2004, 3, 11), D("50")), ("Adja", dt.date(2007, 10, 5), D("50"))):
            Beneficiary.objects.create(
                case=c3,
                donor=donor3,
                relation_to_donor=RelationToDonorType.CHILD,
                first_name=first,
                last_name="Kane",
                date_of_birth=birth,
                nationality="Sénégalaise",
                patrimony_share_percent=share,
            )
        cases["mandat_kane"] = c3

        # 4 — Waqf Sy (UNDER_REVIEW)
        c4 = self._create_case(
            title="Waqf familial Sy — immeuble Médina",
            case_type=CaseType.WAQF,
            status=CaseStatus.UNDER_REVIEW,
            origin=CaseOrigin.FAMILY_REQUEST,
            created_by=agent2,
            assigned_to=agent2,
            created_on=dt.date(2026, 5, 14),
            description=(
                "Constitution d'un waqf familial sur un immeuble de rapport à la Médina "
                "(rue 11 x 20). Revenus locatifs affectés à 60 % à la famille et 40 % à "
                "des œuvres caritatives. En attente d'avis du comité charaïque."
            ),
        )
        CaseDonor.objects.create(
            case=c4,
            first_name="Ababacar",
            last_name="Sy",
            date_of_birth=dt.date(1960, 1, 25),
            nationality="Sénégalaise",
            phone="+221 78 233 47 91",
            address="Médina, rue 11 x 20, Dakar",
        )
        self._asset_with_valuations(
            c4, agent2, AssetType.WAQF_ASSET,
            "Immeuble de rapport — Médina rue 11 x 20", "Médina, Dakar",
            [(dt.date(2026, 5, 20), D("95000000"))],
        )
        cases["waqf_sy"] = c4

        # 5 — Zakat & faraid Bâ (LEGAL_REVIEW)
        c5 = self._create_case(
            title="Zakat & farāʾiḍ — patrimoine Bâ",
            case_type=CaseType.ZAKAT_FARAID,
            status=CaseStatus.LEGAL_REVIEW,
            origin=CaseOrigin.DIRECT_CONTACT,
            created_by=agent,
            assigned_to=agent,
            created_on=dt.date(2026, 6, 2),
            description=(
                "Calcul de la zakat annuelle et préparation du partage successoral anticipé "
                "du patrimoine de Thierno Bâ (commerces et cheptel à Louga). Dossier en revue juridique."
            ),
        )
        CaseDonor.objects.create(
            case=c5,
            first_name="Thierno",
            last_name="Bâ",
            date_of_birth=dt.date(1955, 4, 8),
            nationality="Sénégalaise",
            phone="+221 77 118 92 44",
            address="Quartier Grand Louga, Louga",
        )
        cases["zakat_ba"] = c5

        # 6 — Mandat Touré (DRAFT juin)
        c6 = self._create_case(
            title="Mandat fiduciaire — Bineta Touré",
            case_type=CaseType.MANDAT_FIDUCIAIRE,
            status=CaseStatus.DRAFT,
            origin=CaseOrigin.DIRECT_CONTACT,
            created_by=agent2,
            assigned_to=agent2,
            created_on=dt.date(2026, 6, 25),
            description="Projet de mandat de gestion pour Mme Bineta Touré (diaspora, Milan). Pièces d'identification en attente.",
        )
        cases["mandat_toure"] = c6

        # 7 — Tutelle Sall (DRAFT juillet)
        c7 = self._create_case(
            title="Tutelle — mineurs Sall (Thiès)",
            case_type=CaseType.TUTELLE_CANTONNEMENT,
            status=CaseStatus.DRAFT,
            origin=CaseOrigin.COURT,
            created_by=agent,
            assigned_to=agent,
            created_on=dt.date(2026, 7, 8),
            description="Saisine du tribunal de Thiès pour le cantonnement du patrimoine de deux mineurs. Ordonnance attendue.",
        )
        cases["tutelle_sall"] = c7

        # 8 — Mandat Diagne (UNDER_REVIEW, créé ce mois)
        c8 = self._create_case(
            title="Mandat fiduciaire — Serigne Diagne",
            case_type=CaseType.MANDAT_FIDUCIAIRE,
            status=CaseStatus.UNDER_REVIEW,
            origin=CaseOrigin.PARTNER,
            created_by=keeper,
            assigned_to=agent,
            created_on=dt.date(2026, 7, 15),
            description="Mandat proposé via Taysir Finance. Enveloppe initiale annoncée de 75 000 000 XOF. En attente d'approbation direction.",
        )
        cases["mandat_diagne"] = c8

        # 9 — Succession Fall (CLOSED)
        c9 = self._create_case(
            title="Succession Fatim Fall — clôturée",
            case_type=CaseType.SUCCESSION,
            status=CaseStatus.CLOSED,
            origin=CaseOrigin.NOTARY,
            created_by=agent2,
            assigned_to=agent2,
            created_on=dt.date(2025, 8, 5),
            description="Partage successoral achevé et fonds distribués aux héritiers le 27 février 2026.",
        )
        ev = CaseTimelineEvent.objects.create(
            case=c9,
            event_type=TimelineEventType.CLOSED,
            actor=users["direction"],
            message="Clôture du dossier après distribution intégrale des parts.",
        )
        backdate(ev, dt.date(2026, 2, 27))
        cases["succession_fall"] = c9

        self.stdout.write(f"{len(cases)} dossiers créés.")
        return cases

    def _asset_with_valuations(self, case, user, asset_type, label, location, valuations):
        asset = Asset.objects.create(
            case=case,
            asset_type=asset_type,
            label=label,
            location=location,
            created_by=user,
            valuation_next_due=TODAY + dt.timedelta(days=75),
        )
        for valued_at, value in valuations:
            AssetValuation.objects.create(
                asset=asset,
                value=value,
                valued_at=valued_at,
                method=ValuationMethod.EXPERT,
                created_by=user,
            )
        return asset

    # ------------------------------------------------------------ investments

    def _monthly_valuations(self, investment, series, user):
        """series: liste de (date, valeur). Met aussi à jour current_value."""
        for valued_at, value in series:
            v = InvestmentValuation.objects.create(
                investment=investment,
                value=value,
                valued_at=valued_at,
                created_by=user,
            )
            backdate(v, valued_at, hour=15)
        investment.current_value = series[-1][1]
        investment.save(update_fields=["current_value", "updated_at"])

    def _add_contribution(self, policy, amount, on, user, note=""):
        previous = policy.planned_investment_amount or D("0")
        new_total = previous + amount
        contrib = EnvelopeContribution.objects.create(
            policy=policy,
            amount=amount,
            previous_total=previous,
            new_total=new_total,
            notes=note,
            created_by=user,
        )
        backdate(contrib, on)
        policy.planned_investment_amount = new_total
        policy.save(update_fields=["planned_investment_amount", "updated_at"])

    def _seed_investments(self, cases, users):
        agent = users["agent"]
        direction = users["direction"]
        immobilier = InvestmentAssetClass.objects.get(slug="immobilier")
        sukuk = InvestmentAssetClass.objects.get(slug="sukuk")
        or_ = InvestmentAssetClass.objects.get(slug="or")
        liquidites = InvestmentAssetClass.objects.get(slug="liquidites")

        c1 = cases["tutelle_ndiaye"]
        c2 = cases["succession_diop"]
        c3 = cases["mandat_kane"]

        # Politiques + historiques d'enveloppe
        p1 = ensure_case_investment_policy(c1)
        p1.amanah_management_share_percent = D("3.00")
        p1.planned_investment_amount = D("0")
        p1.save()
        self._add_contribution(p1, D("100000000"), dt.date(2025, 10, 6), agent,
                               "Apport initial ordonné par le tribunal (liquidités succession).")
        self._add_contribution(p1, D("50000000"), dt.date(2026, 2, 12), direction,
                               "Produit de la vente du véhicule et parts sociales du défunt.")

        p2 = ensure_case_investment_policy(c2)
        p2.amanah_management_share_percent = D("2.50")
        p2.planned_investment_amount = D("0")
        p2.save()
        self._add_contribution(p2, D("200000000"), dt.date(2025, 12, 15), agent,
                               "Liquidités successorales confiées après inventaire notarié.")

        p3 = ensure_case_investment_policy(c3)
        p3.amanah_management_share_percent = D("3.00")
        p3.planned_investment_amount = D("0")
        p3.save()
        self._add_contribution(p3, D("80000000"), dt.date(2026, 1, 20), agent,
                               "Versement initial du mandant.")
        self._add_contribution(p3, D("40000000"), dt.date(2026, 5, 5), agent,
                               "Versement complémentaire (prime annuelle du mandant).")

        # Enveloppe 1 — programme immobilier, partiellement allouée
        env_immo = Investment.objects.create(
            asset_class=immobilier,
            label="Programme immobilier locatif Dakar 2025",
            reference="PIGFI-IMM-2025-01",
            amount_invested=D("150000000"),
            current_value=D("150000000"),
            start_date=dt.date(2025, 11, 3),
            status=Investment.Status.ACTIVE,
            annual_yield_percent=D("8.50"),
            sharia_compliance_score=D("96"),
            notes="Acquisition de deux immeubles locatifs (Ouest-Foire et Sacré-Cœur) mutualisés entre dossiers.",
            created_by=agent,
        )
        self._monthly_valuations(env_immo, [
            (dt.date(2025, 11, 30), D("150000000")),
            (dt.date(2025, 12, 31), D("151200000")),
            (dt.date(2026, 1, 31), D("152500000")),
            (dt.date(2026, 2, 28), D("151800000")),
            (dt.date(2026, 3, 31), D("154300000")),
            (dt.date(2026, 4, 30), D("155900000")),
            (dt.date(2026, 5, 31), D("157200000")),
            (dt.date(2026, 6, 30), D("158600000")),
        ], agent)

        alloc_c1_immo = Investment.objects.create(
            case=c1,
            parent=env_immo,
            asset_class=immobilier,
            label="Immeuble locatif Ouest-Foire — part Ndiaye",
            reference="PIGFI-IMM-2025-01/A",
            amount_invested=D("60000000"),
            current_value=D("60000000"),
            start_date=dt.date(2025, 11, 3),
            status=Investment.Status.ACTIVE,
            annual_yield_percent=D("8.50"),
            distributed_income=D("2700000"),
            created_by=agent,
        )
        self._monthly_valuations(alloc_c1_immo, [
            (dt.date(2025, 11, 30), D("60000000")),
            (dt.date(2025, 12, 31), D("60480000")),
            (dt.date(2026, 1, 31), D("61000000")),
            (dt.date(2026, 2, 28), D("60720000")),
            (dt.date(2026, 3, 31), D("61720000")),
            (dt.date(2026, 4, 30), D("62360000")),
            (dt.date(2026, 5, 31), D("62880000")),
            (dt.date(2026, 6, 30), D("63440000")),
        ], agent)

        alloc_c2_immo = Investment.objects.create(
            case=c2,
            parent=env_immo,
            asset_class=immobilier,
            label="Immeuble Sacré-Cœur — part succession Diop",
            reference="PIGFI-IMM-2025-01/B",
            amount_invested=D("80000000"),
            current_value=D("80000000"),
            start_date=dt.date(2025, 12, 18),
            status=Investment.Status.ACTIVE,
            annual_yield_percent=D("8.50"),
            distributed_income=D("3200000"),
            created_by=agent,
        )
        self._monthly_valuations(alloc_c2_immo, [
            (dt.date(2025, 12, 31), D("80000000")),
            (dt.date(2026, 1, 31), D("80640000")),
            (dt.date(2026, 2, 28), D("80280000")),
            (dt.date(2026, 3, 31), D("81600000")),
            (dt.date(2026, 4, 30), D("82440000")),
            (dt.date(2026, 5, 31), D("83140000")),
            (dt.date(2026, 6, 30), D("83880000")),
        ], agent)

        # Enveloppe 2 — sukuk souverains, partiellement allouée
        env_sukuk = Investment.objects.create(
            asset_class=sukuk,
            label="Sukuk État du Sénégal 6,25 % 2031",
            reference="PIGFI-SUK-2026-01",
            amount_invested=D("100000000"),
            current_value=D("100000000"),
            start_date=dt.date(2026, 1, 15),
            maturity_date=dt.date(2031, 1, 15),
            status=Investment.Status.ACTIVE,
            annual_yield_percent=D("6.25"),
            sharia_compliance_score=D("100"),
            notes="Souscription primaire via la Banque Islamique du Sénégal.",
            created_by=agent,
        )
        self._monthly_valuations(env_sukuk, [
            (dt.date(2026, 1, 31), D("100000000")),
            (dt.date(2026, 2, 28), D("100520000")),
            (dt.date(2026, 3, 31), D("101040000")),
            (dt.date(2026, 4, 30), D("101560000")),
            (dt.date(2026, 5, 31), D("102080000")),
            (dt.date(2026, 6, 30), D("102600000")),
        ], agent)

        alloc_c1_sukuk = Investment.objects.create(
            case=c1,
            parent=env_sukuk,
            asset_class=sukuk,
            label="Sukuk État du Sénégal — part Ndiaye",
            reference="PIGFI-SUK-2026-01/A",
            amount_invested=D("40000000"),
            current_value=D("40000000"),
            start_date=dt.date(2026, 1, 15),
            maturity_date=dt.date(2031, 1, 15),
            status=Investment.Status.ACTIVE,
            annual_yield_percent=D("6.25"),
            distributed_income=D("1250000"),
            created_by=agent,
        )
        self._monthly_valuations(alloc_c1_sukuk, [
            (dt.date(2026, 1, 31), D("40000000")),
            (dt.date(2026, 2, 28), D("40208000")),
            (dt.date(2026, 3, 31), D("40416000")),
            (dt.date(2026, 4, 30), D("40624000")),
            (dt.date(2026, 5, 31), D("40832000")),
            (dt.date(2026, 6, 30), D("41040000")),
        ], agent)

        alloc_c3_sukuk = Investment.objects.create(
            case=c3,
            parent=env_sukuk,
            asset_class=sukuk,
            label="Sukuk État du Sénégal — part Kane",
            reference="PIGFI-SUK-2026-01/B",
            amount_invested=D("35000000"),
            current_value=D("35000000"),
            start_date=dt.date(2026, 2, 2),
            maturity_date=dt.date(2031, 1, 15),
            status=Investment.Status.ACTIVE,
            annual_yield_percent=D("6.25"),
            created_by=agent,
        )
        self._monthly_valuations(alloc_c3_sukuk, [
            (dt.date(2026, 2, 28), D("35000000")),
            (dt.date(2026, 3, 31), D("35182000")),
            (dt.date(2026, 4, 30), D("35364000")),
            (dt.date(2026, 5, 31), D("35546000")),
            (dt.date(2026, 6, 30), D("35728000")),
        ], agent)

        # Positions directes dossier
        inv_or = Investment.objects.create(
            case=c1,
            asset_class=or_,
            label="Or physique — coffre BIS (lingots 100 g)",
            reference="PIGFI-OR-2026-03",
            amount_invested=D("10000000"),
            current_value=D("10000000"),
            start_date=dt.date(2026, 3, 10),
            status=Investment.Status.ACTIVE,
            sharia_compliance_score=D("100"),
            created_by=agent,
        )
        self._monthly_valuations(inv_or, [
            (dt.date(2026, 3, 31), D("10120000")),
            (dt.date(2026, 4, 30), D("10310000")),
            (dt.date(2026, 5, 31), D("10190000")),
            (dt.date(2026, 6, 30), D("10560000")),
            (dt.date(2026, 7, 10), D("10780000")),
        ], agent)

        inv_liq = Investment.objects.create(
            case=c3,
            asset_class=liquidites,
            label="Dépôt Mourabaha 12 mois — Taysir Finance",
            reference="PIGFI-LIQ-2026-02",
            amount_invested=D("15000000"),
            current_value=D("15000000"),
            start_date=dt.date(2026, 2, 16),
            maturity_date=dt.date(2027, 2, 16),
            status=Investment.Status.ACTIVE,
            annual_yield_percent=D("4.10"),
            created_by=agent,
        )
        self._monthly_valuations(inv_liq, [
            (dt.date(2026, 3, 31), D("15076000")),
            (dt.date(2026, 4, 30), D("15128000")),
            (dt.date(2026, 5, 31), D("15180000")),
            (dt.date(2026, 6, 30), D("15232000")),
        ], agent)

        # Nouvel investissement en attente de validation
        Investment.objects.create(
            asset_class=immobilier,
            label="Résidence étudiante — Cité universitaire Bambey",
            reference="PIGFI-IMM-2026-02",
            amount_invested=D("85000000"),
            current_value=D("85000000"),
            start_date=dt.date(2026, 7, 6),
            status=Investment.Status.PENDING_VALIDATION,
            annual_yield_percent=D("9.20"),
            notes="Projet présenté par Gift Consulting — en attente de l'avis du comité charaïque.",
            created_by=users["direction"],
        )

        self.stdout.write("Investissements, enveloppes et estimations créés.")

    # --------------------------------------------------------- case finance

    def _seed_case_finance(self, cases, users):
        comptable = users["comptable"]
        c1 = cases["tutelle_ndiaye"]
        c2 = cases["succession_diop"]

        acc1 = FiduciaryAccount.objects.create(
            case=c1,
            name="Compte de cantonnement — BIS",
            account_number="SN012 01201 036000012345 78",
            opening_balance=D("45000000"),
            created_by=comptable,
        )
        loyers = MovementCategory.objects.filter(slug="autres-produits").first()
        for month in range(1, 8):
            FinancialMovement.objects.create(
                account=acc1,
                movement_type=MovementType.INCOME,
                category=loyers,
                amount=D("750000"),
                description=f"Loyers Ouest-Foire — {month:02d}/2026",
                reference=f"LOY-2026-{month:02d}",
                movement_date=dt.date(2026, month, 5),
                status=MovementStatus.APPROVED,
                created_by=comptable,
            )
        for month, label in ((1, "Frais de scolarité T2"), (4, "Frais de scolarité T3"), (6, "Frais médicaux mineurs")):
            FinancialMovement.objects.create(
                account=acc1,
                movement_type=MovementType.EXPENSE,
                amount=D("1200000") if "scolarité" in label else D("480000"),
                description=label,
                movement_date=dt.date(2026, month, 18),
                status=MovementStatus.APPROVED,
                created_by=comptable,
            )

        acc2 = FiduciaryAccount.objects.create(
            case=c2,
            name="Compte succession Diop — BIS",
            account_number="SN012 01201 036000098231 44",
            opening_balance=D("62000000"),
            created_by=comptable,
        )
        FinancialMovement.objects.create(
            account=acc2,
            movement_type=MovementType.INCOME,
            category=loyers,
            amount=D("1850000"),
            description="Loyers immeuble Sacré-Cœur — 06/2026",
            movement_date=dt.date(2026, 6, 8),
            status=MovementStatus.APPROVED,
            created_by=comptable,
        )
        FinancialMovement.objects.create(
            account=acc2,
            movement_type=MovementType.EXPENSE,
            amount=D("640000"),
            description="Travaux d'étanchéité toiture — immeuble Sacré-Cœur",
            movement_date=dt.date(2026, 7, 2),
            status=MovementStatus.PENDING_VALIDATION,
            created_by=comptable,
        )
        self.stdout.write("Comptes fiduciaires et mouvements dossiers créés.")

    # ---------------------------------------------------- enterprise finance

    def _seed_enterprise_finance(self, users):
        comptable = users["comptable"]
        cat = {c.slug: c for c in MovementCategory.objects.all()}

        bank = EnterpriseAccount.objects.create(
            name="BIS — Compte courant SOFIGEPAM",
            account_number="SN012 01201 036000045600 12",
            account_type=EnterpriseAccountType.BANK,
            opening_balance=D("25000000"),
            created_by=comptable,
        )
        EnterpriseAccount.objects.create(
            name="Caisse siège — Dakar",
            account_type=EnterpriseAccountType.CASH,
            opening_balance=D("500000"),
            created_by=comptable,
        )

        def mv(mtype, slug, amount, desc, date, status=MovementStatus.APPROVED):
            EnterpriseMovement.objects.create(
                account=bank,
                movement_type=mtype,
                category=cat.get(slug),
                amount=D(str(amount)),
                description=desc,
                reference=f"ENT-{date.strftime('%Y%m')}-{desc[:3].upper()}",
                movement_date=date,
                status=status,
                created_by=comptable,
            )

        # Recettes / dépenses mensuelles : oct. 2025 → juil. 2026
        months = [
            (2025, 10, 8200000, 2100000),
            (2025, 11, 9100000, 2600000),
            (2025, 12, 11800000, 3400000),
            (2026, 1, 9600000, 2900000),
            (2026, 2, 10400000, 3100000),
            (2026, 3, 8900000, 2400000),
            (2026, 4, 11600000, 3600000),
            (2026, 5, 10900000, 3300000),
            (2026, 6, 12400000, 3800000),
            (2026, 7, 6800000, 1900000),  # mois en cours partiel
        ]
        for year, month, fidu, conseil in months:
            mv(MovementType.INCOME, "recette-mandat-fiduciaire", fidu,
               f"Honoraires fiduciaires — {month:02d}/{year}", dt.date(year, month, 6))
            mv(MovementType.INCOME, "recette-succession", conseil,
               f"Honoraires de conseil — {month:02d}/{year}", dt.date(year, month, 14))
            mv(MovementType.EXPENSE, "depense-personnel", 4800000,
               f"Salaires et charges — {month:02d}/{year}", dt.date(year, month, 28 if month != 7 else 15))
            mv(MovementType.EXPENSE, "depense-locaux", 1500000,
               f"Loyer siège Point E — {month:02d}/{year}", dt.date(year, month, 3))
            mv(MovementType.EXPENSE, "depense-telecom-it", 450000,
               f"Télécoms & informatique — {month:02d}/{year}", dt.date(year, month, 10))
            if month in (1, 4, 7, 10):
                mv(MovementType.EXPENSE, "depense-assurances", 900000,
                   f"Assurance RC professionnelle — T{(month - 1) // 3 + 1} {year}", dt.date(year, month, 12))
            if month in (3, 6):
                mv(MovementType.EXPENSE, "depense-fiscalite", 1800000,
                   f"Acompte IS — {month:02d}/{year}", dt.date(year, month, 20))
            if month in (2, 5):
                mv(MovementType.EXPENSE, "depense-deplacements", 620000,
                   f"Missions régions (Thiès, Louga) — {month:02d}/{year}", dt.date(year, month, 22))

        # Écritures en attente
        mv(MovementType.INCOME, "recette-mandat-fiduciaire", 2400000,
           "Honoraires dossier Diagne (proforma)", dt.date(2026, 7, 16), MovementStatus.DRAFT)
        mv(MovementType.EXPENSE, "depense-fournitures", 380000,
           "Mobilier salle de réunion", dt.date(2026, 7, 15), MovementStatus.PENDING_VALIDATION)

        self.stdout.write("Comptabilité entreprise alimentée (oct. 2025 → juil. 2026).")

    # ------------------------------------------------------------ validations

    def _seed_validations(self, cases, users):
        agent = users["agent"]
        agent2 = users["agent2"]

        def request(case, vtype, title, summary, role, created_on, subject=ValidationSubjectType.CASE):
            req = ValidationRequest.objects.create(
                case=case,
                validation_type=vtype,
                subject_type=subject,
                title=title,
                summary=summary,
                requested_by=agent if case.assigned_to_id == agent.id else agent2,
            )
            backdate(req, created_on, fields=("created_at", "updated_at"))
            ValidationStep.objects.create(
                request=req,
                step_order=1,
                assigned_role=role,
                step_label=dict(ValidationType.choices)[vtype],
            )
            return req

        request(
            cases["waqf_sy"],
            ValidationType.CHARIA,
            "Avis charaïque — constitution du waqf Médina",
            "Vérification de la conformité de l'acte de waqf et de la clé de répartition des revenus (60 % famille / 40 % œuvres).",
            UserRole.COMITE_CHARAIQUE,
            dt.date(2026, 6, 30),
        )
        request(
            cases["zakat_ba"],
            ValidationType.LEGAL,
            "Revue juridique — partage farāʾiḍ patrimoine Bâ",
            "Contrôle des pièces d'état civil des héritiers et validation du projet de partage avant présentation au comité.",
            UserRole.JURIDIQUE_CONFORMITE,
            dt.date(2026, 7, 6),
        )
        request(
            cases["mandat_diagne"],
            ValidationType.MANAGEMENT,
            "Approbation direction — ouverture mandat Diagne",
            "Validation de l'entrée en relation et de l'enveloppe initiale de 75 000 000 XOF proposée via Taysir Finance.",
            UserRole.DIRECTION,
            dt.date(2026, 7, 15),
        )
        request(
            cases["succession_diop"],
            ValidationType.ACCOUNTING,
            "Validation comptable — travaux immeuble Sacré-Cœur",
            "Dépense de 640 000 XOF (étanchéité toiture) à imputer sur le compte succession Diop.",
            UserRole.COMPTABLE_FIDUCIAIRE,
            dt.date(2026, 7, 10),
            subject=ValidationSubjectType.FINANCIAL_MOVEMENT,
        )
        self.stdout.write("4 demandes de validation en attente créées.")

    # ---------------------------------------------------------- notifications

    def _seed_notifications(self, keeper, cases):
        items = [
            (NotificationType.VALIDATION_PENDING, "4 validations en attente",
             "Des demandes charaïque, juridique, direction et comptable attendent une décision.",
             "/validations", cases["waqf_sy"], None),
            (NotificationType.CASE_SUBMITTED, "Nouveau dossier soumis — Mandat Serigne Diagne",
             "Le dossier a été transmis pour approbation direction (enveloppe annoncée : 75 000 000 XOF).",
             f"/dossiers/{cases['mandat_diagne'].id}", cases["mandat_diagne"], None),
            (NotificationType.ASSET_VALUATION_DUE, "Réévaluation à planifier — Villa Almadies",
             "La dernière expertise date de mars 2026. Prochaine évaluation attendue avant fin septembre.",
             f"/dossiers/{cases['tutelle_ndiaye'].id}", cases["tutelle_ndiaye"], None),
            (NotificationType.GENERAL, "Estimations de juin enregistrées",
             "Les valorisations mensuelles du portefeuille PIGFI ont été mises à jour (+1,1 % sur le mois).",
             "/investissements", None, dt.date(2026, 7, 2)),
            (NotificationType.REPORT_APPROVED, "Rapport trimestriel T2 approuvé",
             "Le rapport de gestion du deuxième trimestre a été approuvé par la direction.",
             "/rapports", None, dt.date(2026, 7, 1)),
        ]
        for ntype, title, body, path, case, read_on in items:
            n = Notification.objects.create(
                user=keeper,
                case=case,
                notification_type=ntype,
                title=title,
                body=body,
                action_path=path,
                read_at=aware(read_on, 18) if read_on else None,
            )
            backdate(n, read_on or TODAY - dt.timedelta(days=1), hour=9)
        self.stdout.write("Notifications créées pour le compte conservé.")
