import pytest
from django.core.management import call_command
from rest_framework.test import APIClient

from apps.accounts.models import User


@pytest.mark.django_db
def test_seed_and_auth_rbac_flow():
    call_command("seed_huquq_olami")
    client = APIClient()

    # Health check
    health_res = client.get("/api/health/")
    assert health_res.status_code == 200
    assert health_res.json()["status"] == "ok"

    # Grades endpoint
    grades_res = client.get("/api/grades/")
    assert grades_res.status_code == 200
    assert len(grades_res.json()) == 4

    # Student login via SimpleJWT
    login_res = client.post(
        "/api/auth/login/",
        {"email": "oquvchi@huquqolami.uz", "password": "Student123!"},
        format="json",
    )
    assert login_res.status_code == 200
    token = login_res.json()["access"]
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

    # Student cannot access teacher assignment creation
    forbidden = client.post(
        "/api/teacher/assignments/",
        {"title": "Test", "description": "Desc", "grade_number": 9, "due_date": "2026-06-01"},
        format="json",
    )
    assert forbidden.status_code == 403

    # Student can fetch dashboard
    dash = client.get("/api/student/dashboard/")
    assert dash.status_code == 200
    assert dash.json()["xp"] >= 340

    # Teacher can create assignment
    teacher = User.objects.get(email="oqituvchi@huquqolami.uz")
    client.force_authenticate(user=teacher)
    created = client.post(
        "/api/teacher/assignments/",
        {"title": "Yangi vazifa", "description": "Tahlil", "grade_number": 9, "due_date": "2026-06-15"},
        format="json",
    )
    assert created.status_code == 201
