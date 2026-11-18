from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models


class UserManager(BaseUserManager):
    use_in_migrations = True

    def _create_user(self, email, password, **extra_fields):
        if not email:
            raise ValueError("Email kiritilishi shart.")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        return self._create_user(email, password, **extra_fields)

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("role", User.Role.ADMIN)
        return self._create_user(email, password, **extra_fields)


class User(AbstractUser):
    class Role(models.TextChoices):
        STUDENT = "student", "O'quvchi"
        TEACHER = "teacher", "O'qituvchi"
        ADMIN = "admin", "Administrator"

    username = None
    email = models.EmailField("Email", unique=True)
    full_name = models.CharField("To'liq ism-familiya", max_length=160)
    role = models.CharField("Rol", max_length=20, choices=Role.choices, default=Role.STUDENT)
    grade_number = models.PositiveSmallIntegerField("Sinf", default=9)
    class_name = models.CharField("Sinf guruhi", max_length=40, default="9-A")
    school_name = models.CharField("Maktab", max_length=200, default="O'zbekiston umumta'lim maktabi")
    xp = models.PositiveIntegerField("XP ball", default=0)
    level = models.PositiveIntegerField("Daraja", default=1)
    streak_days = models.PositiveIntegerField("Ketma-ket kunlar", default=1)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["full_name"]

    objects = UserManager()

    def recalculate_level(self):
        self.level = max(1, (self.xp // 150) + 1)
        return self.level

    def __str__(self):
        return f"{self.full_name} ({self.role})"


class StudentProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="student_profile")
    grade_number = models.PositiveSmallIntegerField(default=9)
    weekly_goal_lessons = models.PositiveSmallIntegerField(default=5)
    bio = models.TextField(blank=True, default="")

    def __str__(self):
        return f"O'quvchi: {self.user.full_name}"


class TeacherProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="teacher_profile")
    subject_name = models.CharField(max_length=120, default="Davlat va huquq asoslari")
    department = models.CharField(max_length=120, default="Ijtimoiy-gumanitar fanlar")

    def __str__(self):
        return f"O'qituvchi: {self.user.full_name}"
