from django.db import migrations, models

import assets.models


class Migration(migrations.Migration):

    dependencies = [
        ("assets", "0003_assetevent"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="assetevent",
            name="justification",
        ),
        migrations.AddField(
            model_name="assetevent",
            name="justification_file",
            field=models.FileField(
                blank=True,
                upload_to=assets.models.asset_event_justification_upload_path,
            ),
        ),
    ]
