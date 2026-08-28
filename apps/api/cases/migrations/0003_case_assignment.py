import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


def backfill_assignments(apps, schema_editor):
    FiduciaryCase = apps.get_model("cases", "FiduciaryCase")
    CaseAssignment = apps.get_model("cases", "CaseAssignment")
    for case in FiduciaryCase.objects.filter(assigned_to_id__isnull=False).iterator():
        if CaseAssignment.objects.filter(case_id=case.pk, ended_at__isnull=True).exists():
            continue
        CaseAssignment.objects.create(
            case_id=case.pk,
            user_id=case.assigned_to_id,
            assigned_by_id=case.created_by_id,
            started_at=case.created_at,
            ended_at=None,
        )


class Migration(migrations.Migration):

    dependencies = [
        ("cases", "0002_case_type_onboarding"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="CaseAssignment",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("started_at", models.DateTimeField()),
                ("ended_at", models.DateTimeField(blank=True, null=True)),
                (
                    "assigned_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="case_assignments_made",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "case",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="assignment_history",
                        to="cases.fiduciarycase",
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="case_assignments",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "verbose_name": "Chargé de dossier (période)",
                "verbose_name_plural": "Chargés de dossier (historique)",
                "ordering": ("-started_at",),
            },
        ),
        migrations.RunPython(backfill_assignments, migrations.RunPython.noop),
    ]
