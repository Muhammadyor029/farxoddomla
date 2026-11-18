from django.contrib.auth import authenticate
from rest_framework import serializers

from .models import StudentProfile, TeacherProfile, User


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "full_name",
            "role",
            "grade_number",
            "class_name",
            "school_name",
            "xp",
            "level",
            "streak_days",
            "date_joined",
        ]
        read_only_fields = ["id", "xp", "level", "streak_days", "date_joined"]


class RegisterSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=6)
    full_name = serializers.CharField(max_length=160)
    role = serializers.ChoiceField(choices=["student", "teacher"], default="student")
    grade_number = serializers.IntegerField(default=9, min_value=8, max_value=11)
    class_name = serializers.CharField(max_length=40, required=False, default="9-A")
    school_name = serializers.CharField(max_length=200, required=False, default="O'zbekiston umumta'lim maktabi")

    def validate_email(self, value):
        clean = value.strip().lower()
        if User.objects.filter(email=clean).exists():
            raise serializers.ValidationError("Ushbu email bilan foydalanuvchi allaqachon ro'yxatdan o'tgan.")
        return clean

    def create(self, validated_data):
        role = validated_data.get("role", "student")
        grade_number = validated_data.get("grade_number", 9)
        user = User.objects.create_user(
            email=validated_data["email"],
            password=validated_data["password"],
            full_name=validated_data["full_name"].strip(),
            role=role,
            grade_number=grade_number,
            class_name=validated_data.get("class_name") or f"{grade_number}-A",
            school_name=validated_data.get("school_name") or "O'zbekiston umumta'lim maktabi",
            xp=50,
            level=1,
            streak_days=1,
        )
        if role == "teacher":
            TeacherProfile.objects.create(user=user)
        else:
            StudentProfile.objects.create(user=user, grade_number=grade_number)
        return user


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        email = attrs.get("email", "").strip().lower()
        user = authenticate(email=email, password=attrs.get("password"))
        if not user:
            raise serializers.ValidationError("Email yoki parol noto'g'ri.")
        attrs["user"] = user
        return attrs
