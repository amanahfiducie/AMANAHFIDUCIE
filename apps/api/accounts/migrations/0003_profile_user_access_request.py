import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("cases", "0004_case_origin"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("accounts", "0002_login_otp_challenge"),
    ]

    operations = [
        migrations.CreateModel(
            name="ProfileUserAccessRequest",
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
                ("profile_type", models.CharField(max_length=32)),
                ("profile_id", models.PositiveIntegerField()),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("PENDING", "En attente"),
                            ("APPROVED", "Validé"),
                            ("REJECTED", "Refusé"),
                        ],
                        default="PENDING",
                        max_length=16,
                    ),
                ),
                ("email", models.EmailField(blank=True, max_length=254)),
                ("phone", models.CharField(blank=True, max_length=64)),
                ("display_name", models.CharField(blank=True, max_length=255)),
                ("preview_status", models.CharField(blank=True, max_length=32)),
                ("review_notes", models.TextField(blank=True)),
                ("reviewed_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "case",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="profile_access_requests",
                        to="cases.fiduciarycase",
                    ),
                ),
                (
                    "created_user",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="profile_access_requests_created",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "existing_user",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="profile_access_requests_as_existing",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "requested_by",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="profile_access_requests_submitted",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "reviewed_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="profile_access_requests_reviewed",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ("-created_at",),
            },
        ),
        migrations.AddIndex(
            model_name="profileuseraccessrequest",
            index=models.Index(
                fields=["status", "created_at"],
                name="accounts_pr_status_0b0e0d_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="profileuseraccessrequest",
            index=models.Index(
                fields=["case", "profile_type", "profile_id"],
                name="accounts_pr_case_id_8f3a21_idx",
            ),
        ),
        migrations.AddConstraint(
            model_name="profileuseraccessrequest",
            constraint=models.UniqueConstraint(
                condition=models.Q(("status", "PENDING")),
                fields=("case", "profile_type", "profile_id"),
                name="accounts_profileaccessreq_pending_uniq",
            ),
        ),
    ]
