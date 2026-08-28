from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("investments", "0004_investment_risk_summary"),
    ]

    operations = [
        migrations.AddField(
            model_name="caseinvestmentpolicy",
            name="planned_investment_amount",
            field=models.DecimalField(
                blank=True,
                decimal_places=2,
                help_text="Enveloppe patrimoniale cible à investir pour ce dossier.",
                max_digits=16,
                null=True,
            ),
        ),
        migrations.AddField(
            model_name="caseinvestmentpolicy",
            name="amanah_management_share_percent",
            field=models.DecimalField(
                blank=True,
                decimal_places=2,
                help_text="Part AMANAH (%) sur la gestion du patrimoine.",
                max_digits=5,
                null=True,
            ),
        ),
        migrations.AddField(
            model_name="caseinvestmentpolicy",
            name="scheduled_payments",
            field=models.JSONField(
                blank=True,
                default=list,
                help_text="Versements planifiés : [{date, amount, label, status}].",
            ),
        ),
    ]
