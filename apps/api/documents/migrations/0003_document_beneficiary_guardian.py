import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("beneficiaries", "0005_beneficiary_guardian"),
        ("documents", "0002_document_donor_document_identity_kind"),
    ]

    operations = [
        migrations.AddField(
            model_name="document",
            name="beneficiary",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="documents",
                to="beneficiaries.beneficiary",
            ),
        ),
        migrations.AddField(
            model_name="document",
            name="guardian",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="documents",
                to="beneficiaries.guardian",
            ),
        ),
    ]
