from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("cases", "0003_case_assignment"),
    ]

    operations = [
        migrations.AddField(
            model_name="fiduciarycase",
            name="case_origin",
            field=models.CharField(
                blank=True,
                choices=[
                    ("FAMILY_REQUEST", "Demande familiale"),
                    ("NOTARY", "Notaire"),
                    ("COURT", "Juridiction / tribunal"),
                    ("PARTNER", "Partenaire institutionnel"),
                    ("INTERNAL", "Initiative interne SOFIGEPAM"),
                    ("DIRECT_CONTACT", "Prise de contact directe"),
                    ("OTHER", "Autre"),
                ],
                help_text="Origine / provenance du dossier.",
                max_length=32,
            ),
        ),
    ]
