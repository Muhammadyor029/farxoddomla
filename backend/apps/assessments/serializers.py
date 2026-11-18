from rest_framework import serializers

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


class AnswerOptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = AnswerOption
        fields = ["id", "order", "option_text"]


class QuestionSerializer(serializers.ModelSerializer):
    options = AnswerOptionSerializer(many=True, read_only=True)

    class Meta:
        model = Question
        fields = [
            "id",
            "order",
            "question_type",
            "prompt",
            "options",
            "correct_answer_json",
            "match_pairs_json",
            "diagram_kind",
            "explanation",
            "points",
        ]


class QuizListSerializer(serializers.ModelSerializer):
    grade_number = serializers.IntegerField(source="grade.grade_number", read_only=True)
    question_count = serializers.IntegerField(source="questions.count", read_only=True)

    class Meta:
        model = Quiz
        fields = ["id", "lesson_id", "grade_number", "title", "time_limit_minutes", "status", "question_count"]


class QuizDetailSerializer(QuizListSerializer):
    questions = QuestionSerializer(many=True, read_only=True)

    class Meta(QuizListSerializer.Meta):
        fields = QuizListSerializer.Meta.fields + ["questions"]


class QuizAttemptSerializer(serializers.ModelSerializer):
    quiz_title = serializers.CharField(source="quiz.title", read_only=True)

    class Meta:
        model = QuizAttempt
        fields = [
            "id",
            "quiz_id",
            "quiz_title",
            "grade_number",
            "score",
            "max_score",
            "percentage",
            "elapsed_seconds",
            "correct_count",
            "total_questions",
            "recommendations_json",
            "created_at",
        ]


class GameSerializer(serializers.ModelSerializer):
    class Meta:
        model = Game
        fields = "__all__"


class GameAttemptSerializer(serializers.ModelSerializer):
    game_slug = serializers.CharField(source="game.slug", read_only=True)
    game_title = serializers.CharField(source="game.title", read_only=True)

    class Meta:
        model = GameAttempt
        fields = ["id", "game_slug", "game_title", "grade_number", "score", "max_score", "xp_earned", "created_at"]


class AchievementSerializer(serializers.ModelSerializer):
    class Meta:
        model = Achievement
        fields = "__all__"


class StudentProgressSerializer(serializers.ModelSerializer):
    lesson_title = serializers.CharField(source="lesson.title", read_only=True)

    class Meta:
        model = StudentProgress
        fields = ["lesson_id", "lesson_title", "completed", "quiz_best_score", "updated_at"]


class AssignmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Assignment
        fields = "__all__"


class AssignmentSubmissionSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source="student.full_name", read_only=True)

    class Meta:
        model = AssignmentSubmission
        fields = ["id", "assignment_id", "student_id", "student_name", "answer_text", "score", "feedback", "submitted_at"]
