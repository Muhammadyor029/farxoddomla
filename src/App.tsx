import { useEffect, useState } from "react";
import type { GameDefinition, GradeInfo } from "../shared/types";
import { apiRequest } from "./lib/api";
import { ThemeProvider, useTheme } from "./contexts/ThemeContext";
import { AuthProvider } from "./contexts/AuthContext";
import { GlobalSplineBackdrop } from "./components/GlobalSplineBackdrop";
import { Navbar, type RouteKey } from "./components/Navbar";
import { AuthModal } from "./components/AuthModal";
import { LegalAIAssistant } from "./components/ai/LegalAIAssistant";
import { HomePage } from "./pages/HomePage";
import { AllTopicsPage, GradesPage, LessonWorkspacePage } from "./pages/GradesAndTopicsPages";
import {
  GamesPage,
  InteractiveLessonsPage,
  PresentationsLibraryPage,
  TestCenterPage,
} from "./pages/LearningToolsPages";
import { GlossaryPage, LegislationPage, ScenariosPage } from "./pages/ReferencePages";
import { AdminPanelPage, StudentCabinetPage, TeacherCabinetPage } from "./pages/CabinetsPages";

function HuquqOlamiShell() {
  const { theme, reducedMotion, background3d } = useTheme();
  const [route, setRoute] = useState<RouteKey>("home");
  const [selectedGrade, setSelectedGrade] = useState<number>(8);
  const [selectedLessonId, setSelectedLessonId] = useState<number>(8001);
  const [authOpen, setAuthOpen] = useState(false);

  const [grades, setGrades] = useState<GradeInfo[]>([]);
  const [games, setGames] = useState<GameDefinition[]>([]);
  const [totalLessons, setTotalLessons] = useState<number>(114);

  useEffect(() => {
    apiRequest<{ grades?: GradeInfo[] }>("/api/grades")
      .then((res) => {
        const list = Array.isArray(res?.grades) ? res.grades : [];
        setGrades(list);
        const sum = list.reduce((acc, g) => acc + g.lessonsCount, 0);
        if (sum > 0) setTotalLessons(sum);
      })
      .catch(() => {});
    apiRequest<{ games?: GameDefinition[] }>("/api/games")
      .then((res) => {
        const list = Array.isArray(res?.games) ? res.games : [];
        setGames(list);
      })
      .catch(() => {});
  }, []);

  const handleNavigate = (nextRoute: RouteKey, param?: number) => {
    if (nextRoute === "grades" && param) {
      setSelectedGrade(param);
    }
    if (nextRoute === "lesson" && param) {
      setSelectedLessonId(param);
    }
    setRoute(nextRoute);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSelectLesson = (lessonId: number) => {
    setSelectedLessonId(lessonId);
    setRoute("lesson");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="relative min-h-screen text-foreground flex flex-col">
      {/* Global interactive 3D background across all routes */}
      <GlobalSplineBackdrop
        theme={theme}
        dimmed={route !== "home"}
        reducedMotion={reducedMotion}
        background3d={background3d}
      />

      <Navbar activeRoute={route} onNavigate={handleNavigate} onOpenAuth={() => setAuthOpen(true)} />

      <main className={`relative z-10 flex-1 ${route === "home" ? "pointer-events-none" : ""}`}>
        {route === "home" && (
          <HomePage
            grades={grades}
            totalLessons={totalLessons}
            onNavigate={handleNavigate}
            onOpenAuth={() => setAuthOpen(true)}
          />
        )}
        {route === "grades" && (
          <GradesPage
            grades={grades}
            initialGrade={selectedGrade}
            onSelectLesson={handleSelectLesson}
            onOpenAuth={() => setAuthOpen(true)}
          />
        )}
        {route === "topics" && (
          <AllTopicsPage onSelectLesson={handleSelectLesson} onOpenAuth={() => setAuthOpen(true)} />
        )}
        {route === "lesson" && (
          <LessonWorkspacePage
            lessonId={selectedLessonId}
            games={games}
            onNavigate={handleNavigate}
            onOpenAuth={() => setAuthOpen(true)}
          />
        )}
        {route === "presentations" && <PresentationsLibraryPage onOpenAuth={() => setAuthOpen(true)} />}
        {route === "interactive" && <InteractiveLessonsPage onSelectLesson={handleSelectLesson} />}
        {route === "games" && <GamesPage games={games} />}
        {route === "tests" && <TestCenterPage />}
        {route === "scenarios" && <ScenariosPage onOpenAuth={() => setAuthOpen(true)} />}
        {route === "glossary" && <GlossaryPage onOpenAuth={() => setAuthOpen(true)} />}
        {route === "legislation" && <LegislationPage onOpenAuth={() => setAuthOpen(true)} />}
        {route === "student" && (
          <StudentCabinetPage onOpenAuth={() => setAuthOpen(true)} onSelectLesson={handleSelectLesson} />
        )}
        {route === "teacher" && <TeacherCabinetPage onOpenAuth={() => setAuthOpen(true)} />}
        {route === "admin" && <AdminPanelPage onOpenAuth={() => setAuthOpen(true)} />}
      </main>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
      {route !== "lesson" && <LegalAIAssistant />}

      <div
        className="no-print fixed bottom-1.5 left-3 z-10 pointer-events-none select-none text-[10px] tracking-wide text-foreground/20"
        aria-hidden="true"
      >
        Rakhmanaliyev tomonidan yaratilgan
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <HuquqOlamiShell />
      </AuthProvider>
    </ThemeProvider>
  );
}
