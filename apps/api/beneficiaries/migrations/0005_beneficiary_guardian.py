from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("beneficiaries", "0004_alter_donortrustedperson_relationship_label"),
    ]

    operations = [
        migrations.AddField(
            model_name="beneficiary",
            name="guardian",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="beneficiaries",
                to="beneficiaries.guardian",
            ),
        ),
    ]
