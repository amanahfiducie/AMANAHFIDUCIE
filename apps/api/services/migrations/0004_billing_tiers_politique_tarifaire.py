from django.db import migrations, models


def add_missing_columns(apps, schema_editor):
    """Idempotent : certaines colonnes existent déjà hors historique Django."""
    table = "services_servicebillingrule"
    connection = schema_editor.connection
    with connection.cursor() as cursor:
        existing = {
            col.name
            for col in connection.introspection.get_table_description(cursor, table)
        }

    fields = {
        "base_min": models.DecimalField(
            max_digits=18,
            decimal_places=2,
            null=True,
            blank=True,
            help_text="Tranche basse de la base (AUM / patrimoine) incluse.",
        ),
        "base_max": models.DecimalField(
            max_digits=18,
            decimal_places=2,
            null=True,
            blank=True,
            help_text=(
                "Tranche haute de la base (AUM / patrimoine) incluse ; "
                "vide = pas de plafond."
            ),
        ),
        "fixed_amount_min": models.DecimalField(
            max_digits=14,
            decimal_places=2,
            null=True,
            blank=True,
            help_text="Borne basse du forfait (fourchette politique tarifaire).",
        ),
        "fixed_amount_max": models.DecimalField(
            max_digits=14,
            decimal_places=2,
            null=True,
            blank=True,
            help_text="Borne haute du forfait (fourchette politique tarifaire).",
        ),
    }

    ServiceBillingRule = apps.get_model("services", "ServiceBillingRule")
    for name, field in fields.items():
        if name in existing:
            continue
        field.set_attributes_from_name(name)
        schema_editor.add_field(ServiceBillingRule, field)


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("services", "0003_case_billing_charge"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.AddField(
                    model_name="servicebillingrule",
                    name="base_max",
                    field=models.DecimalField(
                        blank=True,
                        decimal_places=2,
                        help_text=(
                            "Tranche haute de la base (AUM / patrimoine) incluse ; "
                            "vide = pas de plafond."
                        ),
                        max_digits=18,
                        null=True,
                    ),
                ),
                migrations.AddField(
                    model_name="servicebillingrule",
                    name="base_min",
                    field=models.DecimalField(
                        blank=True,
                        decimal_places=2,
                        help_text="Tranche basse de la base (AUM / patrimoine) incluse.",
                        max_digits=18,
                        null=True,
                    ),
                ),
                migrations.AddField(
                    model_name="servicebillingrule",
                    name="fixed_amount_max",
                    field=models.DecimalField(
                        blank=True,
                        decimal_places=2,
                        help_text="Borne haute du forfait (fourchette politique tarifaire).",
                        max_digits=14,
                        null=True,
                    ),
                ),
                migrations.AddField(
                    model_name="servicebillingrule",
                    name="fixed_amount_min",
                    field=models.DecimalField(
                        blank=True,
                        decimal_places=2,
                        help_text="Borne basse du forfait (fourchette politique tarifaire).",
                        max_digits=14,
                        null=True,
                    ),
                ),
            ],
            database_operations=[
                migrations.RunPython(add_missing_columns, noop_reverse),
            ],
        ),
    ]
