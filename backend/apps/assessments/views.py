from django.db import transaction
from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsTeacherOrAdmin

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
from .serializers import (
    AchievementSerializer,
    AssignmentSerializer,
    AssignmentSubmissionSerializer,
    GameAttemptSerializer,
    GameSerializer,
    QuizAttemptSerializer,
    QuizDetailSerializer,
    QuizListSerializer,
    StudentProgressSerializer,
)


class QuizListView(generics.ListAPIView):
    permission_classes = [AllowAny]
    serializer_class = QuizListSerializer

    def get_queryset(self):
        qs = Quiz.objects.select_related("grade").prefetch_related("questions").all()
        grade = self.request.query_params.get("grade")
        if grade:
            qs = qs.filter(grade__grade_number=grade)
        return qs


class QuizDetailView(generics.RetrieveAPIView):
    permission_classes = [AllowAny]
    queryset = Quiz.objects.select_related("grade").prefetch_related("questions__options").all()
    serializer_class = QuizDetailSerializer


class QuizAttemptCreateView(APIView):
    permission_classes = [AllowAny]

    @transaction.atomic
    def post(self, request):
        quiz_id = request.data.get("quiz_id")
        answers = request.data.get("answers") or {}
        elapsed_seconds = int(request.data.get("elapsed_seconds", 60))

        try:
            quiz = Quiz.objects.select_related("grade", "lesson").prefetch_related("questions").get(pk=quiz_id)
        except Quiz.DoesNotExist:
            return Response({"error": "Test topilmadi."}, status=status.HTTP_404_NOT_FOUND)

        questions = list(quiz.questions.all())
        score = 0
        max_score = 0
        correct_count = 0
        recommendations = []

        for q in questions:
            max_score += q.points
            expected = q.correct_answer_json
            user_ans = answers.get(str(q.id))
            is_correct = False

            if q.question_type == "multiple" and isinstance(expected, list) and isinstance(user_ans, list):
                is_correct = sorted(map(str, expected)) == sorted(map(str, user_ans))
            elif q.question_type == "ordering" and isinstance(expected, list) and isinstance(user_ans, list):
                is_correct = expected == user_ans
            elif q.question_type == "matching" and isinstance(expected, dict) and isinstance(user_ans, dict):
                is_correct = all(user_ans.get(k) == v for k, v in expected.items())
            else:
                is_correct = user_ans == expected

            if is_correct:
                score += q.points
                correct_count += 1
            else:
                recommendations.append(q.explanation)

        percentage = round((score / max_score) * 100, 1) if max_score > 0 else 0.0
        final_recs = recommendations[:4] or ["Ajoyib natija! Keyingi mavzu va amaliy vaziyatlarni o'rganing."]

        user = request.user if request.user.is_authenticated else None
        attempt = QuizAttempt.objects.create(
            user=user,
            quiz=quiz,
            grade_number=quiz.grade.grade_number,
            score=score,
            max_score=max_score,
            percentage=percentage,
            elapsed_seconds=elapsed_seconds,
            correct_count=correct_count,
            total_questions=len(questions),
            recommendations_json=final_recs,
        )

        xp_earned = 0
        if user:
            xp_earned = max(20, round(score * 0.8))
            user.xp += xp_earned
            user.recalculate_level()
            user.save(update_fields=["xp", "level"])
            prog, _ = StudentProgress.objects.get_or_create(user=user, lesson=quiz.lesson)
            prog.completed = True
            prog.quiz_best_score = max(prog.quiz_best_score, round(percentage))
            prog.save()

        data = QuizAttemptSerializer(attempt).data
        data["xp_earned"] = xp_earned
        return Response({"attempt": data}, status=status.HTTP_201_CREATED)


class GameListView(generics.ListAPIView):
    permission_classes = [AllowAny]
    queryset = Game.objects.all()
    serializer_class = GameSerializer


class GameAttemptCreateView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        slug = request.data.get("game_slug")
        game = Game.objects.filter(slug=slug).first()
        if not game:
            return Response({"error": "O'yin topilmadi."}, status=status.HTTP_404_NOT_FOUND)
        score = max(0, int(request.data.get("score", 0)))
        max_score = max(1, int(request.data.get("max_score", 100)))
        xp_earned = max(15, round((score / max_score) * 120))
        user = request.user if request.user.is_authenticated else None

        attempt = GameAttempt.objects.create(
            user=user,
            game=game,
            grade_number=int(request.data.get("grade_number", 9)),
            score=score,
            max_score=max_score,
            xp_earned=xp_earned,
        )
        if user:
            user.xp += xp_earned
            user.recalculate_level()
            user.save(update_fields=["xp", "level"])
        return Response({"attempt": GameAttemptSerializer(attempt).data}, status=status.HTTP_201_CREATED)


class StudentDashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        progress = StudentProgress.objects.select_related("lesson").filter(user=user)
        quiz_attempts = QuizAttempt.objects.select_related("quiz").filter(user=user)[:20]
        game_attempts = GameAttempt.objects.select_related("game").filter(user=user)[:20]
        achievements = Achievement.objects.all()
        assignments = Assignment.objects.all()
        return Response(
            {
                "xp": user.xp,
                "level": user.level,
                "progress": StudentProgressSerializer(progress, many=True).data,
                "quiz_attempts": QuizAttemptSerializer(quiz_attempts, many=True).data,
                "game_attempts": GameAttemptSerializer(game_attempts, many=True).data,
                "achievements": AchievementSerializer(achievements, many=True).data,
                "assignments": AssignmentSerializer(assignments, many=True).data,
            }
        )


class TeacherAssignmentListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsTeacherOrAdmin]
    queryset = Assignment.objects.all()
    serializer_class = AssignmentSerializer

    def perform_create(self, serializer):
        serializer.save(teacher=self.request.user, teacher_name=self.request.user.full_name)


class TeacherSubmissionGradeView(APIView):
    permission_classes = [IsTeacherOrAdmin]

    def post(self, request, pk: int):
        try:
            sub = AssignmentSubmission.objects.get(pk=pk)
        except AssignmentSubmission.DoesNotExist:
            return Response({"error": "Topshiriq javobi topilmadi."}, status=status.HTTP_404_NOT_FOUND)
        sub.score = int(request.data.get("score", 0))
        sub.feedback = str(request.data.get("feedback", ""))
        sub.save(update_fields=["score", "feedback"])
        return Response({"submission": AssignmentSubmissionSerializer(sub).data})


class TeacherQuestionCreateView(APIView):
    permission_classes = [IsTeacherOrAdmin]

    def post(self, request, quiz_id: int):
        try:
            quiz = Quiz.objects.get(pk=quiz_id)
        except Quiz.DoesNotExist:
            return Response({"error": "Test topilmadi."}, status=status.HTTP_404_NOT_FOUND)

        prompt = str(request.data.get("prompt", "")).strip()
        options = request.data.get("options") or []
        correct_index = int(request.data.get("correct_index", 0))
        if not prompt or len(options) < 2:
            return Response({"error": "Savol matni va kamida 2 ta variant kiriting."}, status=status.HTTP_400_BAD_REQUEST)

        question = Question.objects.create(
            quiz=quiz,
            order=quiz.questions.count() + 1,
            question_type="single",
            prompt=prompt,
            correct_answer_json=correct_index,
            explanation=str(request.data.get("explanation", "O'qituvchi izohi.")),
            points=10,
        )
        for idx, text in enumerate(options):
            AnswerOption.objects.create(
                question=question,
                order=idx + 1,
                option_text=str(text),
                is_correct=(idx == correct_index),
            )
        return Response({"question_id": question.id}, status=status.HTTP_201_CREATED)
