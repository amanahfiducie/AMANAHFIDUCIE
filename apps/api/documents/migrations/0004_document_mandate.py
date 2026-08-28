import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("mandates", "0001_initial"),
        ("documents", "0003_document_beneficiary_guardian"),
    ]

    operations = [
        migrations.AddField(
            model_name="document",
            name="mandate",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="documents",
                to="mandates.mandate",
            ),
        ),
    ]
