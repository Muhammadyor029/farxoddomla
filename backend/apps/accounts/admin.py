from django.contrib import admin

from .models import StudentProfile, TeacherProfile, User


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ("email", "full_name", "role", "grade_number", "xp", "level", "is_active")
    list_filter = ("role", "grade_number")
    search_fields = ("email", "full_name", "school_name")
    ordering = ("id",)


@admin.register(StudentProfile)
class StudentProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "grade_number", "weekly_goal_lessons")


@admin.register(TeacherProfile)
class TeacherProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "subject_name", "department")
