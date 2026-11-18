from django.db.models import Q
from rest_framework import generics, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsTeacherOrAdmin

from .models import (
    Chapter,
    Grade,
    LegalScenario,
    LegalTerm,
    LegislationArticle,
    Lesson,
    LessonContent,
)
from .serializers import (
    ChapterSerializer,
    GradeSerializer,
    LegalScenarioSerializer,
    LegalTermSerializer,
    LegislationArticleSerializer,
    LessonDetailSerializer,
    LessonListSerializer,
)


class GradeListView(generics.ListAPIView):
    permission_classes = [AllowAny]
    queryset = Grade.objects.prefetch_related("chapters", "lessons").all()
    serializer_class = GradeSerializer


class ChapterListView(generics.ListAPIView):
    permission_classes = [AllowAny]
    serializer_class = ChapterSerializer

    def get_queryset(self):
        qs = Chapter.objects.select_related("grade").all()
        grade = self.request.query_params.get("grade")
        if grade:
            qs = qs.filter(grade__grade_number=grade)
        return qs


class LessonListCreateView(APIView):
    def get_permissions(self):
        if self.request.method == "POST":
            return [IsTeacherOrAdmin()]
        return [AllowAny()]

    def get(self, request):
        qs = Lesson.objects.select_related("grade", "chapter").all()
        grade = request.query_params.get("grade")
        q = request.query_params.get("q")
        status_filter = request.query_params.get("status")
        if grade:
            qs = qs.filter(grade__grade_number=grade)
        if status_filter:
            qs = qs.filter(status=status_filter)
        if q:
            qs = qs.filter(Q(title__icontains=q) | Q(summary__icontains=q))
        return Response({"lessons": LessonListSerializer(qs, many=True).data})

    def post(self, request):
        grade_num = int(request.data.get("grade_number", 9))
        title = str(request.data.get("title", "")).strip()
        summary = str(request.data.get("summary", title)).strip()
        if not title:
            return Response({"error": "Mavzu nomi talab qilinadi."}, status=status.HTTP_400_BAD_REQUEST)
        grade = Grade.objects.filter(grade_number=grade_num).first()
        if not grade:
            return Response({"error": "Sinf topilmadi."}, status=status.HTTP_404_NOT_FOUND)
        chapter = Chapter.objects.filter(grade=grade).first()
        lesson = Lesson.objects.create(
            slug=f"custom-{grade_num}-{Lesson.objects.count() + 1}",
            grade=grade,
            chapter=chapter,
            lesson_number_label=request.data.get("lesson_number_label", "Qo'shimcha dars"),
            order_index=Lesson.objects.filter(grade=grade).count() + 1,
            title=title,
            summary=summary,
            page_number=int(request.data.get("page_number", 1)),
            status="verified" if request.data.get("status") == "verified" else "draft",
        )
        LessonContent.objects.create(
            lesson=lesson,
            content_json=request.data.get("content") or {"title": title, "objective": summary},
        )
        return Response({"lesson": LessonDetailSerializer(lesson).data}, status=status.HTTP_201_CREATED)


class LessonDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Lesson.objects.select_related("grade", "chapter", "content").all()
    serializer_class = LessonDetailSerializer

    def get_permissions(self):
        if self.request.method == "GET":
            return [AllowAny()]
        return [IsTeacherOrAdmin()]


class LegalTermListView(generics.ListAPIView):
    permission_classes = [AllowAny]
    serializer_class = LegalTermSerializer

    def get_queryset(self):
        qs = LegalTerm.objects.select_related("grade").all()
        grade = self.request.query_params.get("grade")
        q = self.request.query_params.get("q")
        if grade:
            qs = qs.filter(grade__grade_number=grade)
        if q:
            qs = qs.filter(Q(term__icontains=q) | Q(short_definition__icontains=q))
        return qs


class LegalScenarioListView(generics.ListAPIView):
    permission_classes = [AllowAny]
    serializer_class = LegalScenarioSerializer

    def get_queryset(self):
        qs = LegalScenario.objects.select_related("grade").all()
        grade = self.request.query_params.get("grade")
        category = self.request.query_params.get("category")
        if grade:
            qs = qs.filter(grade__grade_number=grade)
        if category and category != "all":
            qs = qs.filter(category=category)
        return qs


class LegislationArticleListView(generics.ListAPIView):
    permission_classes = [AllowAny]
    serializer_class = LegislationArticleSerializer

    def get_queryset(self):
        qs = LegislationArticle.objects.select_related("grade").all()
        code = self.request.query_params.get("code")
        q = self.request.query_params.get("q")
        if code and code != "all":
            qs = qs.filter(code_name=code)
        if q:
            qs = qs.filter(Q(title__icontains=q) | Q(summary_text__icontains=q) | Q(article_number__icontains=q))
        return qs
