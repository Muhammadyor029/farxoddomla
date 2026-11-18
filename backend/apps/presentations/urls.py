from django.urls import path

from .views import PresentationDetailView, PresentationListView

urlpatterns = [
    path("presentations/", PresentationListView.as_view(), name="presentation-list"),
    path("presentations/<int:pk>/", PresentationDetailView.as_view(), name="presentation-detail"),
]
