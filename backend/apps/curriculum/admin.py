from django.contrib import admin

from .models import (
    Chapter,
    Grade,
    LegalScenario,
    LegalTerm,
    LegislationArticle,
    Lesson,
    LessonContent,
    Resource,
    Subject,
)

admin.site.register(Subject)
admin.site.register(Grade)
admin.site.register(Chapter)


@admin.register(Lesson)
class LessonAdmin(admin.ModelAdmin):
    list_display = ("lesson_number_label", "title", "grade", "page_number", "status")
    list_filter = ("grade", "status")
    search_fields = ("title", "summary")


admin.site.register(LessonContent)
admin.site.register(LegalTerm)
admin.site.register(LegalScenario)
admin.site.register(LegislationArticle)
admin.site.register(Resource)
