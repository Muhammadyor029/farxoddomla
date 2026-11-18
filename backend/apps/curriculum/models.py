from django.db import models


class Subject(models.Model):
    name = models.CharField(max_length=160)
    code = models.CharField(max_length=40, unique=True)
    description = models.TextField()

    def __str__(self):
        return self.name


class Grade(models.Model):
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE, related_name="grades", null=True, blank=True)
    grade_number = models.PositiveSmallIntegerField(unique=True)
    title = models.CharField(max_length=120)
    subtitle = models.CharField(max_length=200)
    description = models.TextField()
    textbook_title = models.CharField(max_length=240)
    textbook_year = models.CharField(max_length=32)
    textbook_authors = models.CharField(max_length=240)
    pdf_path = models.CharField(max_length=300)
    total_pages = models.PositiveIntegerField(default=160)

    class Meta:
        ordering = ["grade_number"]

    def __str__(self):
        return self.title


class Chapter(models.Model):
    grade = models.ForeignKey(Grade, on_delete=models.CASCADE, related_name="chapters")
    chapter_number = models.PositiveSmallIntegerField()
    roman_numeral = models.CharField(max_length=12)
    title = models.CharField(max_length=240)
    description = models.TextField()
    page_range = models.CharField(max_length=60)

    class Meta:
        ordering = ["grade__grade_number", "chapter_number"]

    def __str__(self):
        return f"{self.grade.grade_number}-sinf · {self.roman_numeral}. {self.title}"


class Lesson(models.Model):
    class Status(models.TextChoices):
        VERIFIED = "verified", "Tasdiqlangan"
        DRAFT = "draft", "Qoralama"

    slug = models.SlugField(max_length=160, unique=True)
    grade = models.ForeignKey(Grade, on_delete=models.CASCADE, related_name="lessons")
    chapter = models.ForeignKey(Chapter, on_delete=models.CASCADE, related_name="lessons")
    lesson_number_label = models.CharField(max_length=60)
    order_index = models.PositiveIntegerField(default=1)
    title = models.CharField(max_length=260)
    summary = models.TextField()
    page_number = models.PositiveIntegerField(default=1)
    estimated_minutes = models.PositiveSmallIntegerField(default=45)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.VERIFIED)

    class Meta:
        ordering = ["grade__grade_number", "order_index"]

    def __str__(self):
        return f"{self.grade.grade_number}-sinf · {self.lesson_number_label}: {self.title}"


class LessonContent(models.Model):
    """16 qismli dars tuzilmasini JSON va metadata bilan saqlaydi."""
    lesson = models.OneToOneField(Lesson, on_delete=models.CASCADE, related_name="content")
    content_json = models.JSONField(default=dict)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Mazmun: {self.lesson.title}"


class LegalTerm(models.Model):
    term = models.CharField(max_length=160)
    grade = models.ForeignKey(Grade, on_delete=models.CASCADE, related_name="legal_terms")
    lesson = models.ForeignKey(Lesson, on_delete=models.SET_NULL, null=True, blank=True, related_name="terms")
    short_definition = models.TextField()
    extended_note = models.TextField()
    life_example = models.TextField()
    source_page = models.CharField(max_length=100)

    class Meta:
        ordering = ["term"]

    def __str__(self):
        return self.term


class LegalScenario(models.Model):
    grade = models.ForeignKey(Grade, on_delete=models.CASCADE, related_name="scenarios")
    category = models.CharField(max_length=80)
    title = models.CharField(max_length=240)
    scenario_json = models.JSONField(default=dict)

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return f"[{self.category}] {self.title}"


class LegislationArticle(models.Model):
    code_name = models.CharField(max_length=160)
    article_number = models.CharField(max_length=60)
    title = models.CharField(max_length=240)
    grade = models.ForeignKey(Grade, on_delete=models.CASCADE, related_name="legislation_articles")
    summary_text = models.TextField()
    practical_meaning = models.TextField()
    source_page = models.CharField(max_length=100)

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return f"{self.code_name} — {self.article_number}"


class Resource(models.Model):
    title = models.CharField(max_length=240)
    resource_type = models.CharField(max_length=40, default="pdf_textbook")
    grade = models.ForeignKey(Grade, on_delete=models.CASCADE, related_name="resources")
    file_url = models.CharField(max_length=300)
    description = models.TextField()

    def __str__(self):
        return self.title
