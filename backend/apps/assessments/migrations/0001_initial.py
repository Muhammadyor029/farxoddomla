import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ("curriculum", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="Achievement",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("code", models.SlugField(max_length=80, unique=True)),
                ("title", models.CharField(max_length=160)),
                ("description", models.TextField()),
                ("xp_threshold", models.PositiveIntegerField(default=100)),
                ("badge_type", models.CharField(default="shield", max_length=32)),
            ],
            options={"ordering": ["xp_threshold"]},
        ),
        migrations.CreateModel(
            name="Game",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("slug", models.SlugField(max_length=80, unique=True)),
                ("title", models.CharField(max_length=160)),
                ("subtitle", models.CharField(max_length=260)),
                ("rules", models.TextField()),
                ("educational_goal", models.TextField()),
                ("is_simulation", models.BooleanField(default=False)),
                ("xp_reward", models.PositiveIntegerField(default=100)),
                ("difficulty", models.CharField(default="O'rta", max_length=32)),
            ],
        ),
        migrations.CreateModel(
            name="Quiz",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("title", models.CharField(max_length=260)),
                ("time_limit_minutes", models.PositiveSmallIntegerField(default=12)),
                ("status", models.CharField(default="verified", max_length=20)),
                (
                    "grade",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="quizzes",
                        to="curriculum.grade",
                    ),
                ),
                (
                    "lesson",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="quiz",
                        to="curriculum.lesson",
                    ),
                ),
            ],
        ),
        migrations.CreateModel(
            name="Question",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("order", models.PositiveSmallIntegerField(default=1)),
                (
                    "question_type",
                    models.CharField(
                        choices=[
                            ("single", "Bitta javob"),
                            ("multiple", "Ko'p javob"),
                            ("true_false", "To'g'ri/Noto'g'ri"),
                            ("matching", "Moslashtirish"),
                            ("ordering", "Ketma-ketlik"),
                            ("case", "Vaziyatli savol"),
                            ("visual", "Vizual savol"),
                        ],
                        default="single",
                        max_length=24,
                    ),
                ),
                ("prompt", models.TextField()),
                ("correct_answer_json", models.JSONField(default=dict)),
                ("match_pairs_json", models.JSONField(blank=True, default=list)),
                ("diagram_kind", models.CharField(blank=True, default="", max_length=60)),
                ("explanation", models.TextField()),
                ("points", models.PositiveSmallIntegerField(default=10)),
                (
                    "quiz",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="questions",
                        to="assessments.quiz",
                    ),
                ),
            ],
            options={"ordering": ["order"]},
        ),
        migrations.CreateModel(
            name="AnswerOption",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("order", models.PositiveSmallIntegerField(default=1)),
                ("option_text", models.TextField()),
                ("is_correct", models.BooleanField(default=False)),
                (
                    "question",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="options",
                        to="assessments.question",
                    ),
                ),
            ],
            options={"ordering": ["order"]},
        ),
        migrations.CreateModel(
            name="QuizAttempt",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("grade_number", models.PositiveSmallIntegerField(default=9)),
                ("score", models.PositiveIntegerField(default=0)),
                ("max_score", models.PositiveIntegerField(default=100)),
                ("percentage", models.FloatField(default=0.0)),
                ("elapsed_seconds", models.PositiveIntegerField(default=60)),
                ("correct_count", models.PositiveIntegerField(default=0)),
                ("total_questions", models.PositiveIntegerField(default=10)),
                ("recommendations_json", models.JSONField(default=list)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "quiz",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="attempts",
                        to="assessments.quiz",
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="quiz_attempts",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.CreateModel(
            name="GameAttempt",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("grade_number", models.PositiveSmallIntegerField(default=9)),
                ("score", models.PositiveIntegerField(default=0)),
                ("max_score", models.PositiveIntegerField(default=100)),
                ("xp_earned", models.PositiveIntegerField(default=0)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "game",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="attempts",
                        to="assessments.game",
                    ),
                ),
                (
                    "lesson",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        to="curriculum.lesson",
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="game_attempts",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.CreateModel(
            name="Assignment",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("title", models.CharField(max_length=240)),
                ("description", models.TextField()),
                ("grade_number", models.PositiveSmallIntegerField(default=9)),
                ("due_date", models.CharField(max_length=32)),
                ("teacher_name", models.CharField(max_length=160)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "lesson",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        to="curriculum.lesson",
                    ),
                ),
                (
                    "teacher",
                    models.ForeignKey(
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="created_assignments",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.CreateModel(
            name="StudentProgress",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("completed", models.BooleanField(default=True)),
                ("quiz_best_score", models.PositiveSmallIntegerField(default=0)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "lesson",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="student_progress",
                        to="curriculum.lesson",
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="lesson_progress",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={"unique_together": {("user", "lesson")}},
        ),
        migrations.CreateModel(
            name="AssignmentSubmission",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("answer_text", models.TextField()),
                ("score", models.PositiveSmallIntegerField(blank=True, null=True)),
                ("feedback", models.TextField(blank=True, default="")),
                ("submitted_at", models.DateTimeField(auto_now=True)),
                (
                    "assignment",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="submissions",
                        to="assessments.assignment",
                    ),
                ),
                (
                    "student",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="assignment_submissions",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={"unique_together": {("assignment", "student")}},
        ),
    ]
