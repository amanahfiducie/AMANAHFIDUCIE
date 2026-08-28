from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("investments", "0003_investmentparticipant"),
    ]

    operations = [
        migrations.AddField(
            model_name="investment",
            name="risk_summary",
            field=models.TextField(
                blank=True,
                help_text="Risques identifiés pour cet investissement.",
            ),
        ),
    ]
