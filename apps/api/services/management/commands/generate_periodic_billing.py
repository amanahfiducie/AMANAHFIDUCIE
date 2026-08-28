"""Génère les brouillons d'honoraires périodiques (annuel / trimestriel)."""

from __future__ import annotations

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError

from services.periodic import generate_periodic_charges


class Command(BaseCommand):
    help = (
        "Crée des charges d'honoraires brouillon pour les dossiers ACTIVE "
        "selon les règles annuelles/trimestrielles du catalogue Services."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--period",
            default="",
            help="Libellé de période (ex. 2026 ou 2026-Q1). Défaut = année/trimestre courant.",
        )
        parser.add_argument(
            "--case-type",
            default="",
            help="Filtrer un type de service (ex. MANDAT_FIDUCIAIRE).",
        )
        parser.add_argument(
            "--user",
            default="",
            help="Username de l'acteur (défaut : premier superuser / staff).",
        )
        parser.add_argument(
            "--post",
            action="store_true",
            help="Comptabiliser immédiatement en recette entreprise.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Simuler sans créer de charges.",
        )

    def handle(self, *args, **options):
        User = get_user_model()
        username = options["user"]
        if username:
            actor = User.objects.filter(username=username).first()
            if actor is None:
                raise CommandError(f"Utilisateur inconnu : {username}")
        else:
            actor = (
                User.objects.filter(is_superuser=True).order_by("pk").first()
                or User.objects.filter(is_staff=True).order_by("pk").first()
            )
            if actor is None:
                raise CommandError(
                    "Aucun utilisateur acteur : passez --user <username>."
                )

        case_type = (options["case_type"] or "").strip() or None
        result = generate_periodic_charges(
            case_type=case_type,
            actor=actor,
            period_label=options["period"] or "",
            post=bool(options["post"]),
            dry_run=bool(options["dry_run"]),
        )

        self.stdout.write(
            f"Créées : {len(result.created)} · Ignorées : {len(result.skipped)} · "
            f"Erreurs : {len(result.errors)}"
        )
        for item in result.created[:20]:
            self.stdout.write(
                f"  + {item.get('reference')} · {item.get('rule_label')} · "
                f"{item.get('period_label')} · {item.get('amount') or 'dry-run'}"
            )
        for item in result.errors[:20]:
            self.stdout.write(
                self.style.ERROR(
                    f"  ! {item.get('reference')} · {item.get('error')}"
                )
            )
        if result.errors and not result.created:
            raise CommandError("Aucune charge créée ; voir les erreurs ci-dessus.")
        self.stdout.write(self.style.SUCCESS("Terminé."))
