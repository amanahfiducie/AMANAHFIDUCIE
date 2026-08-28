"""Enrichit les dossiers Gestion fiduciaire du patrimoine (MANDAT_FIDUCIAIRE).

Rend chaque dossier complet et cohérent selon son statut :
- Kane (ACTIVE) : mandat mature, loyers, investissements, famille, scores
- Touré (DRAFT) : diaspora Milan, pièces en attente, enveloppe prévisionnelle
- Diagne (UNDER_REVIEW) : intro Taysir, validation direction, patrimoine annoncé
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
    help = "Complète les dossiers MANDAT_FIDUCIAIRE avec des données cohérentes."

    @transaction.atomic
    def handle(self, *args, **options):
        User = get_user_model()
        keeper = User.objects.get(email="amadyfsy@gmail.com")
        agent = User.objects.filter(email="ousmane.diallo@amanah-fiducie.sn").first() or keeper
        agent2 = User.objects.filter(email="aissatou.ndoye@amanah-fiducie.sn").first() or agent
        direction = User.objects.filter(email="mariama.ba@amanah-fiducie.sn").first() or keeper

        cases = {
            c.reference: c
            for c in FiduciaryCase.objects.filter(case_type=CaseType.MANDAT_FIDUCIAIRE)
        }
        if not cases:
            self.stderr.write("Aucun dossier MANDAT_FIDUCIAIRE trouvé.")
            return

        if "REF-2026-00003" in cases:
            self._enrich_kane(cases["REF-2026-00003"], agent, direction)
        if "REF-2026-00006" in cases:
            self._enrich_toure(cases["REF-2026-00006"], agent2)
        if "REF-2026-00008" in cases:
            self._enrich_diagne(cases["REF-2026-00008"], agent, direction, keeper)

        self.stdout.write(self.style.SUCCESS("Dossiers mandat fiduciaire enrichis."))

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

    def _ensure_contrib(self, policy, amount, notes, user, when: dt.date):
        if EnvelopeContribution.objects.filter(policy=policy, notes=notes).exists():
            return
        previous = policy.planned_investment_amount or D("0")
        # Si l'enveloppe est déjà au bon niveau, on enregistre juste l'historique manquant
        # sans double-compter le total.
        already = sum(
            (c.amount for c in EnvelopeContribution.objects.filter(policy=policy)),
            D("0"),
        )
        contrib = EnvelopeContribution.objects.create(
            policy=policy,
            amount=D(str(amount)),
            previous_total=already,
            new_total=already + D(str(amount)),
            notes=notes,
            created_by=user,
        )
        EnvelopeContribution.objects.filter(pk=contrib.pk).update(created_at=aware(when))

    # ------------------------------------------------------------------ Kane

    def _enrich_kane(self, case: FiduciaryCase, agent, direction):
        """ACTIVE — mandat mature, famille, loyers, PIGFI partiellement investi."""
        case.description = (
            "Mandat de gestion patrimoniale long terme confié par Cheikh Kane "
            "(entrepreneur, Point E) au profit de ses deux enfants Mouhamed et Adja. "
            "Patrimoine : appartement F4 Mermoz (loyers) + parts SARL Kane & Frères. "
            "Profil AMANAH Croissance — enveloppe 120 M XOF dont 50 M déjà placés "
            "(sukuk souverains + dépôt Mourabaha Taysir). Revue annuelle prévue en janvier 2027."
        )
        case.status = CaseStatus.ACTIVE
        case.save(update_fields=["description", "status", "updated_at"])

        donor = case.donors.first()
        if donor:
            donor.identification_number = donor.identification_number or "SN-CNI-1972-0830-4521"
            donor.notes = (
                "Mandant vivant. Chef d'entreprise (négoce matériaux). "
                "Souhaite sécuriser le patrimoine familial hors bilan commercial."
            )
            donor.save()
            self._ensure_trusted(
                donor,
                "Ibrahima",
                "Kane",
                "+221 77 612 34 90",
                "ibrahima.kane@gmail.com",
                "Frère — personne de confiance / contact d'urgence",
            )

        # Famille : genres + éventuelle épouse (bénéficiaire secondaire 0 % patrimoine placé)
        for b in Beneficiary.objects.filter(case=case):
            if b.first_name == "Mouhamed":
                b.gender = "M"
                b.notes = "Fils aîné — études de commerce à l'UCAD. Quote-part 50 %."
            elif b.first_name == "Adja":
                b.gender = "F"
                b.notes = "Fille — terminale au lycée John Fitzgerald Kennedy. Quote-part 50 %."
            b.is_minor = False
            b.save()

        if donor and not Beneficiary.objects.filter(case=case, relation_to_donor=RelationToDonorType.SPOUSE).exists():
            Beneficiary.objects.create(
                case=case,
                donor=donor,
                relation_to_donor=RelationToDonorType.SPOUSE,
                gender="F",
                first_name="Aïssatou",
                last_name="Kane",
                date_of_birth=dt.date(1976, 2, 14),
                nationality="Sénégalaise",
                patrimony_share_percent=D("0"),
                notes=(
                    "Épouse du mandant — informée du mandat, sans quote-part sur l'enveloppe "
                    "d'investissement (réservée aux enfants)."
                ),
            )

        Mandate.objects.get_or_create(
            case=case,
            title="Mandat de gestion patrimoniale — famille Kane",
            defaults={
                "mandate_type": MandateType.FAMILY,
                "reference_number": "MDT-KANE-2026-01",
                "issuing_authority": "SOFIGEPAM — Direction",
                "signed_at": dt.date(2026, 1, 15),
                "effective_from": dt.date(2026, 1, 20),
                "created_by": agent,
                "notes": "Mandat familial long terme, profil AMANAH Croissance. Durée 10 ans renouvelable.",
            },
        )

        self._ensure_asset(
            case,
            agent,
            AssetType.REAL_ESTATE,
            "Appartement F4 — Mermoz",
            "Mermoz Pyrotechnie, Dakar",
            [
                (dt.date(2026, 1, 20), 85000000),
                (dt.date(2026, 4, 20), 86800000),
                (dt.date(2026, 7, 5), 88200000),
            ],
        )
        self._ensure_asset(
            case,
            agent,
            AssetType.SHARES,
            "Parts sociales — SARL Kane & Frères",
            "Dakar",
            [
                (dt.date(2026, 1, 20), 35000000),
                (dt.date(2026, 4, 20), 34400000),
                (dt.date(2026, 7, 5), 36500000),
            ],
        )
        self._ensure_asset(
            case,
            agent,
            AssetType.OTHER,
            "Véhicule familial Toyota RAV4 (2022)",
            "Dakar",
            [(dt.date(2026, 1, 20), 18500000), (dt.date(2026, 7, 1), 17200000)],
        )

        acc = self._ensure_account(
            case, agent, "Compte mandat Kane — BIS", "SN012 01201 036000055100 21", 5000000
        )
        if acc.opening_balance != D("5000000"):
            acc.opening_balance = D("5000000")
            acc.save(update_fields=["opening_balance"])
        # Versements clients (alimentent l'enveloppe / les placements)
        self._add_movement(
            acc, agent, MovementType.INCOME, 80000000,
            "Versement initial du mandant — ouverture enveloppe", dt.date(2026, 1, 20),
        )
        self._add_movement(
            acc, agent, MovementType.INCOME, 40000000,
            "Versement complémentaire — prime annuelle du mandant", dt.date(2026, 5, 5),
        )
        # Loyers complets + sorties liées aux placements
        for month in (1, 2, 3, 4, 5, 6, 7):
            self._add_movement(
                acc,
                agent,
                MovementType.INCOME,
                850000,
                f"Loyer Mermoz — {month:02d}/2026",
                dt.date(2026, month, 8),
            )
        self._add_movement(
            acc, agent, MovementType.EXPENSE, 320000,
            "Charges copropriété T1 2026", dt.date(2026, 3, 18),
        )
        self._add_movement(
            acc, agent, MovementType.EXPENSE, 320000,
            "Charges copropriété T2 2026", dt.date(2026, 6, 20),
        )
        self._add_movement(
            acc, agent, MovementType.EXPENSE, 35000000,
            "Souscription sukuk État du Sénégal — part Kane", dt.date(2026, 2, 2),
        )
        self._add_movement(
            acc, agent, MovementType.EXPENSE, 15000000,
            "Dépôt Mourabaha 12 mois — Taysir Finance", dt.date(2026, 3, 12),
        )
        self._add_movement(
            acc, agent, MovementType.INCOME, 546875,
            "Coupon sukuk T1 2026 — part Kane", dt.date(2026, 4, 15),
        )
        self._add_movement(
            acc, agent, MovementType.INCOME, 546875,
            "Coupon sukuk T2 2026 — part Kane", dt.date(2026, 7, 15),
        )
        self._add_movement(
            acc, agent, MovementType.EXPENSE, 180000,
            "Frais de gestion fiduciaire — T2 2026", dt.date(2026, 6, 30),
        )

        policy = ensure_case_investment_policy(case)
        policy.sharia_compliance_score = D("97.00")
        policy.amanah_management_share_percent = D("3.00")
        policy.notes = (
            "Profil Croissance. Cible indicative : 40 % sukuk / 25 % immobilier / "
            "20 % liquidités / 15 % or. Investi à ce jour : 50 M (sukuk 35 + Mourabaha 15). "
            "Reste à investir : 70 M."
        )
        policy.scheduled_payments = [
            {
                "id": "kane-v1",
                "date": "2026-01-20",
                "amount": "80000000",
                "label": "Versement initial du mandant",
                "status": "PAID",
                "paid_at": "2026-01-20",
                "notes": "Virement BIS — ouverture du mandat",
            },
            {
                "id": "kane-v2",
                "date": "2026-05-05",
                "amount": "40000000",
                "label": "Versement complémentaire (prime annuelle)",
                "status": "PAID",
                "paid_at": "2026-05-05",
                "notes": "Prime annuelle Cheikh Kane",
            },
        ]
        if not policy.planned_investment_amount or policy.planned_investment_amount < D("120000000"):
            policy.planned_investment_amount = D("120000000")
        policy.save()

        # Participants : parts enfants sur le sukuk Kane
        sukuk = Investment.objects.filter(case=case, reference="PIGFI-SUK-2026-01/B").first()
        if sukuk and policy.patrimony_category_id:
            total = D("35000000")
            for b in Beneficiary.objects.filter(case=case, relation_to_donor=RelationToDonorType.CHILD):
                InvestmentParticipant.objects.get_or_create(
                    investment=sukuk,
                    beneficiary=b,
                    patrimony_category=policy.patrimony_category,
                    defaults={
                        "allocated_amount": total / 2,
                        "share_percent": D("50"),
                    },
                )

        if not case.validation_requests.exists():
            create_case_review_validation(
                case=case,
                requested_by=agent,
                title="Revue d'ouverture — mandat famille Kane",
                summary="Validation croisée juridique / direction à l'ouverture du mandat.",
            )

        self.stdout.write("  ✓ Kane (ACTIVE) enrichi")

    # ------------------------------------------------------------------ Touré

    def _enrich_toure(self, case: FiduciaryCase, agent):
        """DRAFT — diaspora Milan, dossier en constitution."""
        case.description = (
            "Projet de mandat de gestion pour Mme Bineta Touré, résidente à Milan (diaspora). "
            "Objectif : sécuriser un appartement familial à Ouakam et constituer une enveloppe "
            "d'investissement de 45 M XOF au profit de sa fille Awa. "
            "Pièces d'identité (passeport + CNI) et procuration notariale en attente. "
            "Brouillon — non soumis."
        )
        case.status = CaseStatus.DRAFT
        case.save(update_fields=["description", "status", "updated_at"])

        donor, _ = CaseDonor.objects.get_or_create(
            case=case,
            first_name="Bineta",
            last_name="Touré",
            defaults={
                "date_of_birth": dt.date(1978, 5, 16),
                "nationality": "Sénégalaise / italienne",
                "email": "bineta.toure@email.it",
                "phone": "+39 333 456 7890",
                "address": "Via Padova 128, Milan (IT) — famille à Ouakam, Dakar",
                "notes": "Diaspora — pièces d'identité et RIB en attente.",
            },
        )
        donor.notes = (
            "Résidente italienne depuis 2012 (infirmière). "
            "Souhaite un mandat pour gérer à distance le patrimoine sénégalais. "
            "CNI / passeport / justificatif de domicile Milan attendus."
        )
        if not donor.identification_number:
            donor.identification_number = ""  # volontairement vide — pièce en attente
        donor.address = donor.address or "Via Padova 128, Milan (IT) — famille à Ouakam, Dakar"
        donor.save()

        self._ensure_trusted(
            donor,
            "Khady",
            "Touré",
            "+221 77 888 21 45",
            "khady.toure.dakar@gmail.com",
            "Sœur à Dakar — interlocutrice locale / remise des clés Ouakam",
        )

        awa = Beneficiary.objects.filter(case=case, first_name="Awa").first()
        if awa is None and donor:
            awa = Beneficiary.objects.create(
                case=case,
                donor=donor,
                relation_to_donor=RelationToDonorType.CHILD,
                gender="F",
                first_name="Awa",
                last_name="Touré",
                date_of_birth=dt.date(2008, 1, 9),
                nationality="Sénégalaise",
                is_minor=True,
                patrimony_share_percent=D("100"),
                notes="Fille unique — bénéficiaire exclusive de l'enveloppe prévue.",
            )
        else:
            awa.gender = "F"
            # Née janv. 2008 → 18 ans en janv. 2026 ; en juillet 2026 elle est majeure
            awa.is_minor = False
            awa.patrimony_share_percent = D("100")
            awa.notes = "Fille unique — bénéficiaire exclusive. Majeur depuis janvier 2026."
            awa.save()

        Mandate.objects.get_or_create(
            case=case,
            title="Projet de mandat — Bineta Touré (diaspora)",
            defaults={
                "mandate_type": MandateType.FAMILY,
                "reference_number": "MDT-TOURE-2026-BROUILLON",
                "issuing_authority": "SOFIGEPAM",
                "created_by": agent,
                "notes": (
                    "Brouillon non signé. Signature prévue dès réception des pièces "
                    "et de la procuration notariale milanais."
                ),
            },
        )

        self._ensure_asset(
            case,
            agent,
            AssetType.REAL_ESTATE,
            "Appartement F3 — Ouakam (famille)",
            "Ouakam, cité Avion, Dakar",
            [(dt.date(2026, 6, 25), 62000000)],
        )
        self._ensure_asset(
            case,
            agent,
            AssetType.BANK_ACCOUNT,
            "Compte épargne BIS — Bineta Touré (à cantonner)",
            "Banque Islamique du Sénégal",
            [(dt.date(2026, 6, 25), 12000000)],
        )

        acc = self._ensure_account(
            case, agent, "Compte mandat Touré — BIS (prévu)", "SN012 01201 036000077300 44", 0
        )
        # Pas de mouvements : dossier encore en brouillon

        policy = ensure_case_investment_policy(case)
        policy.amanah_management_share_percent = D("3.00")
        policy.sharia_compliance_score = None
        policy.notes = (
            "Brouillon. Enveloppe cible 45 M — profil à confirmer (Équilibre recommandé "
            "pour diaspora / horizon 8–10 ans). Aucun placement tant que le mandat n'est pas signé."
        )
        policy.scheduled_payments = [
            {
                "id": "toure-v1",
                "date": "2026-09-01",
                "amount": "45000000",
                "label": "Versement initial prévu (après signature)",
                "status": "PLANNED",
                "notes": "Virement international Milan → BIS",
            },
        ]
        if not policy.planned_investment_amount:
            policy.planned_investment_amount = D("45000000")
            policy.save()
            self._ensure_contrib(
                policy,
                45000000,
                "Enveloppe prévisionnelle — en attente de signature du mandat.",
                agent,
                dt.date(2026, 6, 25),
            )
        else:
            policy.save()

        self.stdout.write("  ✓ Touré (DRAFT) enrichi")

    # ------------------------------------------------------------------ Diagne

    def _enrich_diagne(self, case: FiduciaryCase, agent, direction, keeper):
        """UNDER_REVIEW — intro Taysir, en attente d'approbation direction."""
        case.description = (
            "Mandat proposé via le partenaire Taysir Finance. "
            "Serigne Diagne (Almadies) souhaite confier une enveloppe de 75 M XOF "
            "et la villa familiale au profit de ses enfants Oumar et Marième. "
            "Dossier soumis le 15/07/2026 — en attente d'approbation direction "
            "et de validation juridique des clauses du mandat."
        )
        case.status = CaseStatus.UNDER_REVIEW
        case.save(update_fields=["description", "status", "updated_at"])

        donor, _ = CaseDonor.objects.get_or_create(
            case=case,
            first_name="Serigne",
            last_name="Diagne",
            defaults={
                "date_of_birth": dt.date(1965, 12, 28),
                "nationality": "Sénégalaise",
                "email": "serigne.diagne@gmail.com",
                "phone": "+221 78 901 44 22",
                "address": "Almadies, lotissement Ngor, Dakar",
                "identification_number": "SN-CNI-1965-1228-8890",
                "notes": "Introduit via Taysir Finance (conseiller : M. Fall).",
            },
        )
        donor.identification_number = donor.identification_number or "SN-CNI-1965-1228-8890"
        donor.address = donor.address or "Almadies, lotissement Ngor, Dakar"
        donor.notes = (
            "Client apporté par Taysir Finance. Patrimoine annoncé : villa Almadies + "
            "liquidités 75 M. Souhaite un profil AMANAH Équilibre."
        )
        donor.save()

        self._ensure_trusted(
            donor,
            "Moussa",
            "Fall",
            "+221 77 555 09 18",
            "moussa.fall@taysir-finance.sn",
            "Conseiller Taysir Finance — apporteur d'affaires",
        )

        oumar = Beneficiary.objects.filter(case=case, first_name="Oumar").first()
        if oumar:
            oumar.gender = "M"
            oumar.patrimony_share_percent = D("60")
            oumar.notes = "Fils aîné — ingénieur informaticien. Quote-part 60 %."
            oumar.is_minor = False
            oumar.save()
        elif donor:
            oumar = Beneficiary.objects.create(
                case=case,
                donor=donor,
                relation_to_donor=RelationToDonorType.CHILD,
                gender="M",
                first_name="Oumar",
                last_name="Diagne",
                date_of_birth=dt.date(2001, 4, 14),
                nationality="Sénégalaise",
                patrimony_share_percent=D("60"),
                notes="Fils aîné — quote-part 60 %.",
            )

        if donor and not Beneficiary.objects.filter(case=case, first_name="Marième").exists():
            Beneficiary.objects.create(
                case=case,
                donor=donor,
                relation_to_donor=RelationToDonorType.CHILD,
                gender="F",
                first_name="Marième",
                last_name="Diagne",
                date_of_birth=dt.date(2005, 9, 22),
                nationality="Sénégalaise",
                patrimony_share_percent=D("40"),
                notes="Fille — étudiante en droit. Quote-part 40 %.",
            )

        if donor and not Beneficiary.objects.filter(case=case, relation_to_donor=RelationToDonorType.SPOUSE).exists():
            Beneficiary.objects.create(
                case=case,
                donor=donor,
                relation_to_donor=RelationToDonorType.SPOUSE,
                gender="F",
                first_name="Ndèye Fatou",
                last_name="Diagne",
                date_of_birth=dt.date(1970, 6, 3),
                nationality="Sénégalaise",
                patrimony_share_percent=D("0"),
                notes="Épouse — informée ; quote-part d'investissement réservée aux enfants.",
            )

        Mandate.objects.get_or_create(
            case=case,
            title="Projet de mandat fiduciaire — Serigne Diagne",
            defaults={
                "mandate_type": MandateType.CONTRACTUAL,
                "reference_number": "MDT-DIAGNE-2026-PROJET",
                "issuing_authority": "SOFIGEPAM / Taysir Finance",
                "created_by": agent,
                "notes": (
                    "Projet de mandat contractuel. Signature après approbation direction "
                    "et visa juridique. Durée proposée : 7 ans."
                ),
            },
        )

        self._ensure_asset(
            case,
            agent,
            AssetType.REAL_ESTATE,
            "Villa R+1 — Almadies Ngor",
            "Almadies, lotissement Ngor, Dakar",
            [(dt.date(2026, 7, 15), 185000000)],
        )
        self._ensure_asset(
            case,
            agent,
            AssetType.OTHER,
            "Véhicule Mercedes GLC 2023",
            "Dakar",
            [(dt.date(2026, 7, 15), 28000000)],
        )
        self._ensure_asset(
            case,
            agent,
            AssetType.BANK_ACCOUNT,
            "Compte courant BIS — Serigne Diagne (à transférer)",
            "Banque Islamique du Sénégal",
            [(dt.date(2026, 7, 15), 75000000)],
        )

        acc = self._ensure_account(
            case, agent, "Compte mandat Diagne — BIS (prévu)", "SN012 01201 036000088400 55", 0
        )
        self._add_movement(
            acc,
            agent,
            MovementType.INCOME,
            75000000,
            "Apport annoncé — liquidités à cantonner (en attente validation)",
            dt.date(2026, 7, 16),
            status=MovementStatus.PENDING_VALIDATION,
        )

        policy = ensure_case_investment_policy(case)
        policy.amanah_management_share_percent = D("2.50")
        policy.sharia_compliance_score = D("95.00")
        policy.notes = (
            "Enveloppe 75 M annoncée via Taysir. Aucun placement avant approbation direction. "
            "Cible indicative Équilibre : 35 % sukuk / 30 % immobilier / 20 % liquidités / 15 % or."
        )
        policy.scheduled_payments = [
            {
                "id": "diagne-v1",
                "date": "2026-08-01",
                "amount": "75000000",
                "label": "Cantonnement liquidités (après approbation)",
                "status": "PLANNED",
                "notes": "Sous réserve validation direction + juridique",
            },
        ]
        if not policy.planned_investment_amount:
            policy.planned_investment_amount = D("75000000")
            policy.save()
            self._ensure_contrib(
                policy,
                75000000,
                "Enveloppe annoncée via Taysir Finance — en attente d'approbation direction.",
                direction,
                dt.date(2026, 7, 15),
            )
        else:
            policy.planned_investment_amount = D("75000000")
            policy.save()

        if not case.validation_requests.exists():
            create_case_review_validation(
                case=case,
                requested_by=keeper,
                title="Approbation direction — ouverture mandat Diagne",
                summary=(
                    "Dossier introduit par Taysir Finance. Vérifier l'origine des fonds, "
                    "les clauses du mandat et l'affectation 60/40 Oumar/Marième."
                ),
            )

        self.stdout.write("  ✓ Diagne (UNDER_REVIEW) enrichi")
