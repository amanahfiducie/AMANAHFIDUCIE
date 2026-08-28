from django.db import migrations, models


def reseed_forward(apps, schema_editor):
    connection = schema_editor.connection
    table = "services_servicebillingrule"
    with connection.cursor() as cursor:
        existing = {
            col.name
            for col in connection.introspection.get_table_description(cursor, table)
        }

    # Colonne legacy jsonb NOT NULL (Postgres) — absente sur SQLite jusqu'ici.
    if "tiers" not in existing:
        ServiceBillingRule = apps.get_model("services", "ServiceBillingRule")
        field = models.JSONField(default=list, blank=True)
        field.set_attributes_from_name("tiers")
        schema_editor.add_field(ServiceBillingRule, field)
    elif connection.vendor == "postgresql":
        with connection.cursor() as cursor:
            cursor.execute(
                """
                ALTER TABLE services_servicebillingrule
                ALTER COLUMN tiers SET DEFAULT '[]'::jsonb
                """
            )
            cursor.execute(
                """
                UPDATE services_servicebillingrule
                SET tiers = '[]'::jsonb
                WHERE tiers IS NULL
                """
            )

    from services.seed import seed_service_catalog

    seed_service_catalog(reset_rules=True)


def reseed_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("services", "0004_billing_tiers_politique_tarifaire"),
    ]

    operations = [
        migrations.RunPython(reseed_forward, reseed_reverse),
    ]
