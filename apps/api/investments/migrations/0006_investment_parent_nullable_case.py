from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("investments", "0005_caseinvestmentpolicy_gestion_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="investment",
            name="parent",
            field=models.ForeignKey(
                blank=True,
                help_text="Investissement parent (enveloppe) dont cette ligne est une allocation dossier.",
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="allocations",
                to="investments.investment",
            ),
        ),
        migrations.AlterField(
            model_name="investment",
            name="case",
            field=models.ForeignKey(
                blank=True,
                help_text="Dossier client. Vide = investissement pas encore alloué à un dossier.",
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="investments",
                to="cases.fiduciarycase",
            ),
        ),
    ]
