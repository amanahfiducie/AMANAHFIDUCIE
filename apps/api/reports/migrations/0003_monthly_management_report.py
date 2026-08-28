from django.db import migrations, models


def seed_monthly_template(apps, schema_editor):
    ReportTemplate = apps.get_model("reports", "ReportTemplate")
    ReportTemplate.objects.get_or_create(
        slug="mensuel-gestion",
        defaults={
            "name": "Rapport mensuel de gestion",
            "report_type": "MONTHLY_MANAGEMENT_REPORT",
            "description": "Rapport de gestion mensuel — finance, patrimoine, investissements.",
            "is_active": True,
        },
    )


class Migration(migrations.Migration):
    dependencies = [
        ("reports", "0002_seed_report_templates"),
    ]

    operations = [
        migrations.AlterField(
            model_name="report",
            name="report_type",
            field=models.CharField(
                choices=[
                    ("MONTHLY_MANAGEMENT_REPORT", "Rapport mensuel de gestion"),
                    ("QUARTERLY_FAMILY_REPORT", "Rapport trimestriel famille"),
                    (
                        "SEMI_ANNUAL_NOTARY_JUDGE_REPORT",
                        "Rapport semestriel notaire / juge",
                    ),
                    ("ANNUAL_MANAGEMENT_REPORT", "Rapport annuel de gestion"),
                    ("CHARIA_COMPLIANCE_REPORT", "Rapport charaïque"),
                    ("IMPACT_REPORT", "Rapport d'impact"),
                    ("FINAL_CLOSING_REPORT", "Rapport final de clôture"),
                ],
                max_length=64,
            ),
        ),
        migrations.AlterField(
            model_name="reporttemplate",
            name="report_type",
            field=models.CharField(
                choices=[
                    ("MONTHLY_MANAGEMENT_REPORT", "Rapport mensuel de gestion"),
                    ("QUARTERLY_FAMILY_REPORT", "Rapport trimestriel famille"),
                    (
                        "SEMI_ANNUAL_NOTARY_JUDGE_REPORT",
                        "Rapport semestriel notaire / juge",
                    ),
                    ("ANNUAL_MANAGEMENT_REPORT", "Rapport annuel de gestion"),
                    ("CHARIA_COMPLIANCE_REPORT", "Rapport charaïque"),
                    ("IMPACT_REPORT", "Rapport d'impact"),
                    ("FINAL_CLOSING_REPORT", "Rapport final de clôture"),
                ],
                max_length=64,
            ),
        ),
        migrations.RunPython(seed_monthly_template, migrations.RunPython.noop),
    ]
