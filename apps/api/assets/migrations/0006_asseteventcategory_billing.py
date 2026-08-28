from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("assets", "0005_asseteventcategory"),
    ]

    operations = [
        migrations.AddField(
            model_name="asseteventcategory",
            name="billing_kind",
            field=models.CharField(
                choices=[("FIXED", "Fixe"), ("VARIABLE", "Variable")],
                default="VARIABLE",
                max_length=16,
            ),
        ),
        migrations.AddField(
            model_name="asseteventcategory",
            name="default_amount",
            field=models.DecimalField(
                blank=True,
                decimal_places=2,
                max_digits=18,
                null=True,
            ),
        ),
    ]
