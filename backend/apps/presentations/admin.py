from django.contrib import admin

from .models import Presentation, PresentationSlide


class PresentationSlideInline(admin.TabularInline):
    model = PresentationSlide
    extra = 0


@admin.register(Presentation)
class PresentationAdmin(admin.ModelAdmin):
    list_display = ("title", "grade", "template_name", "status", "updated_at")
    inlines = [PresentationSlideInline]
