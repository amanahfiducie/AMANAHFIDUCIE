"""Complète les dossiers de démo incomplets (cohérent avec le seed production)."""

from __future__ import annotations

import datetime as dt
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from assets.models import Asset, AssetType, AssetValuation, ValuationMethod
from beneficiaries.models import Beneficiary, CaseDonor, Guardian, RelationToDonorType
from cases.models import CaseStatus, FiduciaryCase
from finance.models import (
    FiduciaryAccount,
    FinancialMovement,
    MovementStatus,
    MovementType,
)
from investments.models import CaseInvestmentPolicy, EnvelopeContribution
from investments.services import ensure_case_investment_policy
from mandates.models import Mandate, MandateType, MandateValidation, MandateValidationDecision
from waqf.models import WaqfProfile, WaqfType
from zakat.models import ZakatAssessment, ZakatAssessmentStatus

D = Decimal


def aware(date: dt.date, hour: int = 10):
    return timezone.make_aware(dt.datetime(date.year, date.month, date.day, hour, 0))


class Command(BaseCommand):
    help = "Complète les données manquantes des dossiers de démo."

    @transaction.atomic
    def handle(self, *args, **options):
        User = get_user_model()
        agent = User.objects.filter(email="ousmane.diallo@amanah-fiducie.sn").first()
        agent2 = User.objects.filter(email="aissatou.ndoye@amanah-fiducie.sn").first()
        direction = User.objects.filter(email="mariama.ba@amanah-fiducie.sn").first()
        keeper = User.objects.get(email="amadyfsy@gmail.com")
        agent = agent or keeper
        agent2 = agent2 or agent
        direction = direction or keeper

        by_ref = {c.reference: c for c in FiduciaryCase.objects.all()}

        self._complete_kane(by_ref["REF-2026-00003"], agent)
        self._complete_waqf(by_ref["REF-2026-00004"], agent2)
        self._complete_zakat(by_ref["REF-2026-00005"], agent, keeper)
        self._complete_toure(by_ref["REF-2026-00006"], agent2)
        self._complete_sall(by_ref["REF-2026-00007"], agent)
        self._complete_diagne(by_ref["REF-2026-00008"], agent, direction)
        self._complete_fall_closed(by_ref["REF-2026-00009"], agent2, direction)

        self.stdout.write(self.style.SUCCESS("Dossiers complétés."))

    def _ensure_asset(self, case, user, asset_type, label, location, valuations, **extra):
        asset = Asset.objects.filter(case=case, label=label).first()
        if asset is None:
            asset = Asset.objects.create(
                case=case,
                asset_type=asset_type,
                label=label,
                location=location,
                created_by=user,
                valuation_next_due=dt.date(2026, 9, 30),
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
        acc = FiduciaryAccount.objects.filter(case=case, name=name).first()
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
        if FinancialMovement.objects.filter(account=account, description=desc, movement_date=date).exists():
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

    def _complete_kane(self, case, user):
        acc = self._ensure_account(case, user, "Compte mandat Kane — BIS", "SN012 01201 036000055100 21", 22000000)
        self._add_movement(acc, user, MovementType.INCOME, 850000, "Loyer Mermoz — 04/2026", dt.date(2026, 4, 8))
        self._add_movement(acc, user, MovementType.INCOME, 850000, "Loyer Mermoz — 05/2026", dt.date(2026, 5, 8))
        self._add_movement(acc, user, MovementType.INCOME, 850000, "Loyer Mermoz — 06/2026", dt.date(2026, 6, 8))
        self._add_movement(acc, user, MovementType.EXPENSE, 320000, "Charges copropriété T2 2026", dt.date(2026, 6, 20))
        Mandate.objects.get_or_create(
            case=case,
            title="Mandat de gestion patrimoniale — famille Kane",
            defaults={
                "mandate_type": MandateType.FAMILY,
                "reference_number": "MDT-KANE-2026-01",
                "issuing_authority": "SOFIGEPAM — Direction",
                "signed_at": dt.date(2026, 1, 15),
                "effective_from": dt.date(2026, 1, 20),
                "created_by": user,
                "notes": "Mandat familial long terme, profil AMANAH Croissance.",
            },
        )
        self.stdout.write("  Kane complété")

    def _complete_waqf(self, case, user):
        donor = case.donors.first()
        if donor and not Beneficiary.objects.filter(case=case).exists():
            for first, gender, rel, birth, share in (
                ("Mame", "F", RelationToDonorType.CHILD, dt.date(1988, 4, 12), D("20")),
                ("Cheikh", "M", RelationToDonorType.CHILD, dt.date(1992, 9, 3), D("40")),
                ("Œuvres caritatives", "M", RelationToDonorType.OTHER, None, D("40")),
            ):
                Beneficiary.objects.create(
                    case=case,
                    donor=donor,
                    relation_to_donor=rel,
                    gender=gender if first != "Œuvres caritatives" else "",
                    first_name=first,
                    last_name="Sy" if first != "Œuvres caritatives" else "",
                    date_of_birth=birth,
                    nationality="Sénégalaise" if birth else "",
                    patrimony_share_percent=share,
                    notes="Bénéficiaire des revenus du waqf (clé 60/40 famille/œuvres)."
                    if first != "Œuvres caritatives"
                    else "Quote-part caritative du waqf (40 %).",
                )
        WaqfProfile.objects.get_or_create(
            case=case,
            defaults={
                "waqf_type": WaqfType.FAMILY,
                "waqf_object": (
                    "Immeuble de rapport situé Médina, rue 11 x 20, Dakar — "
                    "revenus locatifs perpétuels."
                ),
                "waqf_distribution_rules": (
                    "60 % des revenus nets versés à la famille Sy (enfants du constituant) ; "
                    "40 % affectés à des œuvres caritatives (écoles coraniques et assistance aux orphelins)."
                ),
            },
        )
        acc = self._ensure_account(case, user, "Compte waqf Sy — BIS", "SN012 01201 036000066210 33", 4500000)
        self._add_movement(acc, user, MovementType.INCOME, 650000, "Loyers Médina — 06/2026", dt.date(2026, 6, 10))
        Mandate.objects.get_or_create(
            case=case,
            title="Acte de constitution de waqf — Ababacar Sy",
            defaults={
                "mandate_type": MandateType.WAQF,
                "reference_number": "WAQF-SY-2026-01",
                "issuing_authority": "Haute Autorité du Waqf",
                "signed_at": dt.date(2026, 5, 18),
                "effective_from": dt.date(2026, 5, 20),
                "created_by": user,
            },
        )
        self.stdout.write("  Waqf Sy complété")

    def _complete_zakat(self, case, user, prepared_by):
        donor = case.donors.first()
        if donor and not Beneficiary.objects.filter(case=case).exists():
            for first, gender, rel, birth, share in (
                ("Aïda", "F", RelationToDonorType.SPOUSE, dt.date(1960, 2, 14), D("12.5")),
                ("Modou", "M", RelationToDonorType.CHILD, dt.date(1985, 7, 22), D("29.17")),
                ("Pape", "M", RelationToDonorType.CHILD, dt.date(1989, 11, 5), D("29.17")),
                ("Khady", "F", RelationToDonorType.CHILD, dt.date(1993, 3, 30), D("14.58")),
                ("Fatou", "F", RelationToDonorType.CHILD, dt.date(1996, 8, 19), D("14.58")),
            ):
                Beneficiary.objects.create(
                    case=case,
                    donor=donor,
                    relation_to_donor=rel,
                    gender=gender,
                    first_name=first,
                    last_name="Bâ",
                    date_of_birth=birth,
                    nationality="Sénégalaise",
                    patrimony_share_percent=share,
                )
        ZakatAssessment.objects.get_or_create(
            case=case,
            assessment_year=2026,
            defaults={
                "nisab_amount": D("3500000"),
                "zakatable_wealth": D("51100000"),
                "zakat_due": D("1277500"),
                "status": ZakatAssessmentStatus.REVIEW,
                "prepared_by": prepared_by,
                "notes": (
                    "Assiette : commerce de tissus (28,6 M) + cheptel (23,1 M) − dettes "
                    "d'exploitation. Nisab 2026 appliqué. En revue juridique."
                ),
            },
        )
        self.stdout.write("  Zakat Bâ complété")

    def _complete_toure(self, case, user):
        donor, _ = CaseDonor.objects.get_or_create(
            case=case,
            first_name="Bineta",
            last_name="Touré",
            defaults={
                "date_of_birth": dt.date(1978, 5, 16),
                "nationality": "Sénégalaise / italienne",
                "email": "bineta.toure@email.it",
                "phone": "+39 333 456 7890",
                "address": "Milan, Italie (résidence) — famille à Dakar, Ouakam",
                "notes": "Diaspora — pièces d'identité en attente (passeport + CNI).",
            },
        )
        if not Beneficiary.objects.filter(case=case).exists():
            Beneficiary.objects.create(
                case=case,
                donor=donor,
                relation_to_donor=RelationToDonorType.CHILD,
                first_name="Awa",
                last_name="Touré",
                date_of_birth=dt.date(2008, 1, 9),
                nationality="Sénégalaise",
                is_minor=True,
                patrimony_share_percent=D("100"),
            )
        policy = ensure_case_investment_policy(case)
        if not policy.planned_investment_amount:
            policy.planned_investment_amount = D("45000000")
            policy.amanah_management_share_percent = D("3.00")
            policy.save()
            EnvelopeContribution.objects.create(
                policy=policy,
                amount=D("45000000"),
                previous_total=D("0"),
                new_total=D("45000000"),
                notes="Enveloppe prévisionnelle — en attente de signature.",
                created_by=user,
            )
        self.stdout.write("  Touré (brouillon) complété")

    def _complete_sall(self, case, user):
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
        guardian, _ = Guardian.objects.get_or_create(
            case=case,
            first_name="Aminata",
            last_name="Sall",
            defaults={
                "email": "aminata.sall@gmail.com",
                "phone": "+221 77 444 12 88",
                "relationship_label": "Tante paternelle, tutrice désignée",
            },
        )
        if not Beneficiary.objects.filter(case=case).exists():
            for first, birth, share in (
                ("Ibrahima", dt.date(2014, 6, 18), D("50")),
                ("Sokhna", dt.date(2017, 2, 3), D("50")),
            ):
                Beneficiary.objects.create(
                    case=case,
                    donor=donor,
                    relation_to_donor=RelationToDonorType.CHILD,
                    first_name=first,
                    last_name="Sall",
                    date_of_birth=birth,
                    nationality="Sénégalaise",
                    is_minor=True,
                    guardian=guardian,
                    patrimony_share_percent=share,
                )
        self._ensure_asset(
            case,
            user,
            AssetType.REAL_ESTATE,
            "Maison familiale — Thiès Malick Sy",
            "Thiès, cité Malick Sy",
            [(dt.date(2026, 7, 8), 65000000)],
        )
        self.stdout.write("  Sall (brouillon) complété")

    def _complete_diagne(self, case, user, direction):
        donor, _ = CaseDonor.objects.get_or_create(
            case=case,
            first_name="Serigne",
            last_name="Diagne",
            defaults={
                "date_of_birth": dt.date(1965, 12, 28),
                "nationality": "Sénégalaise",
                "email": "serigne.diagne@gmail.com",
                "phone": "+221 78 901 44 22",
                "address": "Almadies, Dakar",
                "notes": "Introduit via Taysir Finance.",
            },
        )
        if not Beneficiary.objects.filter(case=case).exists():
            Beneficiary.objects.create(
                case=case,
                donor=donor,
                relation_to_donor=RelationToDonorType.CHILD,
                first_name="Oumar",
                last_name="Diagne",
                date_of_birth=dt.date(2001, 4, 14),
                nationality="Sénégalaise",
                patrimony_share_percent=D("100"),
            )
        policy = ensure_case_investment_policy(case)
        if not policy.planned_investment_amount:
            policy.planned_investment_amount = D("75000000")
            policy.amanah_management_share_percent = D("2.50")
            policy.save()
            EnvelopeContribution.objects.create(
                policy=policy,
                amount=D("75000000"),
                previous_total=D("0"),
                new_total=D("75000000"),
                notes="Enveloppe annoncée via Taysir Finance — en attente d'approbation direction.",
                created_by=direction,
            )
        Mandate.objects.get_or_create(
            case=case,
            title="Projet de mandat fiduciaire — Serigne Diagne",
            defaults={
                "mandate_type": MandateType.CONTRACTUAL,
                "reference_number": "MDT-DIAGNE-2026-PROJET",
                "issuing_authority": "SOFIGEPAM / Taysir Finance",
                "created_by": user,
                "notes": "Projet en attente d'approbation direction.",
            },
        )
        self.stdout.write("  Diagne complété")

    def _complete_fall_closed(self, case, user, direction):
        """Dossier clôturé : données historiques figées (lecture seule)."""
        donor, _ = CaseDonor.objects.get_or_create(
            case=case,
            first_name="Fatim",
            last_name="Fall",
            defaults={
                "date_of_birth": dt.date(1952, 8, 11),
                "nationality": "Sénégalaise",
                "address": "Parcelles Assainies, U17, Dakar",
                "notes": "De cujus — succession clôturée le 27 février 2026.",
            },
        )
        if not Beneficiary.objects.filter(case=case).exists():
            for first, gender, rel, birth, share in (
                ("Momar", "M", RelationToDonorType.CHILD, dt.date(1975, 3, 2), D("50")),
                ("Ndèye", "F", RelationToDonorType.CHILD, dt.date(1978, 9, 21), D("25")),
                ("Aïssatou", "F", RelationToDonorType.CHILD, dt.date(1982, 1, 14), D("25")),
            ):
                Beneficiary.objects.create(
                    case=case,
                    donor=donor,
                    relation_to_donor=rel,
                    gender=gender,
                    first_name=first,
                    last_name="Fall",
                    date_of_birth=birth,
                    nationality="Sénégalaise",
                    patrimony_share_percent=share,
                )
        self._ensure_asset(
            case,
            user,
            AssetType.REAL_ESTATE,
            "Villa U17 — Parcelles Assainies (distribuée)",
            "Parcelles Assainies U17, Dakar",
            [
                (dt.date(2025, 8, 10), 95000000),
                (dt.date(2025, 12, 15), 98000000),
                (dt.date(2026, 2, 20), 98000000),
            ],
        )
        self._ensure_asset(
            case,
            user,
            AssetType.BANK_ACCOUNT,
            "Compte succession Fall — BIS (soldé)",
            "Banque Islamique du Sénégal",
            [
                (dt.date(2025, 8, 10), 32000000),
                (dt.date(2025, 12, 31), 18500000),
                (dt.date(2026, 2, 27), 0),
            ],
        )
        acc = self._ensure_account(
            case, user, "Compte succession Fall — BIS (clôturé)", "SN012 01201 036000077300 55", 32000000
        )
        self._add_movement(
            acc, user, MovementType.EXPENSE, 32000000,
            "Distribution finale aux héritiers — clôture", dt.date(2026, 2, 27),
        )
        mandate, created = Mandate.objects.get_or_create(
            case=case,
            title="Mandat successoral Fatim Fall",
            defaults={
                "mandate_type": MandateType.NOTARIAL,
                "reference_number": "MDT-FALL-2025-09",
                "issuing_authority": "Étude Diop & Associés",
                "signed_at": dt.date(2025, 8, 20),
                "effective_from": dt.date(2025, 8, 20),
                "effective_to": dt.date(2026, 2, 27),
                "created_by": user,
                "notes": "Mandat achevé — fonds distribués.",
            },
        )
        if created or not mandate.validations.exists():
            MandateValidation.objects.get_or_create(
                mandate=mandate,
                decision=MandateValidationDecision.APPROVED,
                defaults={
                    "comment": "Partage farāʾiḍ validé et distribution effectuée.",
                    "validated_by": direction,
                },
            )
        assert case.status == CaseStatus.CLOSED
        self.stdout.write("  Succession Fall (clôturée) complétée — lecture seule")
