from rest_framework import serializers

from .models import (
    Chapter,
    Grade,
    LegalScenario,
    LegalTerm,
    LegislationArticle,
    Lesson,
    LessonContent,
    Resource,
    Subject,
)


class SubjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Subject
        fields = "__all__"


class GradeSerializer(serializers.ModelSerializer):
    chapters_count = serializers.IntegerField(source="chapters.count", read_only=True)
    lessons_count = serializers.IntegerField(source="lessons.count", read_only=True)

    class Meta:
        model = Grade
        fields = [
            "id",
            "grade_number",
            "title",
            "subtitle",
            "description",
            "textbook_title",
            "textbook_year",
            "textbook_authors",
            "pdf_path",
            "total_pages",
            "chapters_count",
            "lessons_count",
        ]


class ChapterSerializer(serializers.ModelSerializer):
    grade_number = serializers.IntegerField(source="grade.grade_number", read_only=True)

    class Meta:
        model = Chapter
        fields = ["id", "grade_number", "chapter_number", "roman_numeral", "title", "description", "page_range"]


class LessonListSerializer(serializers.ModelSerializer):
    grade_number = serializers.IntegerField(source="grade.grade_number", read_only=True)
    chapter_title = serializers.CharField(source="chapter.title", read_only=True)

    class Meta:
        model = Lesson
        fields = [
            "id",
            "slug",
            "grade_number",
            "chapter_id",
            "chapter_title",
            "lesson_number_label",
            "order_index",
            "title",
            "summary",
            "page_number",
            "estimated_minutes",
            "status",
        ]


class LessonDetailSerializer(LessonListSerializer):
    content = serializers.SerializerMethodField()

    class Meta(LessonListSerializer.Meta):
        fields = LessonListSerializer.Meta.fields + ["content"]

    def get_content(self, obj: Lesson):
        if hasattr(obj, "content"):
            return obj.content.content_json
        return None


class LegalTermSerializer(serializers.ModelSerializer):
    grade_number = serializers.IntegerField(source="grade.grade_number", read_only=True)

    class Meta:
        model = LegalTerm
        fields = [
            "id",
            "term",
            "grade_number",
            "lesson_id",
            "short_definition",
            "extended_note",
            "life_example",
            "source_page",
        ]


class LegalScenarioSerializer(serializers.ModelSerializer):
    grade_number = serializers.IntegerField(source="grade.grade_number", read_only=True)

    class Meta:
        model = LegalScenario
        fields = ["id", "grade_number", "category", "title", "scenario_json"]


class LegislationArticleSerializer(serializers.ModelSerializer):
    grade_number = serializers.IntegerField(source="grade.grade_number", read_only=True)

    class Meta:
        model = LegislationArticle
        fields = [
            "id",
            "code_name",
            "article_number",
            "title",
            "grade_number",
            "summary_text",
            "practical_meaning",
            "source_page",
        ]


class ResourceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Resource
        fields = "__all__"
