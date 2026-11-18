import django.db.models.deletion
import django.utils.timezone
from django.conf import settings
from django.db import migrations, models

import apps.accounts.models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ("auth", "0012_alter_user_first_name_max_length"),
    ]

    operations = [
        migrations.CreateModel(
            name="User",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("password", models.CharField(max_length=128, verbose_name="password")),
                ("last_login", models.DateTimeField(blank=True, null=True, verbose_name="last login")),
                ("is_superuser", models.BooleanField(default=False, verbose_name="superuser status")),
                ("first_name", models.CharField(blank=True, max_length=150, verbose_name="first name")),
                ("last_name", models.CharField(blank=True, max_length=150, verbose_name="last name")),
                ("is_staff", models.BooleanField(default=False, verbose_name="staff status")),
                ("is_active", models.BooleanField(default=True, verbose_name="active")),
                ("date_joined", models.DateTimeField(default=django.utils.timezone.now, verbose_name="date joined")),
                ("email", models.EmailField(max_length=254, unique=True, verbose_name="Email")),
                ("full_name", models.CharField(max_length=160, verbose_name="To'liq ism-familiya")),
                (
                    "role",
                    models.CharField(
                        choices=[("student", "O'quvchi"), ("teacher", "O'qituvchi"), ("admin", "Administrator")],
                        default="student",
                        max_length=20,
                        verbose_name="Rol",
                    ),
                ),
                ("grade_number", models.PositiveSmallIntegerField(default=9, verbose_name="Sinf")),
                ("class_name", models.CharField(default="9-A", max_length=40, verbose_name="Sinf guruhi")),
                ("school_name", models.CharField(default="O'zbekiston umumta'lim maktabi", max_length=200, verbose_name="Maktab")),
                ("xp", models.PositiveIntegerField(default=0, verbose_name="XP ball")),
                ("level", models.PositiveIntegerField(default=1, verbose_name="Daraja")),
                ("streak_days", models.PositiveIntegerField(default=1, verbose_name="Ketma-ket kunlar")),
                (
                    "groups",
                    models.ManyToManyField(
                        blank=True,
                        related_name="user_set",
                        related_query_name="user",
                        to="auth.group",
                        verbose_name="groups",
                    ),
                ),
                (
                    "user_permissions",
                    models.ManyToManyField(
                        blank=True,
                        related_name="user_set",
                        related_query_name="user",
                        to="auth.permission",
                        verbose_name="user permissions",
                    ),
                ),
            ],
            options={"abstract": False},
            managers=[("objects", apps.accounts.models.UserManager())],
        ),
        migrations.CreateModel(
            name="StudentProfile",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("grade_number", models.PositiveSmallIntegerField(default=9)),
                ("weekly_goal_lessons", models.PositiveSmallIntegerField(default=5)),
                ("bio", models.TextField(blank=True, default="")),
                (
                    "user",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="student_profile",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
        ),
        migrations.CreateModel(
            name="TeacherProfile",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("subject_name", models.CharField(default="Davlat va huquq asoslari", max_length=120)),
                ("department", models.CharField(default="Ijtimoiy-gumanitar fanlar", max_length=120)),
                (
                    "user",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="teacher_profile",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
        ),
    ]
