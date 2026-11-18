from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path


def health_view(_request):
    return JsonResponse({"status": "ok", "service": "huquq-olami-django"})


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health/", health_view),
    path("api/auth/", include("apps.accounts.urls")),
    path("api/", include("apps.curriculum.urls")),
    path("api/", include("apps.presentations.urls")),
    path("api/", include("apps.assessments.urls")),
    path("api/ai/", include("apps.ai_assistant.urls")),
]
