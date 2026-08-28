from django.db import migrations


def drop_legacy_evaluation_frequency(apps, schema_editor):
  if schema_editor.connection.vendor != "postgresql":
    return
  with schema_editor.connection.cursor() as cursor:
    cursor.execute(
      """
      SELECT 1
      FROM information_schema.columns
      WHERE table_name = 'assets_asset'
        AND column_name = 'evaluation_frequency'
      """
    )
    if cursor.fetchone():
      cursor.execute("ALTER TABLE assets_asset DROP COLUMN evaluation_frequency")


class Migration(migrations.Migration):
  dependencies = [
    ("assets", "0006_asseteventcategory_billing"),
  ]

  operations = [
    migrations.RunPython(
      drop_legacy_evaluation_frequency,
      migrations.RunPython.noop,
    ),
  ]
