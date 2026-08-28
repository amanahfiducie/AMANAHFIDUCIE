from django.db import migrations


def seed_templates(apps, schema_editor):
    ReportTemplate = apps.get_model("reports", "ReportTemplate")
    templates = [
        (
            "trimestriel-famille",
            "Rapport trimestriel famille",
            "QUARTERLY_FAMILY_REPORT",
        ),
        (
            "semestriel-notaire-juge",
            "Rapport semestriel notaire / juge",
            "SEMI_ANNUAL_NOTARY_JUDGE_REPORT",
        ),
        (
            "annuel-gestion",
            "Rapport annuel de gestion",
            "ANNUAL_MANAGEMENT_REPORT",
        ),
        ("charia", "Rapport charaïque", "CHARIA_COMPLIANCE_REPORT"),
        ("impact", "Rapport d'impact", "IMPACT_REPORT"),
        ("cloture", "Rapport final de clôture", "FINAL_CLOSING_REPORT"),
    ]
    for slug, name, report_type in templates:
        ReportTemplate.objects.get_or_create(
            slug=slug,
            defaults={
                "name": name,
                "report_type": report_type,
                "description": name,
                "is_active": True,
            },
        )


class Migration(migrations.Migration):
    dependencies = [
        ("reports", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(seed_templates, migrations.RunPython.noop),
    ]
