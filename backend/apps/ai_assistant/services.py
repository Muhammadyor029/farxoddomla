from django.conf import settings
from google import genai
from google.genai import types

from apps.curriculum.models import Lesson

DEFAULT_MODEL = "gemini-4-hydrogen"

TASK_INSTRUCTIONS = {
    "chat": "O'quvchining huquqiy savoliga aniq, do'stona va O'zbekiston maktab darsliklari asosida o'zbek tilida javob bering.",
    "explain": "Ushbu mavzu yoki moddani 8–11-sinf o'quvchisi oson tushunadigan sodda til va 2 ta hayotiy misol bilan tushuntiring.",
    "define": "Huquqiy atamaga qisqa ta'rif, darslikdagi mazmuni va 1 ta kundalik hayotiy misol keltiring.",
    "generate_quiz": "Mavzu bo'yicha 3 ta o'zbekcha test savolini (savol, 4 ta variant, to'g'ri javob va qisqa izoh bilan) tuzib bering.",
    "analyze_case": "Berilgan amaliy vaziyatni 4 qismda tahlil qiling: 1) Huquq sohasi; 2) Buzilgan huquq; 3) Qonuniy asos; 4) Yechim.",
    "generate_slides": "Mavzu yuzasidan 5 ta ixcham prezentatsiya slaydi tuzilmasini yozib bering.",
}


def run_legal_ai_task(task: str, prompt: str, grade_number: int | None = None, lesson_id: int | None = None) -> dict:
    api_key = getattr(settings, "GEMINI_API_KEY", "")
    if not api_key or api_key == "MY_GEMINI_API_KEY":
        raise ValueError("Serverda GEMINI_API_KEY sozlanmagan.")

    lesson_context = ""
    if lesson_id:
        lesson = Lesson.objects.select_related("grade", "content").filter(pk=lesson_id).first()
        if lesson:
            lesson_context = (
                f"Kontekst dars: {lesson.grade.grade_number}-sinf, "
                f"{lesson.lesson_number_label} — {lesson.title} ({lesson.page_number}-bet). "
                f"Qisqa mazmun: {lesson.summary}"
            )

    instruction = TASK_INSTRUCTIONS.get(task, TASK_INSTRUCTIONS["chat"])
    system_instruction = (
        "Siz HUQUQ OLAMI platformasining 8–11-sinf 'Davlat va huquq asoslari' fani bo'yicha AI ustozisiz. "
        "Faqat O'zbekiston Respublikasi Konstitutsiyasi (2023), kodekslari va rasmiy darsliklarga tayaning. "
        f"Vazifa: {instruction} Faqat o'zbek tilida (lotin alifbosida) javob bering."
    )

    full_prompt = "\n\n".join(
        p for p in [f"Sinf: {grade_number}-sinf" if grade_number else "", lesson_context, f"So'rov: {prompt}"] if p
    )

    client = genai.Client(api_key=api_key)
    response = client.models.generate_content(
        model=DEFAULT_MODEL,
        contents=full_prompt,
        config=types.GenerateContentConfig(system_instruction=system_instruction),
    )

    return {
        "text": (response.text or "").strip(),
        "model": DEFAULT_MODEL,
        "disclaimer": "Eslatma: Ushbu javob o'quv-ta'limiy tushuntirish bo'lib, rasmiy yuridik maslahat emas.",
    }
