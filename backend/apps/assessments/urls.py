from django.urls import path

from .views import (
    GameAttemptCreateView,
    GameListView,
    QuizAttemptCreateView,
    QuizDetailView,
    QuizListView,
    StudentDashboardView,
    TeacherAssignmentListCreateView,
    TeacherQuestionCreateView,
    TeacherSubmissionGradeView,
)

urlpatterns = [
    path("quizzes/", QuizListView.as_view(), name="quiz-list"),
    path("quizzes/<int:pk>/", QuizDetailView.as_view(), name="quiz-detail"),
    path("quiz-attempts/", QuizAttemptCreateView.as_view(), name="quiz-attempt-create"),
    path("games/", GameListView.as_view(), name="game-list"),
    path("game-attempts/", GameAttemptCreateView.as_view(), name="game-attempt-create"),
    path("student/dashboard/", StudentDashboardView.as_view(), name="student-dashboard"),
    path("teacher/assignments/", TeacherAssignmentListCreateView.as_view(), name="teacher-assignments"),
    path("teacher/quizzes/<int:quiz_id>/questions/", TeacherQuestionCreateView.as_view(), name="teacher-add-question"),
    path("teacher/submissions/<int:pk>/grade/", TeacherSubmissionGradeView.as_view(), name="teacher-grade-submission"),
]
