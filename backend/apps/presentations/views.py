from django.db import transaction
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Presentation, PresentationSlide
from .serializers import PresentationDetailSerializer, PresentationListSerializer


class PresentationListView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        qs = Presentation.objects.select_related("grade").prefetch_related("slides").all()
        grade = request.query_params.get("grade")
        if grade:
            qs = qs.filter(grade__grade_number=grade)
        return Response({"presentations": PresentationListSerializer(qs, many=True).data})


class PresentationDetailView(APIView):
    def get_permissions(self):
        if self.request.method == "GET":
            return [AllowAny()]
        return [IsAuthenticated()]

    def get(self, request, pk: int):
        try:
            deck = Presentation.objects.select_related("grade").prefetch_related("slides").get(pk=pk)
        except Presentation.DoesNotExist:
            return Response({"error": "Prezentatsiya topilmadi."}, status=status.HTTP_404_NOT_FOUND)
        return Response({"presentation": PresentationDetailSerializer(deck).data})

    @transaction.atomic
    def put(self, request, pk: int):
        try:
            deck = Presentation.objects.get(pk=pk)
        except Presentation.DoesNotExist:
            return Response({"error": "Prezentatsiya topilmadi."}, status=status.HTTP_404_NOT_FOUND)

        slides_payload = request.data.get("slides")
        if not isinstance(slides_payload, list) or len(slides_payload) == 0:
            return Response({"error": "Kamida bitta slayd bo'lishi kerak."}, status=status.HTTP_400_BAD_REQUEST)

        deck.title = str(request.data.get("title") or deck.title)
        deck.template_name = str(request.data.get("template_name") or deck.template_name)
        deck.save(update_fields=["title", "template_name", "updated_at"])

        deck.slides.all().delete()
        for idx, item in enumerate(slides_payload, start=1):
            PresentationSlide.objects.create(
                presentation=deck,
                order=idx,
                layout=item.get("layout", "title"),
                title=item.get("title", f"Slayd {idx}"),
                subtitle=item.get("subtitle", ""),
                bullets_json=item.get("bullets_json", item.get("bullets", [])),
                table_rows_json=item.get("table_rows_json", item.get("tableRows", [])),
                diagram_kind=item.get("diagram_kind", item.get("diagramKind", "")),
                image_url=item.get("image_url", item.get("imageUrl", "")),
                accent_color=item.get("accent_color", item.get("accentColor", "#39FF55")),
                background_tone=item.get("background_tone", item.get("backgroundTone", "obsidian")),
                speaker_notes=item.get("speaker_notes", item.get("speakerNotes", "")),
            )

        return Response({"success": True, "presentation": PresentationDetailSerializer(deck).data})
