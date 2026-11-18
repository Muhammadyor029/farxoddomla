from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from .views import AdminUserRoleView, LoginView, MeView, RegisterView

urlpatterns = [
    path("register/", RegisterView.as_view(), name="auth-register"),
    path("login/", LoginView.as_view(), name="auth-login"),
    path("refresh/", TokenRefreshView.as_view(), name="auth-refresh"),
    path("me/", MeView.as_view(), name="auth-me"),
    path("users/<int:user_id>/role/", AdminUserRoleView.as_view(), name="admin-user-role"),
]
