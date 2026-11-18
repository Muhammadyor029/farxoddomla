from django.conf import settings
from django.db import models

from apps.curriculum.models import Grade, Lesson


class Quiz(models.Model):
    lesson = models.OneToOneField(Lesson, on_delete=models.CASCADE, related_name="quiz")
    grade = models.ForeignKey(Grade, on_delete=models.CASCADE, related_name="quizzes")
    title = models.CharField(max_length=260)
    time_limit_minutes = models.PositiveSmallIntegerField(default=12)
    status = models.CharField(max_length=20, default="verified")

    def __str__(self):
        return self.title


class Question(models.Model):
    class QuestionType(models.TextChoices):
        SINGLE = "single", "Bitta javob"
        MULTIPLE = "multiple", "Ko'p javob"
        TRUE_FALSE = "true_false", "To'g'ri/Noto'g'ri"
        MATCHING = "matching", "Moslashtirish"
        ORDERING = "ordering", "Ketma-ketlik"
        CASE = "case", "Vaziyatli savol"
        VISUAL = "visual", "Vizual savol"

    quiz = models.ForeignKey(Quiz, on_delete=models.CASCADE, related_name="questions")
    order = models.PositiveSmallIntegerField(default=1)
    question_type = models.CharField(max_length=24, choices=QuestionType.choices, default=QuestionType.SINGLE)
    prompt = models.TextField()
    correct_answer_json = models.JSONField(default=dict)
    match_pairs_json = models.JSONField(default=list, blank=True)
    diagram_kind = models.CharField(max_length=60, blank=True, default="")
    explanation = models.TextField()
    points = models.PositiveSmallIntegerField(default=10)

    class Meta:
        ordering = ["order"]

    def __str__(self):
        return f"{self.quiz.title} — Savol {self.order}"


class AnswerOption(models.Model):
    question = models.ForeignKey(Question, on_delete=models.CASCADE, related_name="options")
    order = models.PositiveSmallIntegerField(default=1)
    option_text = models.TextField()
    is_correct = models.BooleanField(default=False)

    class Meta:
        ordering = ["order"]


class QuizAttempt(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="quiz_attempts")
    quiz = models.ForeignKey(Quiz, on_delete=models.CASCADE, related_name="attempts")
    grade_number = models.PositiveSmallIntegerField(default=9)
    score = models.PositiveIntegerField(default=0)
    max_score = models.PositiveIntegerField(default=100)
    percentage = models.FloatField(default=0.0)
    elapsed_seconds = models.PositiveIntegerField(default=60)
    correct_count = models.PositiveIntegerField(default=0)
    total_questions = models.PositiveIntegerField(default=10)
    recommendations_json = models.JSONField(default=list)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class Game(models.Model):
    slug = models.SlugField(max_length=80, unique=True)
    title = models.CharField(max_length=160)
    subtitle = models.CharField(max_length=260)
    rules = models.TextField()
    educational_goal = models.TextField()
    is_simulation = models.BooleanField(default=False)
    xp_reward = models.PositiveIntegerField(default=100)
    difficulty = models.CharField(max_length=32, default="O'rta")

    def __str__(self):
        return self.title


class GameAttempt(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="game_attempts")
    game = models.ForeignKey(Game, on_delete=models.CASCADE, related_name="attempts")
    grade_number = models.PositiveSmallIntegerField(default=9)
    lesson = models.ForeignKey(Lesson, on_delete=models.SET_NULL, null=True, blank=True)
    score = models.PositiveIntegerField(default=0)
    max_score = models.PositiveIntegerField(default=100)
    xp_earned = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class Achievement(models.Model):
    code = models.SlugField(max_length=80, unique=True)
    title = models.CharField(max_length=160)
    description = models.TextField()
    xp_threshold = models.PositiveIntegerField(default=100)
    badge_type = models.CharField(max_length=32, default="shield")

    class Meta:
        ordering = ["xp_threshold"]

    def __str__(self):
        return self.title


class StudentProgress(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="lesson_progress")
    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE, related_name="student_progress")
    completed = models.BooleanField(default=True)
    quiz_best_score = models.PositiveSmallIntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("user", "lesson")


class Assignment(models.Model):
    title = models.CharField(max_length=240)
    description = models.TextField()
    grade_number = models.PositiveSmallIntegerField(default=9)
    lesson = models.ForeignKey(Lesson, on_delete=models.SET_NULL, null=True, blank=True)
    due_date = models.CharField(max_length=32)
    teacher = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="created_assignments")
    teacher_name = models.CharField(max_length=160)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class AssignmentSubmission(models.Model):
    assignment = models.ForeignKey(Assignment, on_delete=models.CASCADE, related_name="submissions")
    student = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="assignment_submissions")
    answer_text = models.TextField()
    score = models.PositiveSmallIntegerField(null=True, blank=True)
    feedback = models.TextField(blank=True, default="")
    submitted_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("assignment", "student")
