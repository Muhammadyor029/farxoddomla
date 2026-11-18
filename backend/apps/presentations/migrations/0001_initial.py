import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ("curriculum", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="Presentation",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("title", models.CharField(max_length=260)),
                ("template_name", models.CharField(default="Huquq Olami Neon-Grafit", max_length=120)),
                ("status", models.CharField(default="verified", max_length=20)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "grade",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="presentations",
                        to="curriculum.grade",
                    ),
                ),
                (
                    "lesson",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="presentation",
                        to="curriculum.lesson",
                    ),
                ),
            ],
        ),
        migrations.CreateModel(
            name="PresentationSlide",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("order", models.PositiveSmallIntegerField(default=1)),
                ("layout", models.CharField(default="title", max_length=40)),
                ("title", models.CharField(max_length=260)),
                ("subtitle", models.CharField(blank=True, default="", max_length=260)),
                ("bullets_json", models.JSONField(default=list)),
                ("table_rows_json", models.JSONField(blank=True, default=list)),
                ("diagram_kind", models.CharField(blank=True, default="", max_length=60)),
                ("image_url", models.CharField(blank=True, default="", max_length=300)),
                ("accent_color", models.CharField(default="#39FF55", max_length=24)),
                ("background_tone", models.CharField(default="obsidian", max_length=32)),
                ("speaker_notes", models.TextField(blank=True, default="")),
                (
                    "presentation",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="slides",
                        to="presentations.presentation",
                    ),
                ),
            ],
            options={"ordering": ["order"]},
        ),
    ]
