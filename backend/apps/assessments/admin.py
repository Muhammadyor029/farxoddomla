from django.contrib import admin

from .models import (
    Achievement,
    AnswerOption,
    Assignment,
    AssignmentSubmission,
    Game,
    GameAttempt,
    Question,
    Quiz,
    QuizAttempt,
    StudentProgress,
)

admin.site.register(Quiz)
admin.site.register(Question)
admin.site.register(AnswerOption)
admin.site.register(QuizAttempt)
admin.site.register(Game)
admin.site.register(GameAttempt)
admin.site.register(Achievement)
admin.site.register(StudentProgress)
admin.site.register(Assignment)
admin.site.register(AssignmentSubmission)
