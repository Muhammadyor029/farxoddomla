import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="Subject",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=160)),
                ("code", models.CharField(max_length=40, unique=True)),
                ("description", models.TextField()),
            ],
        ),
        migrations.CreateModel(
            name="Grade",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("grade_number", models.PositiveSmallIntegerField(unique=True)),
                ("title", models.CharField(max_length=120)),
                ("subtitle", models.CharField(max_length=200)),
                ("description", models.TextField()),
                ("textbook_title", models.CharField(max_length=240)),
                ("textbook_year", models.CharField(max_length=32)),
                ("textbook_authors", models.CharField(max_length=240)),
                ("pdf_path", models.CharField(max_length=300)),
                ("total_pages", models.PositiveIntegerField(default=160)),
                (
                    "subject",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="grades",
                        to="curriculum.subject",
                    ),
                ),
            ],
            options={"ordering": ["grade_number"]},
        ),
        migrations.CreateModel(
            name="Chapter",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("chapter_number", models.PositiveSmallIntegerField()),
                ("roman_numeral", models.CharField(max_length=12)),
                ("title", models.CharField(max_length=240)),
                ("description", models.TextField()),
                ("page_range", models.CharField(max_length=60)),
                (
                    "grade",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="chapters",
                        to="curriculum.grade",
                    ),
                ),
            ],
            options={"ordering": ["grade__grade_number", "chapter_number"]},
        ),
        migrations.CreateModel(
            name="Lesson",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("slug", models.SlugField(max_length=160, unique=True)),
                ("lesson_number_label", models.CharField(max_length=60)),
                ("order_index", models.PositiveIntegerField(default=1)),
                ("title", models.CharField(max_length=260)),
                ("summary", models.TextField()),
                ("page_number", models.PositiveIntegerField(default=1)),
                ("estimated_minutes", models.PositiveSmallIntegerField(default=45)),
                (
                    "status",
                    models.CharField(
                        choices=[("verified", "Tasdiqlangan"), ("draft", "Qoralama")],
                        default="verified",
                        max_length=20,
                    ),
                ),
                (
                    "chapter",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="lessons",
                        to="curriculum.chapter",
                    ),
                ),
                (
                    "grade",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="lessons",
                        to="curriculum.grade",
                    ),
                ),
            ],
            options={"ordering": ["grade__grade_number", "order_index"]},
        ),
        migrations.CreateModel(
            name="LessonContent",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("content_json", models.JSONField(default=dict)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "lesson",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="content",
                        to="curriculum.lesson",
                    ),
                ),
            ],
        ),
        migrations.CreateModel(
            name="LegalTerm",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("term", models.CharField(max_length=160)),
                ("short_definition", models.TextField()),
                ("extended_note", models.TextField()),
                ("life_example", models.TextField()),
                ("source_page", models.CharField(max_length=100)),
                (
                    "grade",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="legal_terms",
                        to="curriculum.grade",
                    ),
                ),
                (
                    "lesson",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="terms",
                        to="curriculum.lesson",
                    ),
                ),
            ],
            options={"ordering": ["term"]},
        ),
        migrations.CreateModel(
            name="LegalScenario",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("category", models.CharField(max_length=80)),
                ("title", models.CharField(max_length=240)),
                ("scenario_json", models.JSONField(default=dict)),
                (
                    "grade",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="scenarios",
                        to="curriculum.grade",
                    ),
                ),
            ],
            options={"ordering": ["id"]},
        ),
        migrations.CreateModel(
            name="LegislationArticle",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("code_name", models.CharField(max_length=160)),
                ("article_number", models.CharField(max_length=60)),
                ("title", models.CharField(max_length=240)),
                ("summary_text", models.TextField()),
                ("practical_meaning", models.TextField()),
                ("source_page", models.CharField(max_length=100)),
                (
                    "grade",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="legislation_articles",
                        to="curriculum.grade",
                    ),
                ),
            ],
            options={"ordering": ["id"]},
        ),
        migrations.CreateModel(
            name="Resource",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("title", models.CharField(max_length=240)),
                ("resource_type", models.CharField(default="pdf_textbook", max_length=40)),
                ("file_url", models.CharField(max_length=300)),
                ("description", models.TextField()),
                (
                    "grade",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="resources",
                        to="curriculum.grade",
                    ),
                ),
            ],
        ),
    ]
