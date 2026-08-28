from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("validations", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="validationstep",
            name="step_label",
            field=models.CharField(blank=True, max_length=120),
        ),
        migrations.AlterField(
            model_name="validationrequest",
            name="validation_type",
            field=models.CharField(
                choices=[
                    ("LEGAL", "Juridique"),
                    ("ACCOUNTING", "Comptable"),
                    ("MANAGEMENT", "Direction"),
                    ("CHARIA", "Charaïque"),
                    ("AUDIT", "Audit"),
                    ("CASE_REVIEW", "Circuit dossier"),
                ],
                max_length=32,
            ),
        ),
    ]
