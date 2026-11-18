from django.urls import path

from .views import (
    ChapterListView,
    GradeListView,
    LegalScenarioListView,
    LegalTermListView,
    LegislationArticleListView,
    LessonDetailView,
    LessonListCreateView,
)

urlpatterns = [
    path("grades/", GradeListView.as_view(), name="grade-list"),
    path("chapters/", ChapterListView.as_view(), name="chapter-list"),
    path("lessons/", LessonListCreateView.as_view(), name="lesson-list-create"),
    path("lessons/<int:pk>/", LessonDetailView.as_view(), name="lesson-detail"),
    path("glossary/", LegalTermListView.as_view(), name="glossary-list"),
    path("scenarios/", LegalScenarioListView.as_view(), name="scenario-list"),
    path("legislation/", LegislationArticleListView.as_view(), name="legislation-list"),
]
