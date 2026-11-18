from django.db import models

from apps.curriculum.models import Grade, Lesson


class Presentation(models.Model):
    lesson = models.OneToOneField(Lesson, on_delete=models.CASCADE, related_name="presentation")
    grade = models.ForeignKey(Grade, on_delete=models.CASCADE, related_name="presentations")
    title = models.CharField(max_length=260)
    template_name = models.CharField(max_length=120, default="Huquq Olami Neon-Grafit")
    status = models.CharField(max_length=20, default="verified")
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.title


class PresentationSlide(models.Model):
    presentation = models.ForeignKey(Presentation, on_delete=models.CASCADE, related_name="slides")
    order = models.PositiveSmallIntegerField(default=1)
    layout = models.CharField(max_length=40, default="title")
    title = models.CharField(max_length=260)
    subtitle = models.CharField(max_length=260, blank=True, default="")
    bullets_json = models.JSONField(default=list)
    table_rows_json = models.JSONField(default=list, blank=True)
    diagram_kind = models.CharField(max_length=60, blank=True, default="")
    image_url = models.CharField(max_length=300, blank=True, default="")
    accent_color = models.CharField(max_length=24, default="#39FF55")
    background_tone = models.CharField(max_length=32, default="obsidian")
    speaker_notes = models.TextField(blank=True, default="")

    class Meta:
        ordering = ["order"]

    def __str__(self):
        return f"{self.presentation.title} — Slayd {self.order}"
