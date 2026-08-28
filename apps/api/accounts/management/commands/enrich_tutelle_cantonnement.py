"""Enrichit les dossiers Sécurisation des héritages des mineurs (TUTELLE_CANTONNEMENT).

- Ndiaye (ACTIVE) : cantonnement judiciaire mature, tuteur mère, PIGFI, loyers & dépenses mineurs
- Sall (DRAFT) : saisine Thiès en cours, ordonnance attendue, patrimoine inventorié
"""

from __future__ import annotations

import datetime as dt
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from assets.models import Asset, AssetType, AssetValuation, ValuationMethod
from beneficiaries.models import (
    Beneficiary,
    CaseDonor,
    DonorTrustedPerson,
    Guardian,
    RelationToDonorType,
)
from cases.models import CaseStatus, CaseType, FiduciaryCase
from finance.models import (
    FiduciaryAccount,
    FinancialMovement,
    MovementStatus,
    MovementType,
)
from investments.models import (
    CaseInvestmentPolicy,
    EnvelopeContribution,
    Investment,
    InvestmentParticipant,
)
from investments.services import ensure_case_investment_policy
from mandates.models import Mandate, MandateType
from validations.services import create_case_review_validation

D = Decimal


def aware(date: dt.date, hour: int = 10):
    return timezone.make_aware(dt.datetime(date.year, date.month, date.day, hour, 0))


class Command(BaseCommand):
    help = "Complète les dossiers TUTELLE_CANTONNEMENT avec des données cohérentes."

    @transaction.atomic
    def handle(self, *args, **options):
        User = get_user_model()
        keeper = User.objects.get(email="amadyfsy@gmail.com")
        agent = User.objects.filter(email="ousmane.diallo@amanah-fiducie.sn").first() or keeper
        agent2 = User.objects.filter(email="aissatou.ndoye@amanah-fiducie.sn").first() or agent
        direction = User.objects.filter(email="mariama.ba@amanah-fiducie.sn").first() or keeper
        tuteur_user = User.objects.filter(email="rokhaya.ndiaye@gmail.com").first()

        cases = {
            c.reference: c
            for c in FiduciaryCase.objects.filter(case_type=CaseType.TUTELLE_CANTONNEMENT)
        }
        if not cases:
            self.stderr.write("Aucun dossier TUTELLE_CANTONNEMENT trouvé.")
            return

        if "REF-2026-00001" in cases:
            self._enrich_ndiaye(cases["REF-2026-00001"], agent, direction, tuteur_user)
        if "REF-2026-00007" in cases:
            self._enrich_sall(cases["REF-2026-00007"], agent2)

        self.stdout.write(self.style.SUCCESS("Dossiers tutelle / cantonnement enrichis."))

    # ------------------------------------------------------------------ helpers

    def _ensure_asset(self, case, user, asset_type, label, location, valuations, **extra):
        asset = Asset.objects.filter(case=case, label=label).first()
        if asset is None:
            asset = Asset.objects.create(
                case=case,
                asset_type=asset_type,
                label=label,
                location=location,
                created_by=user,
                valuation_next_due=dt.date(2026, 10, 31),
                **extra,
            )
        for valued_at, value in valuations:
            if not asset.valuations.filter(valued_at=valued_at).exists():
                AssetValuation.objects.create(
                    asset=asset,
                    value=D(str(value)),
                    valued_at=valued_at,
                    method=ValuationMethod.EXPERT,
                    created_by=user,
                )
        return asset

    def _ensure_account(self, case, user, name, number, opening):
        acc = FiduciaryAccount.objects.filter(case=case).first()
        if acc is None:
            acc = FiduciaryAccount.objects.create(
                case=case,
                name=name,
                account_number=number,
                opening_balance=D(str(opening)),
                created_by=user,
            )
        return acc

    def _add_movement(self, account, user, mtype, amount, desc, date, status=MovementStatus.APPROVED):
        if FinancialMovement.objects.filter(
            account=account, description=desc, movement_date=date
        ).exists():
            return
        FinancialMovement.objects.create(
            account=account,
            movement_type=mtype,
            amount=D(str(amount)),
            description=desc,
            movement_date=date,
            status=status,
            created_by=user,
        )

    def _ensure_trusted(self, donor, first, last, phone, email, relation):
        if DonorTrustedPerson.objects.filter(donor=donor, first_name=first, last_name=last).exists():
            return
        DonorTrustedPerson.objects.create(
            donor=donor,
            first_name=first,
            last_name=last,
            phone=phone,
            email=email,
            relationship_label=relation,
        )

    # ------------------------------------------------------------------ Ndiaye

    def _enrich_ndiaye(self, case: FiduciaryCase, agent, direction, tuteur_user):
        """ACTIVE — cantonnement judiciaire, 3 mineurs, mère tutrice, PIGFI Protect."""
        case.description = (
            "Cantonnement du patrimoine des trois enfants mineurs de feu Mamadou Ndiaye, "
            "ordonné par le Tribunal de grande instance hors classe de Dakar "
            "(ordonnance n°2025-1147 du 12/09/2025). "
            "Tutrice légale : Rokhaya Ndiaye (mère). "
            "Patrimoine : villa Almadies, terrain Rufisque, liquidités BIS. "
            "Gestion sous mandat AMANAH Protect — enveloppe 150 M XOF dont 110 M placés "
            "(immobilier locatif Ouest-Foire, sukuk souverains, or physique). "
            "Revenus locatifs et coupons affectés aux besoins des mineurs (scolarité, santé)."
        )
        case.status = CaseStatus.ACTIVE
        case.save(update_fields=["description", "status", "updated_at"])

        donor = case.donors.first()
        if donor:
            donor.identification_number = donor.identification_number or "1 682 1968 00314"
            donor.notes = (
                "Défunt (décès le 03/08/2025). Père des trois mineurs. "
                "Patrimoine placé sous cantonnement judiciaire — aucune disposition "
                "successorale libre ; parts fixées par le juge des tutelles."
            )
            donor.address = donor.address or "Cité Keur Gorgui, Villa 27, Dakar"
            donor.save()
            self._ensure_trusted(
                donor,
                "Maître",
                "Diop",
                "+221 33 821 45 67",
                "cabinet.diop@notaires.sn",
                "Notaire de la succession — inventaire initial",
            )
            self._ensure_trusted(
                donor,
                "Pape",
                "Ndiaye",
                "+221 77 301 22 18",
                "pape.ndiaye.uncle@gmail.com",
                "Oncle paternel — membre du conseil de famille",
            )

        guardian = Guardian.objects.filter(case=case).first()
        if guardian:
            guardian.email = guardian.email or "rokhaya.ndiaye@gmail.com"
            guardian.relationship_label = "Mère et tutrice légale (désignée par le tribunal)"
            guardian.notes = (
                "Tutrice légale des trois mineurs. Compte portail famille actif. "
                "Rend compte au juge des tutelles chaque semestre."
            )
            if tuteur_user and guardian.user_id is None:
                guardian.user = tuteur_user
            guardian.save()

        # Mineurs : genres + notes cohérentes avec l'âge
        gender_by_name = {
            "Serigne": ("M", "Fils aîné (né 2012) — collège. Quote-part 40 % (ordonnance)."),
            "Mame Diarra": ("F", "Fille (née 2015) — élémentaire. Quote-part 30 %."),
            "Cheikh": ("M", "Fils cadet (né 2018) — maternelle / CP. Quote-part 30 %."),
        }
        for b in Beneficiary.objects.filter(case=case):
            key = b.first_name
            if key in gender_by_name:
                g, note = gender_by_name[key]
                b.gender = g
                b.notes = note
            b.is_minor = True
            b.nationality = b.nationality or "Sénégalaise"
            if guardian and b.guardian_id is None:
                b.guardian = guardian
            b.save()

        Mandate.objects.get_or_create(
            case=case,
            title="Ordonnance de cantonnement — mineurs Ndiaye",
            defaults={
                "mandate_type": MandateType.JUDICIAL,
                "reference_number": "TGI-DKR-2025-1147",
                "issuing_authority": "Tribunal de grande instance hors classe de Dakar — juge des tutelles",
                "signed_at": dt.date(2025, 9, 12),
                "effective_from": dt.date(2025, 9, 20),
                "created_by": agent,
                "notes": (
                    "Ordonnance n°2025-1147. Mandat de gestion fiduciaire confié à SOFIGEPAM "
                    "jusqu'à majorité du dernier mineur (Cheikh, 2036). "
                    "Rapports semestriels obligatoires au juge des tutelles."
                ),
            },
        )

        self._ensure_asset(
            case,
            agent,
            AssetType.REAL_ESTATE,
            "Villa familiale — Almadies",
            "Route des Almadies, lot 14, Dakar",
            [
                (dt.date(2025, 9, 20), 180000000),
                (dt.date(2025, 12, 15), 182500000),
                (dt.date(2026, 3, 15), 186000000),
                (dt.date(2026, 6, 15), 189500000),
            ],
        )
        self._ensure_asset(
            case,
            agent,
            AssetType.LAND,
            "Terrain 300 m² — Rufisque Ouest",
            "Rufisque Ouest, zone résidentielle",
            [
                (dt.date(2025, 9, 20), 25000000),
                (dt.date(2026, 1, 15), 25800000),
                (dt.date(2026, 4, 15), 26900000),
                (dt.date(2026, 7, 10), 27500000),
            ],
        )
        self._ensure_asset(
            case,
            agent,
            AssetType.BANK_ACCOUNT,
            "Compte d'attente BIS — succession Ndiaye",
            "Banque Islamique du Sénégal",
            [
                (dt.date(2025, 9, 20), 45000000),
                (dt.date(2025, 12, 31), 45000000),
                (dt.date(2026, 3, 31), 46050000),
                (dt.date(2026, 6, 30), 46620000),
                (dt.date(2026, 7, 5), 47370000),
            ],
        )

        acc = self._ensure_account(
            case, agent, "Compte de cantonnement — BIS", "SN012 01201 036000012345 78", 45000000
        )
        # Loyers déjà présents jan–juil ; compléter dépenses / produits d'investissement
        for month, label in ((1, "T2"), (4, "T3"), (7, "T1-2026/27")):
            # scolarité T2/T3 déjà là pour 1 et 4 ; ajouter rentrée juillet
            if month == 7:
                self._add_movement(
                    acc, agent, MovementType.EXPENSE, 1450000,
                    f"Frais de scolarité {label} (3 mineurs)", dt.date(2026, 7, 18),
                )
        self._add_movement(
            acc, agent, MovementType.EXPENSE, 350000,
            "Entretien / charges villa Almadies — T1 2026", dt.date(2026, 3, 22),
        )
        self._add_movement(
            acc, agent, MovementType.EXPENSE, 350000,
            "Entretien / charges villa Almadies — T2 2026", dt.date(2026, 6, 22),
        )
        self._add_movement(
            acc, agent, MovementType.INCOME, 625000,
            "Coupon sukuk T1 2026 — part Ndiaye", dt.date(2026, 4, 15),
        )
        self._add_movement(
            acc, agent, MovementType.INCOME, 625000,
            "Coupon sukuk T2 2026 — part Ndiaye", dt.date(2026, 7, 15),
        )
        self._add_movement(
            acc, agent, MovementType.EXPENSE, 225000,
            "Frais de gestion fiduciaire cantonnement — T2 2026", dt.date(2026, 6, 30),
        )
        self._add_movement(
            acc, agent, MovementType.EXPENSE, 180000,
            "Fournitures scolaires & uniformes — rentrée 2026", dt.date(2026, 7, 12),
        )

        policy = ensure_case_investment_policy(case)
        policy.sharia_compliance_score = D("98.50")
        policy.amanah_management_share_percent = D("3.00")
        policy.notes = (
            "Profil AMANAH Protect (mineurs). Cible : capital préservé, revenus réguliers. "
            "Investi : 110 M (immobilier 60 + sukuk 40 + or 10). Reste à investir : 40 M "
            "(liquidités cantonnées ~47 M sur le compte d'attente). "
            "Aucun placement spéculatif ; décisions soumises au juge des tutelles si > 25 M."
        )
        policy.scheduled_payments = [
            {
                "id": "ndiaye-v1",
                "date": "2025-10-06",
                "amount": "100000000",
                "label": "Apport initial — liquidités succession (ordonnance)",
                "status": "PAID",
                "paid_at": "2025-10-06",
                "notes": "Cantonnement ordonné par le TGI Dakar",
            },
            {
                "id": "ndiaye-v2",
                "date": "2026-02-12",
                "amount": "50000000",
                "label": "Produit vente véhicule + parts sociales du défunt",
                "status": "PAID",
                "paid_at": "2026-02-12",
                "notes": "Autorisation juge des tutelles n°2026-88",
            },
        ]
        if not policy.planned_investment_amount or policy.planned_investment_amount < D("150000000"):
            policy.planned_investment_amount = D("150000000")
        policy.save()

        # Participants : parts des mineurs sur chaque investissement du dossier
        if policy.patrimony_category_id:
            minors = list(
                Beneficiary.objects.filter(case=case, relation_to_donor=RelationToDonorType.CHILD)
            )
            for inv in Investment.objects.filter(case=case):
                total = inv.amount_invested or D("0")
                if total <= 0 or not minors:
                    continue
                for b in minors:
                    share = b.patrimony_share_percent or D("0")
                    amt = (total * share / D("100")).quantize(D("0.01"))
                    if amt <= 0:
                        continue
                    InvestmentParticipant.objects.get_or_create(
                        investment=inv,
                        beneficiary=b,
                        patrimony_category=policy.patrimony_category,
                        defaults={
                            "allocated_amount": amt,
                            "share_percent": share,
                        },
                    )

        if not case.validation_requests.exists():
            create_case_review_validation(
                case=case,
                requested_by=agent,
                title="Revue d'ouverture — cantonnement Ndiaye",
                summary=(
                    "Validation du mandat judiciaire TGI-DKR-2025-1147, de l'inventaire "
                    "notarial et du plan de placement Protect."
                ),
            )

        self.stdout.write("  ✓ Ndiaye (ACTIVE) enrichi")

    # ------------------------------------------------------------------ Sall

    def _enrich_sall(self, case: FiduciaryCase, agent):
        """DRAFT — saisine tribunal Thiès, ordonnance non encore rendue."""
        case.description = (
            "Saisine du tribunal de Thiès pour le cantonnement du patrimoine de deux mineurs "
            "(Ibrahima et Sokhna Sall), suite au décès de leur père Moussa Sall (10/2025). "
            "Tutrice proposée : Aminata Sall (tante paternelle). "
            "Patrimoine inventorié : maison familiale cité Malick Sy (~65 M) + "
            "compte postal / liquidités à recenser. "
            "Ordonnance de cantonnement attendue — dossier en brouillon, non soumis."
        )
        case.status = CaseStatus.DRAFT
        case.save(update_fields=["description", "status", "updated_at"])

        donor, _ = CaseDonor.objects.get_or_create(
            case=case,
            first_name="Moussa",
            last_name="Sall",
            defaults={
                "date_of_birth": dt.date(1970, 10, 2),
                "nationality": "Sénégalaise",
                "address": "Thiès, cité Malick Sy",
                "notes": "Défunt — saisine tribunal de Thiès en cours.",
            },
        )
        donor.notes = (
            "Défunt (décès estimé octobre 2025). Conducteur / petit commerce à Thiès. "
            "Pas de testament. Héritiers mineurs uniquement (mère prédécédée). "
            "CNI et acte de décès en cours de reconstitution au centre d'état civil."
        )
        donor.address = donor.address or "Thiès, cité Malick Sy"
        donor.identification_number = donor.identification_number or ""
        donor.save()

        self._ensure_trusted(
            donor,
            "Me",
            "Gueye",
            "+221 33 951 20 14",
            "greffe.tutelles@tribunal-thies.sn",
            "Greffe du tribunal de Thiès — suivi de la saisine",
        )

        guardian, _ = Guardian.objects.get_or_create(
            case=case,
            first_name="Aminata",
            last_name="Sall",
            defaults={
                "email": "aminata.sall@gmail.com",
                "phone": "+221 77 444 12 88",
                "relationship_label": "Tante paternelle, tutrice proposée",
            },
        )
        guardian.email = guardian.email or "aminata.sall@gmail.com"
        guardian.relationship_label = "Tante paternelle — tutrice proposée (en attente d'ordonnance)"
        guardian.notes = (
            "Vit à Thiès, près de la maison familiale. Assure déjà la garde de fait "
            "des deux enfants. Désignation formelle soumise au juge des tutelles."
        )
        guardian.save()

        gender_by_name = {
            "Ibrahima": ("M", "Fils (né 2014) — collège Thiès. Quote-part 50 % (projet)."),
            "Sokhna": ("F", "Fille (née 2017) — élémentaire. Quote-part 50 % (projet)."),
        }
        if not Beneficiary.objects.filter(case=case).exists():
            for first, birth, share in (
                ("Ibrahima", dt.date(2014, 6, 18), D("50")),
                ("Sokhna", dt.date(2017, 2, 3), D("50")),
            ):
                Beneficiary.objects.create(
                    case=case,
                    donor=donor,
                    relation_to_donor=RelationToDonorType.CHILD,
                    gender=gender_by_name[first][0],
                    first_name=first,
                    last_name="Sall",
                    date_of_birth=birth,
                    nationality="Sénégalaise",
                    is_minor=True,
                    guardian=guardian,
                    patrimony_share_percent=share,
                    notes=gender_by_name[first][1],
                )
        else:
            for b in Beneficiary.objects.filter(case=case):
                if b.first_name in gender_by_name:
                    b.gender, b.notes = gender_by_name[b.first_name]
                b.is_minor = True
                b.nationality = b.nationality or "Sénégalaise"
                if b.guardian_id is None:
                    b.guardian = guardian
                b.save()

        Mandate.objects.get_or_create(
            case=case,
            title="Projet d'ordonnance de cantonnement — mineurs Sall (Thiès)",
            defaults={
                "mandate_type": MandateType.JUDICIAL,
                "reference_number": "TGI-THIES-2026-SAISINE",
                "issuing_authority": "Tribunal de Thiès — juge des tutelles (saisine en cours)",
                "created_by": agent,
                "notes": (
                    "Saisine déposée le 08/07/2026. Ordonnance non encore rendue. "
                    "Aucun acte de gestion fiduciaire avant décision du juge."
                ),
            },
        )

        self._ensure_asset(
            case,
            agent,
            AssetType.REAL_ESTATE,
            "Maison familiale — Thiès Malick Sy",
            "Thiès, cité Malick Sy",
            [(dt.date(2026, 7, 8), 65000000)],
        )
        self._ensure_asset(
            case,
            agent,
            AssetType.BANK_ACCOUNT,
            "Compte CCP / liquidités succession Sall (à inventorier)",
            "La Poste / banques locales Thiès",
            [(dt.date(2026, 7, 8), 8500000)],
        )
        self._ensure_asset(
            case,
            agent,
            AssetType.OTHER,
            "Mobilier & effets du défunt (inventaire sommaire)",
            "Thiès, cité Malick Sy",
            [(dt.date(2026, 7, 8), 2500000)],
        )

        # Pas de compte fiduciaire opérationnel tant que l'ordonnance n'est pas rendue
        # (évite des mouvements avant autorisation judiciaire)

        policy = ensure_case_investment_policy(case)
        policy.amanah_management_share_percent = D("3.00")
        policy.sharia_compliance_score = None
        policy.planned_investment_amount = D("25000000")
        policy.notes = (
            "Brouillon. Enveloppe indicative 25 M une fois les liquidités cantonnées "
            "(après ordonnance). Profil Protect obligatoire. Aucun placement avant "
            "désignation formelle de SOFIGEPAM par le juge."
        )
        policy.scheduled_payments = [
            {
                "id": "sall-v1",
                "date": "2026-10-01",
                "amount": "25000000",
                "label": "Cantonnement liquidités (après ordonnance)",
                "status": "PLANNED",
                "notes": "Sous réserve décision TGI Thiès",
            },
        ]
        policy.save()

        if not EnvelopeContribution.objects.filter(policy=policy).exists():
            EnvelopeContribution.objects.create(
                policy=policy,
                amount=D("25000000"),
                previous_total=D("0"),
                new_total=D("25000000"),
                notes="Enveloppe prévisionnelle — en attente d'ordonnance de cantonnement.",
                created_by=agent,
            )

        self.stdout.write("  ✓ Sall (DRAFT) enrichi")
