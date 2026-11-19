import { useEffect, useState } from "react";
import {
  Award,
  Trophy,
  Flame,
  BookOpen,
  Printer,
  FileDown,
  Users,
  PlusCircle,
  ShieldAlert,
  Settings,
  CheckCircle2,
  Trash2,
  Bell,
  BookmarkCheck,
} from "lucide-react";
import type { AchievementItem, GameAttemptRecord, LessonInfo, QuizAttemptRecord } from "../../shared/types";
import { apiRequest, notifyNotificationsUpdated, type AdminNotificationData } from "../lib/api";
import { exportDocumentAsPdf } from "../lib/pdfExport";
import { useAuth } from "../contexts/AuthContext";
import { resourceTypeLabel } from "../components/AccessRequestButton";
import { Button } from "../components/ui/button";

interface StudentDashboard {
  user?: { completedLessons?: number; totalLessons?: number };
  completedLessons?: number;
  totalLessons?: number;
  milestones?: Array<{
    id: string | number;
    title: string;
    description?: string;
    requiredCount?: number;
    achieved?: boolean;
  }>;
  achievements?: AchievementItem[];
  progress?: Array<{
    lesson_id: number;
    title: string;
    grade_number: number;
    lesson_number_label: string;
    quiz_best_score: number;
  }>;
  quizAttempts?: QuizAttemptRecord[];
  gameAttempts?: GameAttemptRecord[];
  assignments?: Array<{
    id: number;
    title: string;
    description: string;
    gradeNumber: number;
    dueDate: string;
    teacherName: string;
    submitted: boolean;
    answerText: string;
    score: number | null;
    feedback: string;
  }>;
  leaderboard?: Array<{
    id: number;
    full_name: string;
    grade_number: number;
    class_name: string;
    completed_lessons?: number;
  }>;
}

function CompletedMarker() {
  return (
    <span className="inline-flex items-center gap-1 rounded-sm border border-emerald/40 bg-emerald/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald">
      <BookmarkCheck className="w-3 h-3" /> Yakunlandi
    </span>
  );
}

function completionSafeDescription(text: string | undefined, requiredCount?: number): string {
  if (!text || /\bxp\b/i.test(text)) {
    return requiredCount && requiredCount > 0
      ? `${requiredCount} ta darsni yakunlaganingizda ochiladi.`
      : "Darslarni yakunlash orqali oching.";
  }
  return text;
}

function AuthRequiredCard({
  title,
  description,
  onOpenAuth,
}: {
  title: string;
  description?: string;
  onOpenAuth: () => void;
}) {
  return (
    <div className="max-w-3xl mx-auto px-4 pt-28 pb-16">
      <div className="rounded-2xl border border-border bg-card p-8 text-center space-y-4">
        <ShieldAlert className="w-10 h-10 text-primary mx-auto" />
        <h2 className="text-2xl font-bold text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground">
          {description || "Ushbu bo'limga kirish uchun tizimga kiring."}
        </p>
        <Button onClick={onOpenAuth}>Tizimga kirish</Button>
      </div>
    </div>
  );
}

/* ==================== 11. STUDENT CABINET PAGE ==================== */
export function StudentCabinetPage({
  onOpenAuth,
  onSelectLesson,
}: {
  onOpenAuth: () => void;
  onSelectLesson: (id: number) => void;
}) {
  const { user, refreshUser } = useAuth();
  const [data, setData] = useState<StudentDashboard | null>(null);
  const [draftAnswers, setDraftAnswers] = useState<Record<number, string>>({});
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const loadDashboard = () => {
    if (!user) return;
    apiRequest<StudentDashboard>("/api/student/dashboard")
      .then((res) => {
        if (res) setData(res);
      })
      .catch((err) => {
        setStatusMsg(err instanceof Error ? err.message : "Kabinet ma'lumotlarini yuklashda xatolik.");
      });
  };

  useEffect(() => {
    loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  if (!user) {
    return (
      <AuthRequiredCard
        title="Shaxsiy kabinet"
        description="Yakunlangan darslar, natijalar va shaxsiy profilni ko'rish uchun tizimga kiring."
        onOpenAuth={onOpenAuth}
      />
    );
  }

  async function submitHomework(assignmentId: number) {
    const text = (draftAnswers[assignmentId] || "").trim();
    if (!text) return;
    await apiRequest(`/api/student/assignments/${assignmentId}/submit`, {
      method: "POST",
      body: JSON.stringify({ answerText: text }),
    });
    setStatusMsg("Uyga vazifa topshirildi!");
    refreshUser();
    loadDashboard();
  }

  function downloadStudentReport() {
    if (!user || !data) return;
    const done = data.completedLessons ?? data.user?.completedLessons ?? data.progress?.length ?? 0;
    const total = data.totalLessons ?? data.user?.totalLessons ?? done;
    exportDocumentAsPdf({
      filename: `oquvchi-hisoboti-${user.id}`,
      docTitle: `O'quvchi natijalari hisoboti: ${user.fullName}`,
      docSubtitle: `${user.gradeNumber}-sinf · ${user.schoolName || ""} · Yakunlangan darslar: ${done}/${total}`,
      blocks: [
        {
          heading: "1. Umumiy ko'rsatkichlar",
          accent: true,
          body: [
            `Yakunlangan darslar: ${done} / ${total} ta`,
            `Topshirilgan testlar: ${data.quizAttempts?.length ?? 0} ta`,
            `O'ynalgan huquqiy o'yinlar: ${data.gameAttempts?.length ?? 0} ta`,
          ],
        },
        {
          heading: "2. Test natijalari",
          body:
            (data.quizAttempts?.length ?? 0) > 0
              ? (data.quizAttempts ?? []).map((q) => `${q.quizTitle}: ${q.score}/${q.maxScore} (${q.percentage}%)`)
              : ["Hali test topshirilmagan"],
        },
        {
          heading: "3. Yakunlangan mavzular",
          body:
            (data.progress?.length ?? 0) > 0
              ? (data.progress ?? []).map((p) => `${p.grade_number}-sinf · ${p.lesson_number_label} ${p.title} (Eng yuqori ball: ${p.quiz_best_score}%)`)
              : ["Hali mavzular yakunlanmagan"],
        },
      ],
    });
  }

  const completedLessons = data?.completedLessons ?? data?.user?.completedLessons ?? data?.progress?.length ?? 0;
  const totalLessons =
    data?.totalLessons ?? data?.user?.totalLessons ?? Math.max(completedLessons, data?.progress?.length ?? 0);
  const completionPct =
    totalLessons > 0 ? Math.min(100, Math.round((completedLessons / totalLessons) * 100)) : 0;
  const milestones = data?.milestones?.length
    ? data.milestones
    : (data?.achievements ?? []).map((a) => ({
        id: a.id,
        title: a.title,
        description: a.description,
        requiredCount: undefined,
        achieved: a.unlocked,
      }));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 pt-24 pb-16 space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4 no-print">
        <div>
          <span className="text-xs font-semibold uppercase tracking-widest text-primary">O&apos;quvchi kabineti</span>
          <h1 className="text-2xl sm:text-4xl font-bold text-foreground mt-1">{user.fullName}</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            {user.gradeNumber}-sinf ({user.className}) · {user.schoolName}
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => window.print()} className="gap-1.5 text-xs">
            <Printer className="w-3.5 h-3.5" /> Hisobotni chop etish
          </Button>
          <Button size="sm" variant="secondary" onClick={downloadStudentReport} className="gap-1.5 text-xs">
            <FileDown className="w-3.5 h-3.5" /> PDF hisobot
          </Button>
        </div>
      </div>

      {statusMsg && (
        <div className="rounded-xl border border-primary/40 bg-primary/10 px-4 py-2.5 text-xs text-primary no-print">
          {statusMsg}
        </div>
      )}

      {/* Completed lessons overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-primary/40 bg-card p-5 space-y-2 md:col-span-2 print-section">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-primary">Yakunlangan darslar</span>
            <span className="text-muted-foreground tabular-nums">
              {completedLessons} / {totalLessons}
            </span>
          </div>
          <div className="h-2.5 rounded-full bg-secondary overflow-hidden">
            <div className="h-full bg-primary transition-all" style={{ width: `${completionPct}%` }} />
          </div>
          <div className="text-xs text-muted-foreground">
            Har bir yakunlangan dars sizning o&apos;zlashtirish ko&apos;rsatkichingizni oshiradi.
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 print-section">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <BookOpen className="w-4 h-4 text-primary" /> Yakunlangan mavzular
          </div>
          <div className="text-3xl font-bold text-foreground mt-2 tabular-nums">{completedLessons}</div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 print-section">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Flame className="w-4 h-4 text-emerald" /> Faol kunlar seriyasi
          </div>
          <div className="text-3xl font-bold text-primary mt-2 tabular-nums">{user.streakDays ?? 0} kun</div>
        </div>
      </div>

      {/* Milestones */}
      {data && milestones.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-6 space-y-4 print-section">
          <h3 className="text-base font-bold text-foreground flex items-center gap-2">
            <Award className="w-5 h-5 text-primary" /> Yutuqlar va Nishonlar
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {milestones.map((ms) => {
              const achieved = Boolean(ms.achieved);
              const required = ms.requiredCount ?? 0;
              return (
                <div
                  key={ms.id}
                  className={`rounded-xl border p-4 space-y-1.5 ${
                    achieved ? "border-primary/50 bg-primary/10" : "border-border bg-background/50 opacity-60"
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <Trophy className={`w-4 h-4 ${achieved ? "text-primary" : "text-muted-foreground"}`} />
                    {achieved ? (
                      <CompletedMarker />
                    ) : (
                      <span className="text-[11px] font-semibold tabular-nums text-emerald">
                        {required > 0 ? `${required} ta dars` : "Nishon"}
                      </span>
                    )}
                  </div>
                  <div className="text-xs font-bold text-foreground">{ms.title}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {completionSafeDescription(ms.description, required)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Assignments + Progress + Leaderboard */}
      {data && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 space-y-4">
            <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
              <h3 className="text-base font-bold text-foreground">O&apos;qituvchi vazifalari</h3>
              {(data.assignments ?? []).map((asg) => (
                <div key={asg.id} className="rounded-xl border border-border bg-background/60 p-4 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-primary">{asg.gradeNumber}-sinf · {asg.teacherName}</span>
                    <span className="text-muted-foreground tabular-nums">Muddat: {asg.dueDate}</span>
                  </div>
                  <div className="text-sm font-bold text-foreground">{asg.title}</div>
                  <p className="text-xs text-muted-foreground">{asg.description}</p>
                  {asg.submitted ? (
                    <div className="rounded-lg border border-primary/30 bg-primary/10 p-3 text-xs space-y-1">
                      <div className="font-semibold text-primary flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Topshirilgan
                        {asg.score !== null && ` · Baho: ${asg.score}/100`}
                      </div>
                      <p className="text-foreground/90">{asg.answerText}</p>
                      {asg.feedback && <p className="text-emerald">Ustoz izohi: {asg.feedback}</p>}
                    </div>
                  ) : (
                    <div className="flex gap-2 pt-1 no-print">
                      <input
                        type="text"
                        value={draftAnswers[asg.id] || ""}
                        onChange={(e) => setDraftAnswers((prev) => ({ ...prev, [asg.id]: e.target.value }))}
                        placeholder="Javobingizni yozing..."
                        className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-xs text-foreground"
                      />
                      <Button size="sm" onClick={() => submitHomework(asg.id)}>
                        Topshirish
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-border bg-card p-6 space-y-3 print-section">
              <h3 className="text-base font-bold text-foreground">So&apos;nggi test va o&apos;yin natijalari</h3>
              {(data.quizAttempts ?? []).map((qa) => (
                <div key={qa.id} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-background/60 p-3 text-xs">
                  <span className="font-medium text-foreground truncate">{qa.quizTitle}</span>
                  <span className="text-primary font-bold tabular-nums shrink-0">{qa.percentage}%</span>
                </div>
              ))}
              {(data.gameAttempts ?? []).map((ga) => (
                <div key={ga.id} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-background/60 p-3 text-xs">
                  <span className="font-medium text-foreground">{ga.gameTitle}</span>
                  <span className="text-emerald font-bold tabular-nums shrink-0">{ga.score}/{ga.maxScore}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-5 space-y-4">
            <div className="rounded-2xl border border-border bg-card p-6 space-y-3 print-section">
              <h3 className="text-base font-bold text-foreground">Yakunlangan mavzular</h3>
              {(data.progress?.length ?? 0) === 0 ? (
                <p className="text-xs text-muted-foreground">Hali birorta mavzu yakunlanmagan.</p>
              ) : (
                (data.progress ?? []).map((p) => (
                  <button
                    key={p.lesson_id}
                    type="button"
                    onClick={() => onSelectLesson(p.lesson_id)}
                    className="w-full flex items-center justify-between gap-2 rounded-lg border border-border bg-background/60 p-3 text-left text-xs hover:border-primary/50 cursor-pointer"
                  >
                    <span className="font-medium text-foreground truncate">
                      {p.grade_number}-sinf · {p.title}
                    </span>
                    <span className="flex items-center gap-2 shrink-0">
                      <CompletedMarker />
                      <span className="text-primary font-bold tabular-nums">{p.quiz_best_score}%</span>
                    </span>
                  </button>
                ))
              )}
            </div>

            <div className="rounded-2xl border border-border bg-card p-6 space-y-3 print-section">
              <h3 className="text-base font-bold text-foreground">Eng ko&apos;p dars yakunlagan o&apos;quvchilar</h3>
              <div className="flex items-center justify-between gap-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                <span>O&apos;quvchi</span>
                <span>Yakunlangan darslar</span>
              </div>
              {(data.leaderboard ?? []).map((st, idx) => (
                <div key={st.id} className="flex items-center justify-between rounded-lg border border-border bg-background/60 p-3 text-xs">
                  <div className="flex items-center gap-2.5">
                    <span className="w-5 h-5 rounded-md bg-primary/15 text-primary font-bold flex items-center justify-center tabular-nums">
                      {idx + 1}
                    </span>
                    <div>
                      <div className="font-semibold text-foreground">{st.full_name}</div>
                      <div className="text-[11px] text-muted-foreground">{st.grade_number}-sinf · {st.class_name}</div>
                    </div>
                  </div>
                  <span className="font-bold text-primary tabular-nums">{st.completed_lessons ?? 0}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ==================== 12. TEACHER CABINET PAGE ==================== */
export function TeacherCabinetPage({ onOpenAuth }: { onOpenAuth: () => void }) {
  const { user } = useAuth();
  const [tab, setTab] = useState<"students" | "create_lesson" | "create_quiz" | "assignments">("students");
  const [dash, setDash] = useState<{
    students: Array<{
      id: number;
      full_name: string;
      email: string;
      grade_number: number;
      class_name: string;
      completed_lessons?: number;
      avg_quiz_score?: number | null;
    }>;
    assignments: Array<{ id: number; title: string; grade_number: number; due_date: string }>;
    submissions: Array<{
      id: number;
      student_name: string;
      grade_number: number;
      assignment_title: string;
      answer_text: string;
      score: number | null;
      feedback: string;
    }>;
  } | null>(null);

  const [lessonForm, setLessonForm] = useState({
    gradeNumber: 9,
    lessonNumberLabel: "Qo'shimcha dars",
    title: "",
    summary: "",
    objective: "",
    status: "verified",
  });
  const [quizForm, setQuizForm] = useState({
    quizId: 9001,
    prompt: "",
    optA: "",
    optB: "",
    optC: "",
    correctIndex: 0,
    explanation: "",
  });
  const [asgForm, setAsgForm] = useState({
    title: "",
    description: "",
    gradeNumber: 9,
    dueDate: "2026-06-05",
  });
  const [toast, setToast] = useState<string | null>(null);

  const loadTeacherDash = () => {
    if (!user || (user.role !== "teacher" && user.role !== "admin")) return;
    apiRequest<typeof dash>("/api/teacher/dashboard")
      .then((res) => {
        if (res) setDash(res);
      })
      .catch((err) => {
        setToast(err instanceof Error ? err.message : "O'qituvchi kabinetini yuklashda xatolik.");
      });
  };

  useEffect(() => {
    loadTeacherDash();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.role]);

  if (!user || (user.role !== "teacher" && user.role !== "admin")) {
    return (
      <AuthRequiredCard
        title="Dars va test studiyasi"
        description="Ushbu boshqaruv bo'limi faqat ruxsat etilgan profil uchun ochiq."
        onOpenAuth={onOpenAuth}
      />
    );
  }

  function downloadCsvReport() {
    if (!dash) return;
    const header = "Ism-familiya,Sinf,Guruh,Yakunlangan darslar,O'rtacha test (%)";
    const rows = (dash.students ?? []).map(
      (s) => `"${s.full_name}",${s.grade_number},"${s.class_name}",${s.completed_lessons ?? 0},${s.avg_quiz_score ?? 0}`
    );
    const blob = new Blob([header + "\n" + rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sinf-natijalari.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleCreateLesson(e: React.FormEvent) {
    e.preventDefault();
    const res = await apiRequest<{ id: number }>("/api/teacher/lessons", {
      method: "POST",
      body: JSON.stringify(lessonForm),
    });
    setToast(`Yangi dars yaratildi (ID: ${res.id})!`);
    setLessonForm({ ...lessonForm, title: "", summary: "", objective: "" });
  }

  async function handleAddQuestion(e: React.FormEvent) {
    e.preventDefault();
    await apiRequest(`/api/teacher/quizzes/${quizForm.quizId}/questions`, {
      method: "POST",
      body: JSON.stringify({
        prompt: quizForm.prompt,
        options: [quizForm.optA, quizForm.optB, quizForm.optC],
        correctIndex: quizForm.correctIndex,
        explanation: quizForm.explanation,
      }),
    });
    setToast(`Savol Test #${quizForm.quizId} ga qo'shildi!`);
    setQuizForm({ ...quizForm, prompt: "", optA: "", optB: "", optC: "", explanation: "" });
  }

  async function handleCreateAssignment(e: React.FormEvent) {
    e.preventDefault();
    await apiRequest("/api/teacher/assignments", {
      method: "POST",
      body: JSON.stringify(asgForm),
    });
    setToast("Yangi uyga vazifa yaratildi!");
    setAsgForm({ ...asgForm, title: "", description: "" });
    loadTeacherDash();
  }

  async function gradeSubmission(subId: number, score: number) {
    await apiRequest(`/api/teacher/submissions/${subId}/grade`, {
      method: "POST",
      body: JSON.stringify({ score, feedback: "O'qituvchi tomonidan baholandi." }),
    });
    setToast("Baho saqlandi!");
    loadTeacherDash();
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 pt-24 pb-16 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 no-print">
        <div>
          <span className="text-xs font-semibold uppercase tracking-widest text-primary">Pedagogik markaz</span>
          <h1 className="text-2xl sm:text-4xl font-bold text-foreground mt-1">O&apos;qituvchi kabineti</h1>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => window.print()} className="gap-1.5 text-xs">
            <Printer className="w-3.5 h-3.5" /> Chop etish
          </Button>
          <Button size="sm" variant="secondary" onClick={downloadCsvReport} className="gap-1.5 text-xs">
            <FileDown className="w-3.5 h-3.5" /> CSV hisobot yuklash
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 no-print">
        <Button size="sm" variant={tab === "students" ? "default" : "secondary"} onClick={() => setTab("students")} className="gap-1.5 text-xs">
          <Users className="w-3.5 h-3.5" /> O&apos;quvchilar va jurnal
        </Button>
        <Button size="sm" variant={tab === "create_lesson" ? "default" : "secondary"} onClick={() => setTab("create_lesson")} className="gap-1.5 text-xs">
          <PlusCircle className="w-3.5 h-3.5" /> Dars yaratish
        </Button>
        <Button size="sm" variant={tab === "create_quiz" ? "default" : "secondary"} onClick={() => setTab("create_quiz")} className="gap-1.5 text-xs">
          <PlusCircle className="w-3.5 h-3.5" /> Test savoli qo&apos;shish
        </Button>
        <Button size="sm" variant={tab === "assignments" ? "default" : "secondary"} onClick={() => setTab("assignments")} className="gap-1.5 text-xs">
          <BookOpen className="w-3.5 h-3.5" /> Uyga vazifa va tekshirish
        </Button>
      </div>

      {toast && (
        <div className="rounded-xl border border-primary/40 bg-primary/10 px-4 py-2.5 text-xs text-primary">{toast}</div>
      )}

      {tab === "students" && dash && (
        <div className="rounded-2xl border border-border bg-card overflow-x-auto print-section">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="border-b border-border bg-secondary/50 text-xs text-muted-foreground">
              <tr>
                <th className="p-4">O&apos;quvchi</th>
                <th className="p-4">Sinf</th>
                <th className="p-4">Yakunlangan darslar</th>
                <th className="p-4">O&apos;rtacha test</th>
                <th className="p-4">Holat</th>
              </tr>
            </thead>
            <tbody>
              {(dash.students ?? []).map((s) => (
                <tr key={s.id} className="border-b border-border/50">
                  <td className="p-4 font-semibold text-foreground">{s.full_name}</td>
                  <td className="p-4 text-muted-foreground">{s.grade_number}-sinf ({s.class_name})</td>
                  <td className="p-4 text-primary font-bold tabular-nums">{s.completed_lessons ?? 0}</td>
                  <td className="p-4 tabular-nums text-emerald font-semibold">{s.avg_quiz_score ?? 0}%</td>
                  <td className="p-4">{(s.completed_lessons ?? 0) > 0 ? <CompletedMarker /> : <span className="text-muted-foreground">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "create_lesson" && (
        <form onSubmit={handleCreateLesson} className="rounded-2xl border border-border bg-card p-6 space-y-4 max-w-2xl">
          <h3 className="text-lg font-bold text-foreground">Yangi dars mavzusi yaratish</h3>
          <div className="grid grid-cols-2 gap-3 text-xs sm:text-sm">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Sinf</label>
              <select
                value={lessonForm.gradeNumber}
                onChange={(e) => setLessonForm({ ...lessonForm, gradeNumber: Number(e.target.value) })}
                className="w-full rounded-lg border border-input bg-background px-3 py-2"
              >
                {[8, 9, 10, 11].map((g) => (
                  <option key={g} value={g}>{g}-sinf</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Holat</label>
              <select
                value={lessonForm.status}
                onChange={(e) => setLessonForm({ ...lessonForm, status: e.target.value })}
                className="w-full rounded-lg border border-input bg-background px-3 py-2"
              >
                <option value="verified">Tasdiqlangan (Verified)</option>
                <option value="draft">Qoralama (Draft)</option>
              </select>
            </div>
          </div>
          <input
            required
            type="text"
            placeholder="Mavzu nomi..."
            value={lessonForm.title}
            onChange={(e) => setLessonForm({ ...lessonForm, title: e.target.value })}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
          />
          <textarea
            required
            rows={3}
            placeholder="Qisqa mazmun va asosiy qonun qoidasi..."
            value={lessonForm.summary}
            onChange={(e) => setLessonForm({ ...lessonForm, summary: e.target.value })}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
          />
          <input
            type="text"
            placeholder="Dars maqsadi..."
            value={lessonForm.objective}
            onChange={(e) => setLessonForm({ ...lessonForm, objective: e.target.value })}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
          />
          <Button type="submit">Darsni yaratish va saqlash</Button>
        </form>
      )}

      {tab === "create_quiz" && (
        <form onSubmit={handleAddQuestion} className="rounded-2xl border border-border bg-card p-6 space-y-3 max-w-2xl">
          <h3 className="text-lg font-bold text-foreground">Mavjud testga yangi savol qo&apos;shish</h3>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Test ID (masalan: 8001, 9001, 10001, 11001)</label>
            <input
              type="number"
              value={quizForm.quizId}
              onChange={(e) => setQuizForm({ ...quizForm, quizId: Number(e.target.value) })}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <input
            required
            type="text"
            placeholder="Savol matni..."
            value={quizForm.prompt}
            onChange={(e) => setQuizForm({ ...quizForm, prompt: e.target.value })}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
          />
          <input
            required
            type="text"
            placeholder="Variant A"
            value={quizForm.optA}
            onChange={(e) => setQuizForm({ ...quizForm, optA: e.target.value })}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
          />
          <input
            required
            type="text"
            placeholder="Variant B"
            value={quizForm.optB}
            onChange={(e) => setQuizForm({ ...quizForm, optB: e.target.value })}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
          />
          <input
            required
            type="text"
            placeholder="Variant C"
            value={quizForm.optC}
            onChange={(e) => setQuizForm({ ...quizForm, optC: e.target.value })}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
          />
          <select
            value={quizForm.correctIndex}
            onChange={(e) => setQuizForm({ ...quizForm, correctIndex: Number(e.target.value) })}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
          >
            <option value={0}>To&apos;g&apos;ri javob: A</option>
            <option value={1}>To&apos;g&apos;ri javob: B</option>
            <option value={2}>To&apos;g&apos;ri javob: C</option>
          </select>
          <input
            type="text"
            placeholder="Qisqa izoh..."
            value={quizForm.explanation}
            onChange={(e) => setQuizForm({ ...quizForm, explanation: e.target.value })}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
          />
          <Button type="submit">Savolni testga qo&apos;shish</Button>
        </form>
      )}

      {tab === "assignments" && dash && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <form onSubmit={handleCreateAssignment} className="rounded-2xl border border-border bg-card p-6 space-y-3">
            <h3 className="text-lg font-bold text-foreground">Yangi uyga vazifa berish</h3>
            <input
              required
              type="text"
              placeholder="Vazifa sarlavhasi..."
              value={asgForm.title}
              onChange={(e) => setAsgForm({ ...asgForm, title: e.target.value })}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            />
            <textarea
              required
              rows={3}
              placeholder="Vazifa sharti..."
              value={asgForm.description}
              onChange={(e) => setAsgForm({ ...asgForm, description: e.target.value })}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            />
            <div className="grid grid-cols-2 gap-2">
              <select
                value={asgForm.gradeNumber}
                onChange={(e) => setAsgForm({ ...asgForm, gradeNumber: Number(e.target.value) })}
                className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
              >
                {[8, 9, 10, 11].map((g) => (
                  <option key={g} value={g}>{g}-sinf</option>
                ))}
              </select>
              <input
                type="date"
                value={asgForm.dueDate}
                onChange={(e) => setAsgForm({ ...asgForm, dueDate: e.target.value })}
                className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <Button type="submit">Vazifani yuborish</Button>
          </form>

          <div className="rounded-2xl border border-border bg-card p-6 space-y-3">
            <h3 className="text-lg font-bold text-foreground">Topshirilgan ishlar</h3>
            {(dash.submissions?.length ?? 0) === 0 ? (
              <p className="text-xs text-muted-foreground">Hali topshirilgan vazifalar yo&apos;q.</p>
            ) : (
              (dash.submissions ?? []).map((sub) => (
                <div key={sub.id} className="rounded-xl border border-border bg-background/60 p-4 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <strong className="text-primary">{sub.student_name} ({sub.grade_number}-sinf)</strong>
                    <span>{sub.score !== null ? `Baho: ${sub.score}` : "Baholanmagan"}</span>
                  </div>
                  <div className="font-semibold text-foreground">{sub.assignment_title}</div>
                  <p className="text-muted-foreground">{sub.answer_text}</p>
                  <div className="flex gap-2">
                    {[100, 85, 70].map((sc) => (
                      <Button key={sc} size="sm" variant="secondary" onClick={() => gradeSubmission(sub.id, sc)}>
                        {sc} ball
                      </Button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ==================== 13. ADMIN PANEL PAGE ==================== */
export function AdminPanelPage({ onOpenAuth }: { onOpenAuth: () => void }) {
  const { user } = useAuth();
  const [adminData, setAdminData] = useState<{
    users: Array<{ id: number; email: string; full_name: string; role: string; grade_number?: number }>;
    stats: {
      usersCount: number;
      lessonsCount: number;
      verifiedLessons: number;
      draftLessons: number;
      quizzesCount: number;
      quizAttemptsCount: number;
      gameAttemptsCount: number;
      presentationsCount: number;
    };
    aiSettings: { model_name: string; pedagogical_tone: string; strict_grounding: number; enabled: number };
  } | null>(null);
  const [lessons, setLessons] = useState<LessonInfo[]>([]);
  const [notifications, setNotifications] = useState<AdminNotificationData | null>(null);
  const [aiForm, setAiForm] = useState({ modelName: "gemini-4-hydrogen", pedagogicalTone: "", strictGrounding: true, enabled: true });
  const [msg, setMsg] = useState<string | null>(null);

  const loadNotifications = () => {
    if (!user || user.role !== "admin") return;
    apiRequest<AdminNotificationData>("/api/admin/notifications")
      .then((res) => setNotifications(res))
      .catch(() => setNotifications(null));
  };

  const loadAll = () => {
    if (!user || user.role !== "admin") return;
    loadNotifications();
    apiRequest<typeof adminData>("/api/admin/dashboard")
      .then((res) => {
        if (res) {
          setAdminData(res);
          if (res.aiSettings) {
            setAiForm({
              modelName: res.aiSettings.model_name,
              pedagogicalTone: res.aiSettings.pedagogical_tone,
              strictGrounding: res.aiSettings.strict_grounding === 1,
              enabled: res.aiSettings.enabled === 1,
            });
          }
        }
      })
      .catch((err) => {
        setMsg(err instanceof Error ? err.message : "Admin panel ma'lumotlarini yuklashda xatolik.");
      });
    apiRequest<{ lessons?: LessonInfo[] }>("/api/lessons")
      .then((res) => setLessons(Array.isArray(res?.lessons) ? res.lessons : []))
      .catch(() => setLessons([]));
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.role]);

  if (!user || user.role !== "admin") {
    return (
      <AuthRequiredCard
        title="Boshqaruv paneli"
        description="Ushbu boshqaruv paneli faqat ruxsat etilgan profil uchun ochiq."
        onOpenAuth={onOpenAuth}
      />
    );
  }

  async function toggleLessonStatus(l: LessonInfo) {
    const next = l.status === "verified" ? "draft" : "verified";
    await apiRequest(`/api/admin/lessons/${l.id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: next }),
    });
    setMsg(`Dars #${l.id} holati "${next}" ga o'zgartirildi.`);
    loadAll();
  }

  async function deleteLesson(id: number) {
    await apiRequest(`/api/admin/lessons/${id}`, { method: "DELETE" });
    setMsg(`Dars #${id} o'chirildi.`);
    loadAll();
  }

  async function saveAiSettings(e: React.FormEvent) {
    e.preventDefault();
    await apiRequest("/api/admin/ai-settings", {
      method: "PUT",
      body: JSON.stringify(aiForm),
    });
    setMsg("AI yordamchi sozlamalari saqlandi!");
  }

  async function reviewTeacherRequest(id: number, action: "approve" | "reject") {
    try {
      await apiRequest(`/api/admin/teacher-requests/${id}/${action}`, { method: "POST" });
      setMsg(action === "approve" ? "O'qituvchi akkaunti tasdiqlandi." : "O'qituvchi arizasi rad etildi.");
      loadNotifications();
      notifyNotificationsUpdated();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Ariza ko'rib chiqilmadi.");
    }
  }

  async function reviewAccessRequest(id: number, action: "approve" | "reject") {
    try {
      await apiRequest(`/api/admin/access-requests/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ action }),
      });
      setMsg(action === "approve" ? "Ruxsat so'rovi tasdiqlandi." : "Ruxsat so'rovi rad etildi.");
      loadNotifications();
      notifyNotificationsUpdated();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "So'rov ko'rib chiqilmadi.");
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 pt-24 pb-16 space-y-8">
      <div>
        <span className="text-xs font-semibold uppercase tracking-widest text-primary">Asosiy boshqaruv</span>
        <h1 className="text-2xl sm:text-4xl font-bold text-foreground mt-1">Boshqaruv paneli</h1>
      </div>

      <div id="bildirishnomalar" className="rounded-2xl border border-border bg-card p-6 space-y-4">
        <h3 className="text-base font-bold text-foreground flex items-center gap-2">
          <Bell className="w-4 h-4 text-primary" /> Bildirishnomalar / Tasdiqlashlar
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-2.5">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              O&apos;qituvchi arizalari ({notifications?.teacherRequests.length || 0})
            </h4>
            {!notifications || notifications.teacherRequests.length === 0 ? (
              <p className="text-xs text-muted-foreground">Hali kutilayotgan arizalar yo&apos;q.</p>
            ) : (
              notifications.teacherRequests.map((tr) => (
                <div
                  key={tr.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-background/60 p-3 text-xs"
                >
                  <div>
                    <div className="font-semibold text-foreground">{tr.fullName}</div>
                    <div className="text-muted-foreground">{tr.email} · {tr.gradeNumber}-sinf</div>
                    <div className="text-[11px] text-muted-foreground tabular-nums">
                      {new Date(tr.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => reviewTeacherRequest(tr.id, "approve")} className="text-[11px]">
                      Tasdiqlash
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => reviewTeacherRequest(tr.id, "reject")}
                      className="text-[11px]"
                    >
                      Rad etish
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="space-y-2.5">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Ruxsat so&apos;rovlari ({notifications?.accessRequests.filter((ar) => ar.status === "pending").length || 0})
            </h4>
            {!notifications ||
            notifications.accessRequests.filter((ar) => ar.status === "pending").length === 0 ? (
              <p className="text-xs text-muted-foreground">Hali kutilayotgan so&apos;rovlar yo&apos;q.</p>
            ) : (
              notifications.accessRequests
                .filter((ar) => ar.status === "pending")
                .map((ar) => (
                  <div
                    key={ar.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-background/60 p-3 text-xs"
                  >
                    <div>
                      <div className="font-semibold text-foreground">{ar.fullName}</div>
                      <div className="text-muted-foreground">{ar.email}</div>
                      <div className="text-[11px] text-primary">
                        {resourceTypeLabel(ar.resourceType)} · {ar.resourceId === 0 ? "Butun bo'lim" : `#${ar.resourceId}`}
                      </div>
                      <div className="text-[11px] text-muted-foreground tabular-nums">
                        {new Date(ar.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => reviewAccessRequest(ar.id, "approve")} className="text-[11px]">
                        Tasdiqlash
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => reviewAccessRequest(ar.id, "reject")}
                        className="text-[11px]"
                      >
                        Rad etish
                      </Button>
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>
      </div>

      {msg && <div className="rounded-xl border border-primary/40 bg-primary/10 px-4 py-2.5 text-xs text-primary">{msg}</div>}

      {adminData && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Foydalanuvchilar", value: adminData.stats?.usersCount ?? 0 },
              { label: "Jami mavzular", value: adminData.stats?.lessonsCount ?? 0 },
              { label: "Tasdiqlangan (Verified)", value: adminData.stats?.verifiedLessons ?? 0 },
              { label: "Test & O'yin urinishlari", value: (adminData.stats?.quizAttemptsCount ?? 0) + (adminData.stats?.gameAttemptsCount ?? 0) },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl border border-border bg-card p-5">
                <div className="text-xs text-muted-foreground">{s.label}</div>
                <div className="text-3xl font-bold text-primary mt-1 tabular-nums">{s.value}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Users list */}
            <div className="lg:col-span-7 rounded-2xl border border-border bg-card p-6 space-y-4">
              <h3 className="text-base font-bold text-foreground">Ro&apos;yxatdan o&apos;tgan foydalanuvchilar</h3>
              <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                {(adminData.users ?? []).map((u) => (
                  <div key={u.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-background/60 p-3 text-xs">
                    <div>
                      <div className="font-semibold text-foreground">{u.full_name}</div>
                      <div className="text-muted-foreground">{u.email}{typeof u.grade_number === "number" ? ` · ${u.grade_number}-sinf` : ""}</div>
                    </div>
                    <span className="text-[11px] font-medium px-2.5 py-1 rounded-sm border border-border bg-secondary/50 text-foreground">
                      {u.role === "admin" ? "Administrator" : u.role === "teacher" ? "O'qituvchi" : "O'quvchi"}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Settings */}
            <form onSubmit={saveAiSettings} className="lg:col-span-5 rounded-2xl border border-border bg-card p-6 space-y-4">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <Settings className="w-4 h-4 text-primary" /> AI yordamchi sozlamalari
              </h3>
              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-muted-foreground mb-1">Gemini modeli</label>
                  <input
                    type="text"
                    value={aiForm.modelName}
                    onChange={(e) => setAiForm({ ...aiForm, modelName: e.target.value })}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-foreground"
                  />
                </div>
                <div>
                  <label className="block text-muted-foreground mb-1">Pedagogik uslub (System tone)</label>
                  <input
                    type="text"
                    value={aiForm.pedagogicalTone}
                    onChange={(e) => setAiForm({ ...aiForm, pedagogicalTone: e.target.value })}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-foreground"
                  />
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={aiForm.strictGrounding}
                    onChange={(e) => setAiForm({ ...aiForm, strictGrounding: e.target.checked })}
                  />
                  <span>Faqat rasmiy darslik va qonun moddalariga tayanish</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={aiForm.enabled}
                    onChange={(e) => setAiForm({ ...aiForm, enabled: e.target.checked })}
                  />
                  <span>AI yordamchi faol</span>
                </label>
              </div>
              <Button type="submit" size="sm">AI sozlamalarini saqlash</Button>
            </form>
          </div>

          {/* Lessons Verification & CRUD */}
          <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
            <h3 className="text-base font-bold text-foreground">Darslik mavzulari nazorati (Verified / Draft)</h3>
            <div className="max-h-96 overflow-y-auto space-y-2 pr-1">
              {lessons.map((l) => (
                <div key={l.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-background/60 p-3 text-xs">
                  <div>
                    <span className="font-bold text-primary mr-2">{l.gradeNumber}-sinf</span>
                    <span className="font-semibold text-foreground">{l.lessonNumberLabel}. {l.title}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="secondary" onClick={() => toggleLessonStatus(l)} className="text-[11px]">
                      {l.status === "verified" ? "Tasdiqlangan" : "Qoralama"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => deleteLesson(l.id)} className="text-red-400">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
