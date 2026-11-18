from rest_framework.permissions import BasePermission


class IsTeacherOrAdmin(BasePermission):
    message = "Ushbu amal faqat o'qituvchi yoki administrator uchun ruxsat etilgan."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role in ("teacher", "admin")
        )


class IsAdminRole(BasePermission):
    message = "Ushbu amal faqat administrator uchun ruxsat etilgan."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role == "admin"
        )
