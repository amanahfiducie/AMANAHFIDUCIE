from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("beneficiaries", "0006_beneficiary_patrimony_share"),
    ]

    operations = [
        migrations.AddField(
            model_name="beneficiary",
            name="gender",
            field=models.CharField(
                blank=True,
                choices=[("M", "Homme"), ("F", "Femme")],
                help_text="Sexe (succession : fils / fille pour le farāʾiḍ).",
                max_length=1,
            ),
        ),
        migrations.AddField(
            model_name="beneficiary",
            name="father",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=models.SET_NULL,
                related_name="children_as_father",
                to="beneficiaries.beneficiary",
            ),
        ),
        migrations.AddField(
            model_name="beneficiary",
            name="mother",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=models.SET_NULL,
                related_name="children_as_mother",
                to="beneficiaries.beneficiary",
            ),
        ),
    ]
