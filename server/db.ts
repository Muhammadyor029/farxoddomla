import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

export function createDatabase(dbPath?: string): DatabaseSync {
  const targetPath = dbPath || process.env.SQLITE_PATH || "./data/huquq_olami.db";
  if (targetPath !== ":memory:") {
    const dir = path.dirname(targetPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  const db = new DatabaseSync(targetPath);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('student', 'teacher', 'admin')),
      grade_number INTEGER DEFAULT 9,
      class_name TEXT DEFAULT '9-A',
      school_name TEXT DEFAULT '1-umumta''lim maktabi',
      xp INTEGER DEFAULT 0,
      level INTEGER DEFAULT 1,
      streak_days INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS student_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE NOT NULL,
      grade_number INTEGER NOT NULL DEFAULT 9,
      weekly_goal_lessons INTEGER DEFAULT 5,
      bio TEXT DEFAULT '',
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS teacher_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE NOT NULL,
      subject_name TEXT DEFAULT 'Davlat va huquq asoslari',
      department TEXT DEFAULT 'Ijtimoiy-gumanitar fanlar',
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS subjects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      code TEXT UNIQUE NOT NULL,
      description TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS grades (
      id INTEGER PRIMARY KEY,
      grade_number INTEGER UNIQUE NOT NULL,
      title TEXT NOT NULL,
      subtitle TEXT NOT NULL,
      description TEXT NOT NULL,
      textbook_title TEXT NOT NULL,
      textbook_year TEXT NOT NULL,
      textbook_authors TEXT NOT NULL,
      pdf_path TEXT NOT NULL,
      total_pages INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS chapters (
      id INTEGER PRIMARY KEY,
      grade_number INTEGER NOT NULL,
      chapter_number INTEGER NOT NULL,
      roman_numeral TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      page_range TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS lessons (
      id INTEGER PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      grade_number INTEGER NOT NULL,
      chapter_id INTEGER NOT NULL,
      chapter_title TEXT NOT NULL,
      lesson_number_label TEXT NOT NULL,
      order_index INTEGER NOT NULL,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      page_number INTEGER NOT NULL,
      estimated_minutes INTEGER DEFAULT 45,
      status TEXT NOT NULL DEFAULT 'verified' CHECK(status IN ('verified', 'draft')),
      presentation_id INTEGER,
      quiz_id INTEGER,
      FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS lesson_contents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lesson_id INTEGER UNIQUE NOT NULL,
      content_json TEXT NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS legal_terms (
      id INTEGER PRIMARY KEY,
      term TEXT NOT NULL,
      grade_number INTEGER NOT NULL,
      lesson_id INTEGER,
      short_definition TEXT NOT NULL,
      extended_note TEXT NOT NULL,
      life_example TEXT NOT NULL,
      source_page TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS presentations (
      id INTEGER PRIMARY KEY,
      lesson_id INTEGER NOT NULL,
      grade_number INTEGER NOT NULL,
      title TEXT NOT NULL,
      template_name TEXT NOT NULL DEFAULT 'Huquq Olami Neon-Grafit',
      status TEXT NOT NULL DEFAULT 'verified',
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS presentation_slides (
      id TEXT PRIMARY KEY,
      presentation_id INTEGER NOT NULL,
      slide_order INTEGER NOT NULL,
      layout TEXT NOT NULL,
      title TEXT NOT NULL,
      subtitle TEXT DEFAULT '',
      slide_json TEXT NOT NULL,
      FOREIGN KEY (presentation_id) REFERENCES presentations(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS quizzes (
      id INTEGER PRIMARY KEY,
      lesson_id INTEGER NOT NULL,
      grade_number INTEGER NOT NULL,
      title TEXT NOT NULL,
      time_limit_minutes INTEGER DEFAULT 12,
      status TEXT NOT NULL DEFAULT 'verified'
    );

    CREATE TABLE IF NOT EXISTS questions (
      id TEXT PRIMARY KEY,
      quiz_id INTEGER NOT NULL,
      question_order INTEGER NOT NULL,
      question_type TEXT NOT NULL,
      prompt TEXT NOT NULL,
      question_json TEXT NOT NULL,
      points INTEGER DEFAULT 10,
      FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS answer_options (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question_id TEXT NOT NULL,
      option_order INTEGER NOT NULL,
      option_text TEXT NOT NULL,
      is_correct INTEGER DEFAULT 0,
      FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS quiz_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      quiz_id INTEGER NOT NULL,
      quiz_title TEXT NOT NULL,
      grade_number INTEGER NOT NULL,
      score INTEGER NOT NULL,
      max_score INTEGER NOT NULL,
      percentage REAL NOT NULL,
      elapsed_seconds INTEGER NOT NULL,
      correct_count INTEGER NOT NULL,
      total_questions INTEGER NOT NULL,
      recommendations_json TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS games (
      id INTEGER PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      subtitle TEXT NOT NULL,
      rules TEXT NOT NULL,
      educational_goal TEXT NOT NULL,
      is_simulation INTEGER DEFAULT 0,
      xp_reward INTEGER DEFAULT 100,
      difficulty TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS game_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      game_slug TEXT NOT NULL,
      game_title TEXT NOT NULL,
      grade_number INTEGER NOT NULL,
      lesson_id INTEGER,
      score INTEGER NOT NULL,
      max_score INTEGER NOT NULL,
      xp_earned INTEGER NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS legal_scenarios (
      id INTEGER PRIMARY KEY,
      grade_number INTEGER NOT NULL,
      category TEXT NOT NULL,
      title TEXT NOT NULL,
      scenario_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS legislation_articles (
      id INTEGER PRIMARY KEY,
      code_name TEXT NOT NULL,
      article_number TEXT NOT NULL,
      title TEXT NOT NULL,
      grade_number INTEGER NOT NULL,
      summary_text TEXT NOT NULL,
      practical_meaning TEXT NOT NULL,
      source_page TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS achievements (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      xp_threshold INTEGER NOT NULL,
      badge_type TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS student_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      lesson_id INTEGER NOT NULL,
      completed INTEGER DEFAULT 1,
      quiz_best_score INTEGER DEFAULT 0,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, lesson_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      grade_number INTEGER NOT NULL,
      lesson_id INTEGER,
      due_date TEXT NOT NULL,
      teacher_id INTEGER,
      teacher_name TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS assignment_submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      assignment_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      answer_text TEXT NOT NULL,
      score INTEGER,
      feedback TEXT DEFAULT '',
      submitted_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(assignment_id, student_id),
      FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE,
      FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS resources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      resource_type TEXT NOT NULL,
      grade_number INTEGER NOT NULL,
      file_url TEXT NOT NULL,
      description TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ai_settings (
      id INTEGER PRIMARY KEY CHECK(id = 1),
      model_name TEXT NOT NULL DEFAULT 'gemini-4-hydrogen',
      pedagogical_tone TEXT NOT NULL DEFAULT 'Sodda, darslikka asoslangan va misollar bilan',
      strict_grounding INTEGER NOT NULL DEFAULT 1,
      enabled INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  return db;
}
