from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .services import run_legal_ai_task


class LegalAiTaskView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        prompt = str(request.data.get("prompt", "")).strip()
        task = str(request.data.get("task", "chat"))
        grade_number = request.data.get("grade_number")
        lesson_id = request.data.get("lesson_id")
        if not prompt:
            return Response({"error": "So'rov matnini kiriting."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            result = run_legal_ai_task(task=task, prompt=prompt, grade_number=grade_number, lesson_id=lesson_id)
            return Response(result)
        except Exception as exc:
            return Response({"error": str(exc)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
