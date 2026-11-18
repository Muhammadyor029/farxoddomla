from rest_framework import serializers

from .models import Presentation, PresentationSlide


class PresentationSlideSerializer(serializers.ModelSerializer):
    class Meta:
        model = PresentationSlide
        fields = [
            "id",
            "order",
            "layout",
            "title",
            "subtitle",
            "bullets_json",
            "table_rows_json",
            "diagram_kind",
            "image_url",
            "accent_color",
            "background_tone",
            "speaker_notes",
        ]


class PresentationListSerializer(serializers.ModelSerializer):
    grade_number = serializers.IntegerField(source="grade.grade_number", read_only=True)
    slide_count = serializers.IntegerField(source="slides.count", read_only=True)

    class Meta:
        model = Presentation
        fields = [
            "id",
            "lesson_id",
            "grade_number",
            "title",
            "template_name",
            "status",
            "updated_at",
            "slide_count",
        ]


class PresentationDetailSerializer(PresentationListSerializer):
    slides = PresentationSlideSerializer(many=True, read_only=True)

    class Meta(PresentationListSerializer.Meta):
        fields = PresentationListSerializer.Meta.fields + ["slides"]
