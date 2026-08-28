"""Diagnostic connexion : python manage.py diagnose_user_login H000001 --password '...'"""

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from accounts.login_otp import (
    resolve_user_by_identifier,
    resolve_user_by_identifier_including_inactive,
    start_login_challenge,
)

User = get_user_model()


class Command(BaseCommand):
    help = "Vérifie qu'un compte peut se connecter (mot de passe, e-mail, statut actif)."

    def add_arguments(self, parser):
        parser.add_argument("identifier", help="Identifiant, e-mail ou téléphone")
        parser.add_argument(
            "--password",
            default="",
            help="Mot de passe à tester",
        )
        parser.add_argument(
            "--try-otp",
            action="store_true",
            help="Tenter l'envoi OTP (nécessite SMTP configuré)",
        )

    def handle(self, *args, **options):
        ident = options["identifier"]
        password = options["password"]

        inactive = resolve_user_by_identifier_including_inactive(ident)
        if inactive is None:
            self.stderr.write(self.style.ERROR(f"Aucun compte pour : {ident!r}"))
            return

        self.stdout.write(f"Utilisateur : {inactive.username} (id={inactive.pk})")
        self.stdout.write(f"E-mail      : {inactive.email!r}")
        self.stdout.write(f"Actif       : {inactive.is_active}")
        profile = getattr(inactive, "profile", None)
        if profile:
            self.stdout.write(f"Téléphone   : {profile.phone!r}")

        if not inactive.is_active:
            self.stderr.write(
                self.style.WARNING("Compte bloqué — débloquez-le dans Utilisateurs.")
            )

        if not (inactive.email or "").strip():
            self.stderr.write(
                self.style.ERROR("Pas d'e-mail — connexion impossible (OTP requis).")
            )

        if password:
            ok = inactive.check_password(password)
            self.stdout.write(
                self.style.SUCCESS("Mot de passe OK")
                if ok
                else self.style.ERROR("Mot de passe incorrect pour ce compte")
            )
            if not ok:
                self.stdout.write(
                    "Si le mot de passe vient d'un ancien e-mail d'invitation, "
                    "réinitialisez-le (Utilisateurs → icône clé ou reset-password)."
                )

        active = resolve_user_by_identifier(ident)
        if active is None and inactive.is_active:
            self.stderr.write(self.style.ERROR("Résolution connexion : échec inattendu."))
        elif active:
            self.stdout.write(self.style.SUCCESS("Identifiant reconnu pour la connexion."))

        if options["try_otp"] and password and inactive.is_active:
            try:
                challenge = start_login_challenge(ident, password)
                self.stdout.write(
                    self.style.SUCCESS(f"OTP créé (token {challenge.token})")
                )
                dev = getattr(challenge, "dev_code", None)
                if dev:
                    self.stdout.write(f"Code dev : {dev}")
            except ValueError as exc:
                self.stderr.write(self.style.ERROR(f"Connexion refusée : {exc}"))
            except Exception as exc:
                self.stderr.write(self.style.ERROR(f"OTP : {exc}"))
