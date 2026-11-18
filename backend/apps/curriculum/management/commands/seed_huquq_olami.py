from django.core.management.base import BaseCommand
from django.db import transaction

from apps.accounts.models import StudentProfile, TeacherProfile, User
from apps.assessments.models import (
    Achievement,
    AnswerOption,
    Assignment,
    Game,
    Question,
    Quiz,
)
from apps.curriculum.models import (
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
from apps.presentations.models import Presentation, PresentationSlide


class Command(BaseCommand):
    help = "HUQUQ OLAMI platformasi uchun 8-11-sinf darsliklari, foydalanuvchilar, testlar va o'yinlarni yuklaydi."

    @transaction.atomic
    def handle(self, *args, **options):
        subject, _ = Subject.objects.get_or_create(
            code="DHA-8-11",
            defaults={
                "name": "Davlat va huquq asoslari",
                "description": "O'zbekiston umumiy o'rta ta'lim maktablarining 8–11-sinflari uchun huquqiy ta'lim fani.",
            },
        )

        grades_meta = [
            (
                8,
                "8-sinf",
                "Davlat, jamiyat va huquq asoslari",
                "Huquqning asosiy tushunchalari, davlat belgilari, O'zbekiston Konstitutsiyasi va voyaga yetmaganlar huquqlari.",
                "Davlat va huquq asoslari (8-sinf)",
                "2023",
                "Rasmiy maktab darsligi jamoasi",
                "/assets/aistudio/davlat-va-huquq-asoslari-8-sinf-uz_66f27f16.pdf",
                160,
            ),
            (
                9,
                "9-sinf",
                "Konstitutsiyaviy huquq va davlat hokimiyati",
                "2023-yilgi yangi tahrirdagi O'zbekiston Respublikasi Konstitutsiyasi va fuqarolik huquqlari.",
                "Davlat va huquq asoslari (9-sinf)",
                "2023",
                "Rasmiy maktab darsligi jamoasi",
                "/assets/aistudio/davlat-va-huquq-asoslari-9-sinf-uz_ece2bb29.pdf",
                176,
            ),
            (
                10,
                "10-sinf",
                "Fuqarolik, oila va iste'molchi huquqlari",
                "Shaxsiy va mulkiy huquqlar, shartnomalar, oilaviy munosabatlar hamda iste'molchi himoyasi.",
                "Davlat va huquq asoslari (10-sinf)",
                "2023",
                "Rasmiy maktab darsligi jamoasi",
                "/assets/aistudio/10-sinf_Davlat_va_huquq_asoslari._Yangi_darslik_kitob_2023_471aa751.pdf",
                184,
            ),
            (
                11,
                "11-sinf",
                "Mehnat, ekologiya, jinoyat va xalqaro huquq",
                "Mehnat kodeksi, ekologik javobgarlik, jinoyat huquqi va xalqaro huquq normalari.",
                "Davlat va huquq asoslari (11-sinf, 2025–2026)",
                "2025",
                "Rasmiy maktab darsligi jamoasi",
                "/assets/aistudio/11-sinf_Davlat_va_huquq_asoslari_2025-2026_kitobi_db8c0e25.pdf",
                192,
            ),
        ]

        grade_objs = {}
        for num, title, sub, desc, t_title, t_year, t_auth, pdf, pages in grades_meta:
            grade_obj, _ = Grade.objects.update_or_create(
                grade_number=num,
                defaults={
                    "subject": subject,
                    "title": title,
                    "subtitle": sub,
                    "description": desc,
                    "textbook_title": t_title,
                    "textbook_year": t_year,
                    "textbook_authors": t_auth,
                    "pdf_path": pdf,
                    "total_pages": pages,
                },
            )
            grade_objs[num] = grade_obj
            Resource.objects.get_or_create(
                title=t_title,
                grade=grade_obj,
                defaults={"resource_type": "pdf_textbook", "file_url": pdf, "description": desc},
            )

        sample_lessons = [
            (8, "I", "Davlat va huquqning kelib chiqishi", "1-dars", "Jamiyatda qoidalar va huquqiy normalar", 6),
            (9, "I", "Konstitutsiya — asosiy qonun", "1-dars", "O'zbekiston Respublikasi Konstitutsiyasi va uning oliy yuridik kuchi", 5),
            (10, "I", "Fuqarolik huquqi asoslari", "1-dars", "Fuqarolik-huquqiy munosabatlar va mulk huquqi", 8),
            (11, "I", "Mehnat va ekologiya huquqi", "1-dars", "Mehnat shartnomasi va mehnat intizomi (MK 106, 314-moddalar)", 7),
        ]

        for g_num, roman, ch_title, l_num, l_title, page in sample_lessons:
            g = grade_objs[g_num]
            ch, _ = Chapter.objects.get_or_create(
                grade=g,
                chapter_number=1,
                defaults={"roman_numeral": roman, "title": ch_title, "description": ch_title, "page_range": f"{page}-40"},
            )
            lesson, _ = Lesson.objects.get_or_create(
                slug=f"grade-{g_num}-lesson-1",
                defaults={
                    "grade": g,
                    "chapter": ch,
                    "lesson_number_label": l_num,
                    "order_index": 1,
                    "title": l_title,
                    "summary": f"{g_num}-sinf darsligi asosida {l_title} mavzusining to'liq tahlili.",
                    "page_number": page,
                    "status": Lesson.Status.VERIFIED,
                },
            )
            LessonContent.objects.get_or_create(
                lesson=lesson,
                defaults={
                    "content_json": {
                        "title": f"{l_num}: {l_title}",
                        "objective": f"O'quvchilarga {l_title} mavzusini hayotiy misollar bilan o'rgatish.",
                        "conclusion": f"{l_title} bo'yicha bilimlar mustahkamlandi.",
                    }
                },
            )
            deck, _ = Presentation.objects.get_or_create(
                lesson=lesson,
                defaults={"grade": g, "title": l_title, "template_name": "Huquq Olami Neon-Grafit"},
            )
            if not deck.slides.exists():
                PresentationSlide.objects.create(
                    presentation=deck,
                    order=1,
                    layout="title",
                    title=l_title,
                    subtitle=f"{g_num}-sinf · Davlat va huquq asoslari",
                    bullets_json=[lesson.summary],
                    speaker_notes="Kirish slaydi",
                )
            quiz, _ = Quiz.objects.get_or_create(
                lesson=lesson,
                defaults={"grade": g, "title": f"{l_num}: {l_title} — Test", "time_limit_minutes": 12},
            )
            if not quiz.questions.exists():
                q = Question.objects.create(
                    quiz=quiz,
                    order=1,
                    question_type="single",
                    prompt=f"{l_title} qaysi sinf dasturiga kiradi?",
                    correct_answer_json=0,
                    explanation=f"Bu mavzu {g_num}-sinf 'Davlat va huquq asoslari' darsligidan olingan.",
                    points=10,
                )
                AnswerOption.objects.create(question=q, order=1, option_text=f"{g_num}-sinf", is_correct=True)
                AnswerOption.objects.create(question=q, order=2, option_text="5-sinf", is_correct=False)

        # Terms, Legislation, Scenarios, Games, Achievements
        LegalTerm.objects.get_or_create(
            term="Konstitutsiya",
            grade=grade_objs[9],
            defaults={
                "short_definition": "Davlatning eng oliy yuridik kuchga ega asosiy qonuni.",
                "extended_note": "Barcha qonunlar Konstitutsiyaga muvofiq qabul qilinadi (15-modda).",
                "life_example": "Fuqaro o'z huquqlarini bevosita Konstitutsiya normalariga tayanib himoya qilishi mumkin.",
                "source_page": "9-sinf darslik, 6-bet",
            },
        )
        LegislationArticle.objects.get_or_create(
            code_name="O'zbekiston Respublikasi Konstitutsiyasi",
            article_number="15-modda",
            grade=grade_objs[9],
            defaults={
                "title": "Konstitutsiya va qonunlarning ustunligi",
                "summary_text": "Konstitutsiya mamlakatning butun hududida oliy yuridik kuchga ega va to'g'ridan-to'g'ri amal qiladi.",
                "practical_meaning": "Hech bir qonun yoki qaror Konstitutsiyaga zid bo'lishi mumkin emas.",
                "source_page": "9-sinf darslik, 11-bet",
            },
        )
        LegalScenario.objects.get_or_create(
            category="Konstitutsiyaviy huquq",
            title="Axborot olish va fikr bildirish erkinligi",
            grade=grade_objs[9],
            defaults={"scenario_json": {"legalBasis": "Konstitutsiya 33-modda"}},
        )

        games_data = [
            ("huquqiy_detektiv", "Huquqiy Detektiv", "Faktlar orasidan buzilgan normani toping", False),
            ("sud_zali", "Sud Zali", "O'quv sud jarayoni simulyatsiyasi", True),
            ("huquqiy_domino", "Huquqiy Domino", "Atama va ta'rif zanjiri", False),
            ("mosini_top", "Mosini Top", "Modda va mazmunni moslashtiring", False),
            ("qonuniy_yoki_noqonuniy", "Qonuniy yoki Noqonuniy?", "Tezkor huquqiy baholash", False),
            ("huquqiy_krossvord", "Huquqiy Krossvord", "Tayanch atamalar boshqotirmasi", False),
            ("tezkor_qaror", "Tezkor Qaror", "Vaqt chegarasida qonuniy qaror", False),
            ("huquqiy_labirint", "Huquqiy Labirint", "Bosqichma-bosqich to'g'ri huquqiy yo'l", False),
            ("xatoni_top", "Xatoni Top", "Matndagi yuridik xatoni aniqlang", False),
            ("voqeani_tahlil_qil", "Voqeani Tahlil Qil", "Amaliy keysni tizimli yechish", False),
        ]
        for slug, title, sub, is_sim in games_data:
            Game.objects.get_or_create(
                slug=slug,
                defaults={
                    "title": title,
                    "subtitle": sub,
                    "rules": "Har bir to'g'ri javob uchun ball va XP beriladi.",
                    "educational_goal": "Huquqiy tafakkurni rivojlantirish.",
                    "is_simulation": is_sim,
                },
            )

        Achievement.objects.get_or_create(
            code="constitution-guardian",
            defaults={
                "title": "Konstitutsiya posboni",
                "description": "Birinchi test va darsni muvaffaqiyatli yakunlagan o'quvchi.",
                "xp_threshold": 100,
                "badge_type": "shield",
            },
        )

        # Demo users
        for email, password, full_name, role, grade_num, xp, level in [
            ("admin@huquqolami.uz", "Admin123!", "Akmaljon Karimov (Administrator)", User.Role.ADMIN, 11, 1650, 9),
            ("oqituvchi@huquqolami.uz", "Teacher123!", "Nargiza Ismatova (Ustoz)", User.Role.TEACHER, 9, 980, 6),
            ("oquvchi@huquqolami.uz", "Student123!", "Azizbek Toshmatov", User.Role.STUDENT, 9, 340, 3),
        ]:
            user, created = User.objects.get_or_create(
                email=email,
                defaults={
                    "full_name": full_name,
                    "role": role,
                    "grade_number": grade_num,
                    "xp": xp,
                    "level": level,
                    "is_staff": role == User.Role.ADMIN,
                    "is_superuser": role == User.Role.ADMIN,
                },
            )
            if created:
                user.set_password(password)
                user.save()
                if role == User.Role.STUDENT:
                    StudentProfile.objects.get_or_create(user=user, grade_number=grade_num)
                else:
                    TeacherProfile.objects.get_or_create(user=user)

        teacher = User.objects.filter(role=User.Role.TEACHER).first()
        if teacher:
            Assignment.objects.get_or_create(
                title="9-sinf: Konstitutsiya asoslari",
                defaults={
                    "description": "15-modda bo'yicha 2 ta amaliy misol yozing.",
                    "grade_number": 9,
                    "due_date": "2026-06-01",
                    "teacher": teacher,
                    "teacher_name": teacher.full_name,
                },
            )

        self.stdout.write(self.style.SUCCESS("HUQUQ OLAMI boshlang'ich ma'lumotlari muvaffaqiyatli yuklandi."))
