from django.core.management.base import BaseCommand

from accounts.emails import send_login_otp_email
from config.env_loader import load_project_env, smtp_credentials_valid


class Command(BaseCommand):
    help = "Teste l'envoi d'un code OTP par e-mail (SMTP uniquement)."

    def add_arguments(self, parser):
        parser.add_argument(
            "email",
            nargs="?",
            default="",
            help="Adresse destinataire (ex. votre e-mail de connexion)",
        )

    def handle(self, *args, **options):
        load_project_env()
        to = (options["email"] or "").strip()
        if not to:
            self.stderr.write("Usage: python manage.py test_otp_email vous@exemple.com")
            return

        self.stdout.write(f"SMTP configuré : {smtp_credentials_valid()}")
        try:
            result = send_login_otp_email(
                to_email=to,
                code="123456",
                display_name="Test",
                expires_minutes=10,
            )
        except Exception as exc:
            self.stderr.write(self.style.ERROR(f"Échec : {exc}"))
            return

        dest = result.delivered_to or to
        if dest.lower() != to.lower():
            self.stdout.write(
                self.style.WARNING(
                    f"Mode test Resend : code 123456 envoyé à {dest} (compte {to})."
                )
            )
        else:
            self.stdout.write(
                self.style.SUCCESS(f"Code test envoyé à {dest} (123456).")
            )
