# HUQUQ OLAMI — Django + DRF + PostgreSQL Backend

O'zbekiston umumiy o'rta ta'lim maktablari (8–11-sinf, **"Davlat va huquq asoslari"**) uchun mo'ljallangan **HUQUQ OLAMI** platformasining mustaqil Django REST Framework + PostgreSQL + Redis + Docker backend moduli.

## Arxitektura
- `apps.accounts`: Maxsus `User` modeli (`student`, `teacher`, `admin`), `StudentProfile`, `TeacherProfile`, JWT (`SimpleJWT`) autentifikatsiya va RBAC ruxsatlar.
- `apps.curriculum`: `Grade`, `Subject`, `Chapter`, `Lesson`, `LessonContent` (16 qismli dars tuzilmasi), `LegalTerm`, `LegalScenario`, `LegislationArticle`, `Resource` va `seed_huquq_olami` boshqaruv buyrug'i.
- `apps.assessments`: `Quiz`, `Question`, `AnswerOption`, `QuizAttempt`, `Assignment`, `AssignmentSubmission`, `StudentProgress`, `Achievement`, `Game`, `GameAttempt`.
- `apps.presentations`: `Presentation`, `PresentationSlide` (tahrirlash, tartiblash, saqlash).
- `apps.ai_assistant`: `google-genai` (`gemini-4-hydrogen`) asosida darslikka tayangan server-tomonlama AI huquqiy ustoz xizmati.

## Tezkor ishga tushirish (Docker)
```bash
cd backend
cp .env.example .env
# .env ichida POSTGRES_PASSWORD va GEMINI_API_KEY qiymatlarini kiriting
docker compose up --build -d
```

## Lokal muhitda ishga tushirish (SQLite yoki PostgreSQL)
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_huquq_olami
python manage.py runserver 0.0.0.0:8000
```

## Testlarni ishga tushirish
```bash
cd backend
pytest
```

## Demo foydalanuvchilar (`seed_huquq_olami` orqali yaratiladi)
- Administrator: `admin@huquqolami.uz` / `Admin123!`
- O'qituvchi: `oqituvchi@huquqolami.uz` / `Teacher123!`
- O'quvchi: `oquvchi@huquqolami.uz` / `Student123!`
