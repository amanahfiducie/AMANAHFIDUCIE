"""Enrichit les dossiers Conseil successoral islamique (SUCCESSION).

- Diop (ACTIVE) : inventaire notarial, arbre, farāʾiḍ finalisé, compte & PIGFI
- Fall (CLOSED) : partage achevé, distributions historiques, farāʾiḍ figé
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
from faraid.models import (
    FaraidActionType,
    FaraidCommitteeReview,
    FaraidHeirDecision,
    FaraidHeirDecisionSource,
    FaraidHeirDecisionStatus,
    FaraidSettlementAction,
)
from faraid.services import finalize_faraid_review, get_or_create_review
from finance.models import (
    FiduciaryAccount,
    FinancialMovement,
    MovementStatus,
    MovementType,
)
from investments.models import Investment, InvestmentParticipant
from investments.services import ensure_case_investment_policy
from mandates.models import Mandate, MandateType, MandateValidation, MandateValidationDecision

D = Decimal


def aware(date: dt.date, hour: int = 10):
    return timezone.make_aware(dt.datetime(date.year, date.month, date.day, hour, 0))


class Command(BaseCommand):
    help = "Complète les dossiers SUCCESSION avec des données cohérentes."

    @transaction.atomic
    def handle(self, *args, **options):
        User = get_user_model()
        keeper = User.objects.get(email="amadyfsy@gmail.com")
        agent = User.objects.filter(email="aissatou.ndoye@amanah-fiducie.sn").first() or keeper
        agent2 = User.objects.filter(email="ousmane.diallo@amanah-fiducie.sn").first() or agent
        direction = User.objects.filter(email="mariama.ba@amanah-fiducie.sn").first() or keeper
        charia = User.objects.filter(email="moustapha.gueye@amanah-fiducie.sn").first() or direction
        juridique = User.objects.filter(email="fatou.ndiaye@amanah-fiducie.sn").first() or direction

        cases = {
            c.reference: c
            for c in FiduciaryCase.objects.filter(case_type=CaseType.SUCCESSION)
        }
        if not cases:
            self.stderr.write("Aucun dossier SUCCESSION trouvé.")
            return

        if "REF-2026-00002" in cases:
            self._enrich_diop(cases["REF-2026-00002"], agent, direction, charia, juridique)
        if "REF-2026-00009" in cases:
            self._enrich_fall(cases["REF-2026-00009"], agent2, direction, charia)

        self.stdout.write(self.style.SUCCESS("Dossiers conseil successoral enrichis."))

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

    def _ensure_mandate(self, case, user, *, title, mandate_type, reference, authority, signed, notes, validated_by=None):
        mandate = Mandate.objects.filter(case=case).first()
        if mandate is None:
            mandate = Mandate.objects.create(
                case=case,
                mandate_type=mandate_type,
                title=title,
                reference_number=reference,
                issuing_authority=authority,
                signed_at=signed,
                effective_from=signed,
                notes=notes,
                created_by=user,
            )
        else:
            mandate.mandate_type = mandate_type
            mandate.title = title
            mandate.reference_number = mandate.reference_number or reference
            mandate.issuing_authority = mandate.issuing_authority or authority
            mandate.signed_at = mandate.signed_at or signed
            mandate.effective_from = mandate.effective_from or signed
            mandate.notes = notes
            mandate.save()
        if validated_by and not mandate.validations.exists():
            MandateValidation.objects.create(
                mandate=mandate,
                decision=MandateValidationDecision.APPROVED,
                comment="Certificat d'hérédité et mandat de conseil successoral validés.",
                validated_by=validated_by,
            )
        return mandate

    def _reset_and_finalize_faraid(
        self,
        case,
        *,
        actor,
        net_estate: Decimal,
        shares: list[tuple[Beneficiary, str, Decimal, str]],
        notes: str,
        requested_by,
        requested_at: dt.date,
        finalized_at: dt.date,
        decision_note: str = "Part retenue selon farāʾiḍ.",
    ):
        """Remplace les décisions dupliquées, accepte les héritiers, finalise."""
        review = get_or_create_review(case)
        review.heir_decisions.all().delete()
        FaraidCommitteeReview.objects.filter(pk=review.pk).update(
            status="DRAFT",
            finalized_at=None,
            finalized_by=None,
        )
        review.refresh_from_db()

        review.net_estate = net_estate
        review.committee_notes = notes
        review.requested_by = requested_by
        review.requested_at = aware(requested_at)
        review.save()

        for beneficiary, role, fraction, rel_label in shares:
            amount = (net_estate * fraction).quantize(D("0.01"))
            FaraidHeirDecision.objects.create(
                review=review,
                beneficiary=beneficiary,
                source=FaraidHeirDecisionSource.FROM_GENEALOGY,
                full_name=f"{beneficiary.first_name} {beneficiary.last_name}".strip(),
                relationship_label=rel_label,
                faraid_role=role,
                status=FaraidHeirDecisionStatus.ACCEPTED,
                share_fraction=fraction,
                share_amount=amount,
                committee_notes=decision_note,
            )

        finalize_faraid_review(review, actor=actor)
        FaraidCommitteeReview.objects.filter(pk=review.pk).update(
            finalized_at=aware(finalized_at, 15),
            finalized_by_id=actor.id,
        )
        return review

    # ------------------------------------------------------------------ Diop

    def _enrich_diop(self, case: FiduciaryCase, agent, direction, charia, juridique):
        """ACTIVE — succession mature, farāʾiḍ validé, gestion transitoire du patrimoine."""
        case.description = (
            "Conseil successoral et gestion transitoire du patrimoine de feu El Hadj Ibrahima Diop "
            "(décès le 12/10/2025), transmis par l'étude Diop & Associés. "
            "Héritiers : veuve Sokhna + 2 fils (Moussa, Pape) + 2 filles (Ndèye Astou, Yacine). "
            "Partage farāʾiḍ validé par le comité charaïque (épouse 1/8, enfants 2:1). "
            "Patrimoine : immeuble R+3 Sacré-Cœur, terrain Diamniadio, liquidités BIS, or familial. "
            "Enveloppe PIGFI Équilibre 200 M dont 80 M placés (part immeuble locatif mutualisé). "
            "Loyers et coupons gérés en attendant la distribution corporelle des biens."
        )
        case.status = CaseStatus.ACTIVE
        case.save(update_fields=["description", "status", "updated_at"])

        donor = case.donors.first()
        if donor is None:
            donor = CaseDonor.objects.create(
                case=case,
                first_name="El Hadj Ibrahima",
                last_name="Diop",
                date_of_birth=dt.date(1949, 11, 2),
                nationality="Sénégalaise",
                address="Sacré-Cœur 3, Villa 9540, Dakar",
            )
        donor.identification_number = donor.identification_number or "1 949 1102 00041"
        donor.nationality = donor.nationality or "Sénégalaise"
        donor.address = donor.address or "Sacré-Cœur 3, Villa 9540, Dakar"
        donor.notes = (
            "De cujus — décédé le 12 octobre 2025 à Dakar. "
            "Commerçant / promoteur immobilier. Marié (monogamie). "
            "Pas de testament. Certificat d'hérédité CH-DK-2025-1142."
        )
        donor.save()

        self._ensure_trusted(
            donor,
            "Khadidiatou",
            "Diop",
            "+221 33 821 55 90",
            "etude.diop@notaires.sn",
            "Notaire — étude Diop & Associés (mandat de conseil)",
        )
        self._ensure_trusted(
            donor,
            "Moussa",
            "Diop",
            "+221 77 512 44 08",
            "moussa.diop.heir@gmail.com",
            "Fils aîné — interlocuteur familial / témoin",
        )

        self._ensure_mandate(
            case,
            agent,
            title="Certificat d'hérédité et mandat de conseil successoral",
            mandate_type=MandateType.NOTARIAL,
            reference="CH-DK-2025-1142",
            authority="Étude Diop & Associés, Dakar",
            signed=dt.date(2025, 11, 18),
            notes=(
                "Mandat confiant à SOFIGEPAM l'évaluation patrimoniale, "
                "la gestion transitoire et l'accompagnement au partage farāʾiḍ."
            ),
            validated_by=juridique,
        )

        # Arbre : enfants rattachés à la veuve Sokhna
        spouse = Beneficiary.objects.filter(
            case=case, relation_to_donor=RelationToDonorType.SPOUSE
        ).first()
        children = list(
            Beneficiary.objects.filter(case=case, relation_to_donor=RelationToDonorType.CHILD)
        )
        notes_by_name = {
            "Sokhna": "Veuve — quote-part farāʾiḍ 1/8 (12,5 %).",
            "Moussa": "Fils aîné — quote-part 7/24 (~29,17 %). Interlocuteur familial.",
            "Pape": "Fils — quote-part 7/24 (~29,17 %).",
            "Ndèye Astou": "Fille — quote-part 7/48 (~14,58 %).",
            "Yacine": "Fille cadette — quote-part 7/48 (~14,58 %).",
        }
        for b in Beneficiary.objects.filter(case=case):
            b.nationality = b.nationality or "Sénégalaise"
            if b.first_name in notes_by_name:
                b.notes = notes_by_name[b.first_name]
            if b.relation_to_donor == RelationToDonorType.CHILD and spouse:
                b.mother = spouse
            b.save()

        # Patrimoine
        self._ensure_asset(
            case, agent, AssetType.REAL_ESTATE,
            "Immeuble R+3 — Sacré-Cœur", "Sacré-Cœur 3, Dakar",
            [(dt.date(2025, 12, 1), 240000000), (dt.date(2026, 5, 10), 247000000), (dt.date(2026, 7, 1), 249500000)],
        )
        self._ensure_asset(
            case, agent, AssetType.LAND,
            "Terrain 600 m² — Diamniadio pôle urbain", "Diamniadio, zone 12",
            [(dt.date(2025, 12, 1), 48000000), (dt.date(2026, 6, 1), 52000000)],
        )
        self._ensure_asset(
            case, agent, AssetType.BANK_ACCOUNT,
            "Comptes BIS + liquidités succession Diop", "Banque Islamique du Sénégal",
            [(dt.date(2025, 11, 25), 62000000), (dt.date(2026, 6, 30), 58500000)],
        )
        self._ensure_asset(
            case, agent, AssetType.GOLD,
            "Or de famille — 280 g (conservé coffre BIS)", "BIS — coffre Dakar Plateau",
            [(dt.date(2025, 12, 5), 19600000), (dt.date(2026, 6, 15), 21000000)],
        )
        self._ensure_asset(
            case, agent, AssetType.BUSINESS,
            "Parts SARL Diop Négoce (fonds de commerce)", "Sandaga / entrepôt Rufisque",
            [(dt.date(2025, 12, 10), 18000000)],
        )

        # Compte succession + mouvements
        acc = self._ensure_account(
            case, agent,
            "Compte succession Diop — BIS",
            "SN012 01201 036000098231 44",
            62000000,
        )
        self._add_movement(
            acc, agent, MovementType.EXPENSE, 2800000,
            "Frais funéraires & levée de corps — oct. 2025", dt.date(2025, 11, 22),
        )
        self._add_movement(
            acc, agent, MovementType.EXPENSE, 450000,
            "Honoraires inventaire notarial — étude Diop", dt.date(2025, 12, 2),
        )
        self._add_movement(
            acc, agent, MovementType.INCOME, 1850000,
            "Loyers immeuble Sacré-Cœur — 01/2026", dt.date(2026, 1, 8),
        )
        self._add_movement(
            acc, agent, MovementType.INCOME, 1850000,
            "Loyers immeuble Sacré-Cœur — 02/2026", dt.date(2026, 2, 8),
        )
        self._add_movement(
            acc, agent, MovementType.INCOME, 1850000,
            "Loyers immeuble Sacré-Cœur — 03/2026", dt.date(2026, 3, 8),
        )
        self._add_movement(
            acc, agent, MovementType.INCOME, 1850000,
            "Loyers immeuble Sacré-Cœur — 04/2026", dt.date(2026, 4, 8),
        )
        self._add_movement(
            acc, agent, MovementType.INCOME, 1850000,
            "Loyers immeuble Sacré-Cœur — 05/2026", dt.date(2026, 5, 8),
        )
        self._add_movement(
            acc, agent, MovementType.INCOME, 1850000,
            "Loyers immeuble Sacré-Cœur — 06/2026", dt.date(2026, 6, 8),
        )
        self._add_movement(
            acc, agent, MovementType.EXPENSE, 640000,
            "Travaux d'étanchéité toiture — immeuble Sacré-Cœur", dt.date(2026, 7, 2),
        )
        self._add_movement(
            acc, agent, MovementType.INCOME, 1200000,
            "Coupon / revenu PIGFI part immeuble Sacré-Cœur — T2 2026", dt.date(2026, 7, 5),
        )
        self._add_movement(
            acc, agent, MovementType.EXPENSE, 375000,
            "Frais de gestion fiduciaire succession — T2 2026", dt.date(2026, 6, 30),
        )
        self._add_movement(
            acc, agent, MovementType.EXPENSE, 5000000,
            "Avance sur part — Moussa Diop (accord héritiers)", dt.date(2026, 4, 20),
        )

        # Politique PIGFI
        policy = ensure_case_investment_policy(case)
        policy.sharia_compliance_score = D("97.00")
        policy.amanah_management_share_percent = D("2.50")
        policy.notes = (
            "Profil AMANAH Équilibre (patrimoine successoral). "
            "Enveloppe 200 M (liquidités après inventaire). "
            "Investi : 80 M (part immeuble locatif mutualisé Sacré-Cœur). "
            "Reste ~120 M en liquidités / actifs en nature en attente de distribution. "
            "Aucun placement nouveau sans accord des héritiers majeurs."
        )
        policy.scheduled_payments = [
            {
                "id": "diop-v1",
                "date": "2025-12-15",
                "amount": "200000000",
                "label": "Liquidités successorales après inventaire notarial",
                "status": "PAID",
                "paid_at": "2025-12-15",
                "notes": "Apport initial — compte succession BIS",
            },
        ]
        if not policy.planned_investment_amount or policy.planned_investment_amount < D("200000000"):
            policy.planned_investment_amount = D("200000000")
        policy.save()

        if policy.patrimony_category_id:
            heirs = list(Beneficiary.objects.filter(case=case))
            for inv in Investment.objects.filter(case=case):
                total = inv.amount_invested or D("0")
                if total <= 0 or not heirs:
                    continue
                for b in heirs:
                    share = b.patrimony_share_percent or D("0")
                    amt = (total * share / D("100")).quantize(D("0.01"))
                    if amt <= 0:
                        continue
                    InvestmentParticipant.objects.get_or_create(
                        investment=inv,
                        beneficiary=b,
                        patrimony_category=policy.patrimony_category,
                        defaults={"allocated_amount": amt, "share_percent": share},
                    )

        # Farāʾiḍ : fractions exactes (épouse 1/8, résidu 2:1)
        frac = {
            "Sokhna": D("0.125000"),
            "Moussa": D("0.291667"),
            "Pape": D("0.291667"),
            "Ndèye Astou": D("0.145833"),
            "Yacine": D("0.145833"),
        }
        role = {
            "Sokhna": ("WIFE", "Conjointe / veuve"),
            "Moussa": ("SON", "Fils"),
            "Pape": ("SON", "Fils"),
            "Ndèye Astou": ("DAUGHTER", "Fille"),
            "Yacine": ("DAUGHTER", "Fille"),
        }
        # Brut ≈ 249.5+52+58.5+21+18 = 399 ; dettes funérailles+emprunt restant ≈ 14.8 → net 384.2
        net = D("384200000")
        share_rows = []
        for b in Beneficiary.objects.filter(case=case).order_by("id"):
            if b.first_name not in frac:
                continue
            r, label = role[b.first_name]
            share_rows.append((b, r, frac[b.first_name], label))
            b.patrimony_share_percent = (frac[b.first_name] * D("100")).quantize(D("0.0001"))
            b.save(update_fields=["patrimony_share_percent", "updated_at"])

        review = self._reset_and_finalize_faraid(
            case,
            actor=charia,
            net_estate=net,
            shares=share_rows,
            notes=(
                "Revue comité charaïque — parts conformes au farāʾiḍ "
                "(veuve 1/8 ; fils double part des filles sur le résidu). "
                "Parents du défunt prédécédés. Aucune exclusion."
            ),
            requested_by=agent,
            requested_at=dt.date(2026, 1, 20),
            finalized_at=dt.date(2026, 2, 10),
            decision_note="Part retenue selon farāʾiḍ (épouse 1/8, résidu 2:1).",
        )

        immeuble = Asset.objects.filter(case=case, label__icontains="Sacré-Cœur").first()
        if not FaraidSettlementAction.objects.filter(review=review).exists():
            FaraidSettlementAction.objects.create(
                review=review,
                action_type=FaraidActionType.ASSET_ALLOCATION,
                title="Maintien provisoire de l'immeuble sous gestion fiduciaire",
                description=(
                    "L'immeuble R+3 reste en indivision gérée par SOFIGEPAM "
                    "jusqu'à partage corporel ou soulte ; loyers versés au compte succession."
                ),
                asset=immeuble,
                amount=D("249500000"),
                created_by=charia,
            )
            FaraidSettlementAction.objects.create(
                review=review,
                action_type=FaraidActionType.CASH_SETTLEMENT,
                title="Avance numéraire — Moussa Diop",
                description="Avance sur part acceptée par les cohéritiers (avril 2026).",
                beneficiary=next((c for c in children if c.first_name == "Moussa"), None),
                amount=D("5000000"),
                created_by=agent,
            )

        self.stdout.write("  ✓ Diop (ACTIVE) enrichi")

    # ------------------------------------------------------------------ Fall

    def _enrich_fall(self, case: FiduciaryCase, agent, direction, charia):
        """CLOSED — succession achevé, distributions effectuées, farāʾiḍ figé."""
        case.description = (
            "Succession de feue Fatim Fall (décès le 02/08/2025), mandat notarial "
            "MDT-FALL-2025-09. Héritiers : Momar (fils), Ndèye et Aïssatou (filles) — "
            "époux prédécédé. Partage farāʾiḍ 2:1:1 finalisé ; villa U17 attribuée à Momar "
            "avec soultes aux sœurs ; liquidités BIS distribuées le 27/02/2026. "
            "Dossier clôturé — consultation en lecture seule."
        )
        case.status = CaseStatus.CLOSED
        case.save(update_fields=["description", "status", "updated_at"])

        donor = case.donors.first()
        if donor is None:
            donor = CaseDonor.objects.create(
                case=case,
                first_name="Fatim",
                last_name="Fall",
                date_of_birth=dt.date(1952, 8, 11),
                nationality="Sénégalaise",
                address="Parcelles Assainies, U17, Dakar",
            )
        donor.identification_number = donor.identification_number or "1 952 0811 00088"
        donor.nationality = donor.nationality or "Sénégalaise"
        donor.notes = (
            "De cujus — décédée le 02 août 2025. Épouse prédécédée (mari décédé 2019). "
            "Trois enfants majeurs. Succession clôturée le 27 février 2026."
        )
        donor.address = donor.address or "Parcelles Assainies, U17, Dakar"
        donor.save()

        self._ensure_trusted(
            donor,
            "Khadidiatou",
            "Diop",
            "+221 33 821 55 90",
            "etude.diop@notaires.sn",
            "Notaire — étude Diop & Associés",
        )
        self._ensure_trusted(
            donor,
            "Momar",
            "Fall",
            "+221 77 220 11 45",
            "momar.fall@gmail.com",
            "Fils aîné — héritier et interlocuteur",
        )

        self._ensure_mandate(
            case,
            agent,
            title="Mandat successoral Fatim Fall",
            mandate_type=MandateType.NOTARIAL,
            reference="MDT-FALL-2025-09",
            authority="Étude Diop & Associés",
            signed=dt.date(2025, 8, 20),
            notes="Mandat achevé — fonds et biens distribués le 27/02/2026.",
            validated_by=direction,
        )
        mandate = Mandate.objects.filter(case=case).first()
        if mandate:
            mandate.effective_to = dt.date(2026, 2, 27)
            mandate.save(update_fields=["effective_to", "updated_at"])

        notes_by_name = {
            "Momar": "Fils — quote-part 1/2 (50 %). Villa U17 attribuée avec soulte.",
            "Ndèye": "Fille — quote-part 1/4 (25 %). Soulte + part liquidités.",
            "Aïssatou": "Fille — quote-part 1/4 (25 %). Soulte + part liquidités.",
        }
        for b in Beneficiary.objects.filter(case=case):
            b.nationality = b.nationality or "Sénégalaise"
            if b.first_name in notes_by_name:
                b.notes = notes_by_name[b.first_name]
            b.save()

        self._ensure_asset(
            case, agent, AssetType.REAL_ESTATE,
            "Villa U17 — Parcelles Assainies (distribuée)",
            "Parcelles Assainies U17, Dakar",
            [
                (dt.date(2025, 8, 10), 95000000),
                (dt.date(2025, 12, 15), 98000000),
                (dt.date(2026, 2, 20), 98000000),
            ],
        )
        self._ensure_asset(
            case, agent, AssetType.BANK_ACCOUNT,
            "Compte succession Fall — BIS (soldé)",
            "Banque Islamique du Sénégal",
            [
                (dt.date(2025, 8, 10), 32000000),
                (dt.date(2025, 12, 31), 18500000),
                (dt.date(2026, 2, 27), 0),
            ],
        )
        self._ensure_asset(
            case, agent, AssetType.GOLD,
            "Bijoux & or familial (distribués)",
            "Remis aux héritières",
            [(dt.date(2025, 9, 1), 4500000), (dt.date(2026, 2, 20), 4500000)],
        )

        acc = self._ensure_account(
            case, agent,
            "Compte succession Fall — BIS (clôturé)",
            "SN012 01201 036000077300 55",
            32000000,
        )
        self._add_movement(
            acc, agent, MovementType.EXPENSE, 1800000,
            "Frais funéraires Fatim Fall — août 2025", dt.date(2025, 8, 15),
        )
        self._add_movement(
            acc, agent, MovementType.EXPENSE, 350000,
            "Honoraires inventaire & certificat d'hérédité", dt.date(2025, 9, 5),
        )
        self._add_movement(
            acc, agent, MovementType.EXPENSE, 8000000,
            "Soulte Ndèye Fall — part villa (accord partage)", dt.date(2025, 12, 20),
        )
        self._add_movement(
            acc, agent, MovementType.EXPENSE, 8000000,
            "Soulte Aïssatou Fall — part villa (accord partage)", dt.date(2025, 12, 20),
        )
        self._add_movement(
            acc, agent, MovementType.EXPENSE, 32000000,
            "Distribution finale aux héritiers — clôture", dt.date(2026, 2, 27),
        )

        # Ouverture = somme des sorties (funérailles + honoraires + soultes + clôture)
        # pour un solde final à zéro sur dossier clôturé.
        target_open = D("50150000")
        if acc.opening_balance != target_open:
            acc.opening_balance = target_open
            acc.save(update_fields=["opening_balance", "updated_at"])

        net = D("134500000")  # villa 98 + liquidités nettes ~32 + or 4.5
        frac = {
            "Momar": D("0.500000"),
            "Ndèye": D("0.250000"),
            "Aïssatou": D("0.250000"),
        }
        role = {
            "Momar": ("SON", "Fils"),
            "Ndèye": ("DAUGHTER", "Fille"),
            "Aïssatou": ("DAUGHTER", "Fille"),
        }
        share_rows = []
        for b in Beneficiary.objects.filter(case=case).order_by("id"):
            if b.first_name not in frac:
                continue
            r, label = role[b.first_name]
            share_rows.append((b, r, frac[b.first_name], label))
            b.patrimony_share_percent = (frac[b.first_name] * D("100")).quantize(D("0.0001"))
            b.save(update_fields=["patrimony_share_percent", "updated_at"])

        review = self._reset_and_finalize_faraid(
            case,
            actor=charia,
            net_estate=net,
            shares=share_rows,
            notes=(
                "Partage farāʾiḍ finalisé : 1 fils + 2 filles, pas de conjoint survivant "
                "(époux prédécédé). Parts 1/2 — 1/4 — 1/4. "
                "Villa attribuée à Momar avec soultes aux sœurs."
            ),
            requested_by=agent,
            requested_at=dt.date(2025, 10, 15),
            finalized_at=dt.date(2025, 11, 28),
            decision_note="Part retenue selon farāʾiḍ (fils double part des filles).",
        )

        villa = Asset.objects.filter(case=case, label__icontains="Villa U17").first()
        momar = Beneficiary.objects.filter(case=case, first_name="Momar").first()
        if not FaraidSettlementAction.objects.filter(review=review).exists():
            FaraidSettlementAction.objects.create(
                review=review,
                action_type=FaraidActionType.ASSET_ALLOCATION,
                title="Attribution villa U17 à Momar Fall",
                description="Villa familiale attribuée au fils contre soultes aux sœurs.",
                beneficiary=momar,
                asset=villa,
                amount=D("98000000"),
                created_by=charia,
            )
            for first, amt in (("Ndèye", 8000000), ("Aïssatou", 8000000)):
                heir = Beneficiary.objects.filter(case=case, first_name=first).first()
                FaraidSettlementAction.objects.create(
                    review=review,
                    action_type=FaraidActionType.CASH_SETTLEMENT,
                    title=f"Soulte {first} Fall — part villa",
                    description="Compensation numéraire suite à l'attribution de la villa.",
                    beneficiary=heir,
                    amount=D(str(amt)),
                    created_by=agent,
                )

        self.stdout.write("  ✓ Fall (CLOSED) enrichi")
