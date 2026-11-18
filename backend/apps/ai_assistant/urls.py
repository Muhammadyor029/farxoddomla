from django.urls import path

from .views import LegalAiTaskView

urlpatterns = [
    path("task/", LegalAiTaskView.as_view(), name="ai-task"),
]
