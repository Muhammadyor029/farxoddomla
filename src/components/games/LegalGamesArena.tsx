import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Gamepad2,
  Play,
  RotateCcw,
  Trophy,
  CheckCircle2,
  XCircle,
  Scale,
  Timer,
  AlertCircle,
  Flame,
  Lightbulb,
  ArrowRight,
  Link2,
  Compass,
  FileSearch,
  Layers,
  Volume2,
  VolumeX,
  Search,
  ShieldCheck,
  ShieldAlert,
  Grid3X3,
  Boxes,
  Eraser,
  Eye,
  Gavel,
  BookmarkCheck,
} from "lucide-react";
import type { GameDefinition, GameType } from "../../../shared/types";
import { apiRequest } from "../../lib/api";
import { playGameSfx } from "../../lib/gameAudio";
import { Button } from "../ui/button";
import {
  buildCrosswordLetterTiles,
  getGradeGamesBank,
  normalizeGradeLevel,
  normalizeUzbekAnswer,
  shuffleArray,
  shuffleCaseAnalyzerScenario,
  shuffleChoiceRound,
  shuffleLabyrinthScenario,
  type CrosswordTile,
} from "../../data/gamesBank";
import type {
  CaseAnalyzerScenario,
  ChoiceRoundItem,
  CrosswordItem,
  DominoChainItem,
  GradeLevel,
  LabyrinthScenario,
  MatchPairItem,
} from "../../data/gamesTypes";

interface LegalGamesArenaProps {
  games: GameDefinition[];
  initialSlug?: GameType;
  gradeNumber?: number;
  onGradeChange?: (grade: GradeLevel) => void;
  lessonId?: number;
  onScoreSaved?: () => void;
}

interface SessionData {
  seed: number;
  choiceRounds: ChoiceRoundItem[];
  dominoQueue: DominoChainItem[];
  dominoTray: DominoChainItem[];
  matchingLeft: MatchPairItem[];
  matchingRight: MatchPairItem[];
  crosswordItems: CrosswordItem[];
  crosswordTilesByWord: Record<string, CrosswordTile[]>;
  labyrinth: LabyrinthScenario;
  caseScenario: CaseAnalyzerScenario;
}

const GRADES: GradeLevel[] = [8, 9, 10, 11];
const CHOICE_PTS = 40;
const DOMINO_FULL_PTS = 30;
const DOMINO_RETRY_PTS = 15;
const MATCH_FULL_PTS = 30;
const MATCH_RETRY_PTS = 15;
const CROSSWORD_PTS = 35;
const LABYRINTH_PTS = 45;
const CASE_PTS = 50;
const SPEED_SECONDS = 15;

const PAIR_ACCENTS = [
  "border-primary bg-primary/15 text-primary",
  "border-emerald-400 bg-emerald-400/15 text-emerald-300",
  "border-sky-400 bg-sky-400/15 text-sky-300",
  "border-amber-400 bg-amber-400/15 text-amber-300",
  "border-violet-400 bg-violet-400/15 text-violet-300",
];

function getGameVisualIcon(slug: GameType) {
  switch (slug) {
    case "huquqiy_detektiv":
      return Search;
    case "sud_zali":
      return Scale;
    case "huquqiy_domino":
      return Boxes;
    case "mosini_top":
      return Link2;
    case "qonuniy_yoki_noqonuniy":
      return ShieldCheck;
    case "huquqiy_krossvord":
      return Grid3X3;
    case "tezkor_qaror":
      return Timer;
    case "huquqiy_labirint":
      return Compass;
    case "xatoni_top":
      return FileSearch;
    case "voqeani_tahlil_qil":
      return Layers;
    default:
      return Gamepad2;
  }
}

function buildSessionData(
  slug: GameType,
  grade: GradeLevel,
  seed: number,
  prevLabyrinthId?: string,
  prevCaseId?: string
): SessionData {
  const bank = getGradeGamesBank(grade);

  let rawChoiceSource: ChoiceRoundItem[] = bank.huquqiy_detektiv;
  let drawCount = 5;
  let keepBinary = false;

  if (slug === "sud_zali") {
    rawChoiceSource = bank.sud_zali;
    drawCount = 5;
  } else if (slug === "qonuniy_yoki_noqonuniy") {
    rawChoiceSource = bank.qonuniy_yoki_noqonuniy;
    drawCount = 6;
    keepBinary = true;
  } else if (slug === "tezkor_qaror") {
    rawChoiceSource = bank.tezkor_qaror;
    drawCount = 5;
  } else if (slug === "xatoni_top") {
    rawChoiceSource = bank.xatoni_top;
    drawCount = 5;
  }

  const choiceRounds = shuffleArray(rawChoiceSource)
    .slice(0, Math.min(drawCount, rawChoiceSource.length))
    .map((round) => shuffleChoiceRound(round, keepBinary));

  const dominoQueue = shuffleArray(bank.huquqiy_domino).slice(0, 5);
  const dominoTray = shuffleArray(dominoQueue);

  const chosenMatches = shuffleArray(bank.mosini_top).slice(0, 5);
  const matchingLeft = shuffleArray(chosenMatches);
  const matchingRight = shuffleArray(chosenMatches);

  const crosswordItems = shuffleArray(bank.huquqiy_krossvord).slice(0, 5);
  const crosswordTilesByWord: Record<string, CrosswordTile[]> = {};
  for (const item of crosswordItems) {
    crosswordTilesByWord[item.id] = buildCrosswordLetterTiles(item.answer, 4);
  }

  const labCandidates =
    bank.huquqiy_labirint.length > 1 && prevLabyrinthId
      ? bank.huquqiy_labirint.filter((item) => item.id !== prevLabyrinthId)
      : bank.huquqiy_labirint;
  const pickedLab = shuffleArray(labCandidates)[0] || bank.huquqiy_labirint[0];
  const labyrinth = shuffleLabyrinthScenario(pickedLab);

  const caseCandidates =
    bank.voqeani_tahlil_qil.length > 1 && prevCaseId
      ? bank.voqeani_tahlil_qil.filter((item) => item.id !== prevCaseId)
      : bank.voqeani_tahlil_qil;
  const pickedCase = shuffleArray(caseCandidates)[0] || bank.voqeani_tahlil_qil[0];
  const caseScenario = shuffleCaseAnalyzerScenario(pickedCase);

  return {
    seed,
    choiceRounds,
    dominoQueue,
    dominoTray,
    matchingLeft,
    matchingRight,
    crosswordItems,
    crosswordTilesByWord,
    labyrinth,
    caseScenario,
  };
}

export function LegalGamesArena({
  games,
  initialSlug,
  gradeNumber = 9,
  onGradeChange,
  lessonId,
  onScoreSaved,
}: LegalGamesArenaProps) {
  const activeGrade = normalizeGradeLevel(gradeNumber);
  const gradeBank = getGradeGamesBank(activeGrade);

  const [activeSlug, setActiveSlug] = useState<GameType>(initialSlug || games[0]?.slug || "huquqiy_detektiv");
  const [seed, setSeed] = useState(1);
  const [session, setSession] = useState<SessionData>(() =>
    buildSessionData(initialSlug || games[0]?.slug || "huquqiy_detektiv", activeGrade, 1)
  );

  const [soundEnabled, setSoundEnabled] = useState(true);
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);
  const [roundIdx, setRoundIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [lastEarnedPop, setLastEarnedPop] = useState<{ key: number; pts: number } | null>(null);
  const [maxPossibleScore, setMaxPossibleScore] = useState(200);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [shakeTrigger, setShakeTrigger] = useState(0);

  // Detective interactive evidence flip state
  const [revealedClues, setRevealedClues] = useState<number[]>([0]);

  // Courtroom interactive scale tilt state ("left" | "right" | "balanced")
  const [courtScaleSide, setCourtScaleSide] = useState<"left" | "right" | "balanced">("balanced");

  // Clickable Letter-Tile Crossword state (ZERO text input)
  const [placedSlots, setPlacedSlots] = useState<Array<CrosswordTile | null>>([]);
  const [lockedHintSlots, setLockedHintSlots] = useState<number[]>([]);
  const [crosswordAttempts, setCrosswordAttempts] = useState(0);
  const [crosswordTryNotice, setCrosswordTryNotice] = useState<string | null>(null);

  // Domino Chain state
  const [dominoStep, setDominoStep] = useState(0);
  const [dominoPlacedIds, setDominoPlacedIds] = useState<string[]>([]);
  const [dominoMistakeOnStep, setDominoMistakeOnStep] = useState(false);
  const [dominoNotice, setDominoNotice] = useState<{ ok: boolean; text: string } | null>(null);

  // Matching Pairs ("mosini_top") state
  const [selectedLeftId, setSelectedLeftId] = useState<string | null>(null);
  const [matchedOrder, setMatchedOrder] = useState<string[]>([]);
  const [matchMistakesById, setMatchMistakesById] = useState<Record<string, number>>({});
  const [matchNotice, setMatchNotice] = useState<{ ok: boolean; text: string } | null>(null);

  // Speed timer state
  const [timeLeft, setTimeLeft] = useState(SPEED_SECONDS);

  // Labyrinth step history
  const [labyrinthHistory, setLabyrinthHistory] = useState<Array<"pending" | "correct" | "wrong">>([
    "pending",
    "pending",
    "pending",
  ]);

  // 3-step Case Blueprint Assembler state
  const [analyzerStep, setAnalyzerStep] = useState(0);
  const [analyzerPickedIdx, setAnalyzerPickedIdx] = useState<number | null>(null);
  const [analyzerFeedback, setAnalyzerFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [assembledModules, setAssembledModules] = useState<Array<{ text: string; ok: boolean } | null>>([
    null,
    null,
    null,
  ]);

  const scoreRef = useRef(0);
  const activeGame = games.find((g) => g.slug === activeSlug) || games[0];

  const currentCrossword = session.crosswordItems[roundIdx];
  const expectedCrosswordClean = currentCrossword ? normalizeUzbekAnswer(currentCrossword.answer) : "";
  const currentCrosswordTiles = currentCrossword ? session.crosswordTilesByWord[currentCrossword.id] || [] : [];

  // Initialize empty slots whenever crossword round changes
  const initSlotsForWord = useCallback((word: string) => {
    const cleanLen = normalizeUzbekAnswer(word).length;
    setPlacedSlots(Array.from({ length: cleanLen }, () => null));
    setLockedHintSlots([]);
    setCrosswordAttempts(0);
    setCrosswordTryNotice(null);
  }, []);

  const resetArenaState = useCallback(
    (targetSlug: GameType, targetGrade: GradeLevel, shouldStart = false) => {
      const nextSeed = Date.now() + Math.floor(Math.random() * 10000);
      const nextSession = buildSessionData(
        targetSlug,
        targetGrade,
        nextSeed,
        session.labyrinth.id,
        session.caseScenario.id
      );
      setSeed(nextSeed);
      setSession(nextSession);
      setActiveSlug(targetSlug);
      setStarted(shouldStart);
      setFinished(false);
      setRoundIdx(0);
      setScore(0);
      scoreRef.current = 0;
      setLastEarnedPop(null);
      setStreak(0);
      setBestStreak(0);
      setSelectedIdx(null);
      setFeedback(null);
      setSavedMsg(null);
      setShakeTrigger(0);
      setRevealedClues([0]);
      setCourtScaleSide("balanced");

      const firstCw = nextSession.crosswordItems[0];
      if (firstCw) {
        setPlacedSlots(Array.from({ length: normalizeUzbekAnswer(firstCw.answer).length }, () => null));
      } else {
        setPlacedSlots([]);
      }
      setLockedHintSlots([]);
      setCrosswordAttempts(0);
      setCrosswordTryNotice(null);

      setDominoStep(0);
      setDominoPlacedIds([]);
      setDominoMistakeOnStep(false);
      setDominoNotice(null);
      setSelectedLeftId(null);
      setMatchedOrder([]);
      setMatchMistakesById({});
      setMatchNotice(null);
      setTimeLeft(SPEED_SECONDS);
      setLabyrinthHistory(["pending", "pending", "pending"]);
      setAnalyzerStep(0);
      setAnalyzerPickedIdx(null);
      setAnalyzerFeedback(null);
      setAssembledModules([null, null, null]);
      if (shouldStart) {
        playGameSfx("click", soundEnabled);
      }
    },
    [session.caseScenario.id, session.labyrinth.id, soundEnabled]
  );

  // Reset cleanly when parent changes gradeNumber
  const prevGradeRef = useRef<GradeLevel>(activeGrade);
  useEffect(() => {
    if (prevGradeRef.current !== activeGrade) {
      prevGradeRef.current = activeGrade;
      resetArenaState(activeSlug, activeGrade, false);
    }
  }, [activeGrade, activeSlug, resetArenaState]);

  const registerScoreHit = useCallback(
    (points: number, isCleanHit: boolean) => {
      const nextScore = scoreRef.current + points;
      scoreRef.current = nextScore;
      setScore(nextScore);
      if (points > 0) {
        setLastEarnedPop({ key: Date.now() + Math.random(), pts: points });
      }
      if (isCleanHit) {
        playGameSfx("correct", soundEnabled);
        setStreak((prev) => {
          const nextStreak = prev + 1;
          setBestStreak((best) => Math.max(best, nextStreak));
          return nextStreak;
        });
      } else {
        playGameSfx("wrong", soundEnabled);
        setStreak(0);
        setShakeTrigger((s) => s + 1);
      }
      return nextScore;
    },
    [soundEnabled]
  );

  const finalizeGame = useCallback(
    async (finalScore: number, maxScore: number) => {
      setMaxPossibleScore(maxScore);
      setFinished(true);
      playGameSfx("victory", soundEnabled);
      if (!activeGame) return;
      try {
        await apiRequest<{ attempt?: { id?: number } }>("/api/game-attempts", {
          method: "POST",
          body: JSON.stringify({
            gameSlug: activeGame.slug,
            gameTitle: `${activeGame.title} (${activeGrade}-sinf)`,
            gradeNumber: activeGrade,
            lessonId,
            score: finalScore,
            maxScore,
          }),
        });
        setSavedMsg("Natija saqlandi!");
        onScoreSaved?.();
      } catch {
        setSavedMsg("O'yin yakunlandi! Tizimga kirsangiz natija saqlanadi.");
      }
    },
    [activeGame, activeGrade, lessonId, onScoreSaved, soundEnabled]
  );

  // Speed Timer for "tezkor_qaror"
  useEffect(() => {
    if (!started || finished || activeSlug !== "tezkor_qaror" || feedback) return;
    if (timeLeft <= 0) {
      const round = session.choiceRounds[roundIdx];
      playGameSfx("wrong", soundEnabled);
      setStreak(0);
      setShakeTrigger((s) => s + 1);
      setFeedback({
        ok: false,
        text: round ? `Vaqt tugadi! ${round.explanation}` : "Vaqt tugadi! Tezkor qaror qilishda diqqatli bo'ling.",
      });
      return;
    }
    const timer = window.setTimeout(() => setTimeLeft((t) => t - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [started, finished, activeSlug, timeLeft, feedback, roundIdx, session.choiceRounds, soundEnabled]);

  // Choice Game Handler
  const currentChoiceRound = session.choiceRounds[roundIdx];

  const handleChoiceAnswer = useCallback(
    (idx: number) => {
      if (feedback || !currentChoiceRound) return;
      setSelectedIdx(idx);
      const ok = idx === currentChoiceRound.correctIndex;
      if (activeSlug === "sud_zali") {
        setCourtScaleSide("balanced");
      }
      registerScoreHit(ok ? CHOICE_PTS : 0, ok);
      const cleanExplanation =
        activeSlug === "xatoni_top"
          ? currentChoiceRound.explanation.replace(/^Xato\s+\d+-bandda:\s*/i, "Huquqiy izoh: ")
          : currentChoiceRound.explanation;
      setFeedback({ ok, text: cleanExplanation });
    },
    [activeSlug, currentChoiceRound, feedback, registerScoreHit]
  );

  // Keyboard shortcuts for fast arcade games ("qonuniy_yoki_noqonuniy" and "tezkor_qaror")
  useEffect(() => {
    if (!started || finished || feedback) return;
    if (activeSlug !== "qonuniy_yoki_noqonuniy" && activeSlug !== "tezkor_qaror") return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (activeSlug === "qonuniy_yoki_noqonuniy") {
        if (e.key === "ArrowLeft" || e.key === "1") handleChoiceAnswer(0);
        if (e.key === "ArrowRight" || e.key === "2") handleChoiceAnswer(1);
      } else if (activeSlug === "tezkor_qaror") {
        const idx = ["1", "2", "3", "4"].indexOf(e.key);
        if (idx !== -1 && currentChoiceRound && idx < currentChoiceRound.options.length) {
          handleChoiceAnswer(idx);
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeSlug, currentChoiceRound, feedback, finished, handleChoiceAnswer, started]);

  function advanceChoiceRound() {
    playGameSfx("click", soundEnabled);
    if (roundIdx + 1 >= session.choiceRounds.length) {
      finalizeGame(scoreRef.current, session.choiceRounds.length * CHOICE_PTS);
    } else {
      setRoundIdx((r) => r + 1);
      setSelectedIdx(null);
      setFeedback(null);
      setTimeLeft(SPEED_SECONDS);
      setRevealedClues([0]);
      setCourtScaleSide("balanced");
    }
  }

  // Clickable Letter-Tile Crossword Logic (ZERO typing!)
  const usedTileIds = useMemo(
    () => new Set(placedSlots.filter((t): t is CrosswordTile => t !== null).map((t) => t.id)),
    [placedSlots]
  );

  function evaluateCrosswordAttempt(nextSlots: Array<CrosswordTile | null>) {
    if (!currentCrossword || nextSlots.some((s) => s === null)) return;
    const built = nextSlots.map((s) => s!.char).join("");
    const ok = built === expectedCrosswordClean;
    if (ok) {
      const hintPenalty = lockedHintSlots.length * 10;
      const retryPenalty = crosswordAttempts > 0 ? 10 : 0;
      const earned = Math.max(15, CROSSWORD_PTS - hintPenalty - retryPenalty);
      registerScoreHit(earned, crosswordAttempts === 0);
      setCrosswordTryNotice(null);
      setFeedback({
        ok: true,
        text: `Barakalla! "${currentCrossword.answer}" atamasi to'g'ri yig'ildi (+${earned} ball).`,
      });
    } else {
      const nextAttempts = crosswordAttempts + 1;
      setCrosswordAttempts(nextAttempts);
      if (nextAttempts < 2) {
        playGameSfx("wrong", soundEnabled);
        setShakeTrigger((s) => s + 1);
        setCrosswordTryNotice(
          "Harflar tartibida xato bor! Noto'g'ri katakni bosib qaytaring va qayta yig'ing (1 ta imkoniyat qoldi)."
        );
      } else {
        registerScoreHit(0, false);
        setCrosswordTryNotice(null);
        setFeedback({
          ok: false,
          text: `To'g'ri atama: ${currentCrossword.answer}`,
        });
      }
    }
  }

  function handleTrayTileClick(tile: CrosswordTile) {
    if (!currentCrossword || feedback || usedTileIds.has(tile.id)) return;
    const firstEmptyIdx = placedSlots.findIndex((s) => s === null);
    if (firstEmptyIdx === -1) return;

    playGameSfx("snap", soundEnabled);
    setCrosswordTryNotice(null);
    const nextSlots = [...placedSlots];
    nextSlots[firstEmptyIdx] = tile;
    setPlacedSlots(nextSlots);

    if (nextSlots.every((s) => s !== null)) {
      window.setTimeout(() => evaluateCrosswordAttempt(nextSlots), 180);
    }
  }

  function handleSlotClick(slotIdx: number) {
    if (feedback || lockedHintSlots.includes(slotIdx) || !placedSlots[slotIdx]) return;
    playGameSfx("click", soundEnabled);
    setCrosswordTryNotice(null);
    const nextSlots = [...placedSlots];
    nextSlots[slotIdx] = null;
    setPlacedSlots(nextSlots);
  }

  function handleClearUnlockedSlots() {
    if (feedback) return;
    playGameSfx("click", soundEnabled);
    setCrosswordTryNotice(null);
    setPlacedSlots((prev) => prev.map((tile, idx) => (lockedHintSlots.includes(idx) ? tile : null)));
  }

  function handleRevealCrosswordHint() {
    if (!currentCrossword || feedback || lockedHintSlots.length >= 2) return;
    const candidateIndices = expectedCrosswordClean
      .split("")
      .map((_, i) => i)
      .filter((i) => !lockedHintSlots.includes(i));
    if (candidateIndices.length === 0) return;

    const targetIdx = candidateIndices[Math.floor(Math.random() * candidateIndices.length)];
    const targetChar = expectedCrosswordClean[targetIdx];

    // Find a matching tile from unused pool first, otherwise steal from wrong unlocked slot
    const unusedMatch = currentCrosswordTiles.find((t) => !usedTileIds.has(t.id) && t.char === targetChar);
    const nextSlots = [...placedSlots];
    let chosenTile = unusedMatch;

    if (!chosenTile) {
      const wrongSlotWithCharIdx = nextSlots.findIndex(
        (t, idx) => t && t.char === targetChar && !lockedHintSlots.includes(idx) && expectedCrosswordClean[idx] !== targetChar
      );
      if (wrongSlotWithCharIdx !== -1 && nextSlots[wrongSlotWithCharIdx]) {
        chosenTile = nextSlots[wrongSlotWithCharIdx]!;
        nextSlots[wrongSlotWithCharIdx] = null;
      } else {
        chosenTile = { id: `hint-${targetIdx}-${targetChar}`, char: targetChar };
      }
    }

    playGameSfx("snap", soundEnabled);
    nextSlots[targetIdx] = chosenTile;
    setPlacedSlots(nextSlots);
    setLockedHintSlots((prev) => [...prev, targetIdx]);
    setCrosswordTryNotice(null);

    if (nextSlots.every((s) => s !== null)) {
      window.setTimeout(() => evaluateCrosswordAttempt(nextSlots), 180);
    }
  }

  function advanceCrossword() {
    playGameSfx("click", soundEnabled);
    setFeedback(null);
    if (roundIdx + 1 >= session.crosswordItems.length) {
      finalizeGame(scoreRef.current, session.crosswordItems.length * CROSSWORD_PTS);
    } else {
      const nextIdx = roundIdx + 1;
      setRoundIdx(nextIdx);
      const nextWord = session.crosswordItems[nextIdx];
      if (nextWord) initSlotsForWord(nextWord.answer);
    }
  }

  // Domino Chain Interactive Logic
  const currentDominoTarget = session.dominoQueue[dominoStep];

  function handleDominoTileClick(tile: DominoChainItem) {
    if (!currentDominoTarget || dominoPlacedIds.includes(tile.id)) return;
    if (tile.id === currentDominoTarget.id) {
      const earned = dominoMistakeOnStep ? DOMINO_RETRY_PTS : DOMINO_FULL_PTS;
      const nextScore = registerScoreHit(earned, !dominoMistakeOnStep);
      const nextPlaced = [...dominoPlacedIds, tile.id];
      setDominoPlacedIds(nextPlaced);
      setDominoMistakeOnStep(false);
      setDominoNotice({
        ok: true,
        text: `To'g'ri bo'g'in ulandi: "${tile.term}" (+${earned} ball)`,
      });

      if (nextPlaced.length >= session.dominoQueue.length) {
        window.setTimeout(() => {
          finalizeGame(nextScore, session.dominoQueue.length * DOMINO_FULL_PTS);
        }, 480);
      } else {
        setDominoStep((s) => s + 1);
      }
    } else {
      playGameSfx("wrong", soundEnabled);
      setDominoMistakeOnStep(true);
      setStreak(0);
      setShakeTrigger((s) => s + 1);
      setDominoNotice({
        ok: false,
        text: `"${tile.term}" bu ta'rifga mos emas. Boshqa domino toshini tanlang.`,
      });
    }
  }

  // Matching Pairs ("mosini_top") Interactive Connector Logic
  function handleMatchingRightClick(rightItem: MatchPairItem) {
    if (!selectedLeftId || matchedOrder.includes(rightItem.id)) return;
    if (selectedLeftId === rightItem.id) {
      const mistakes = matchMistakesById[selectedLeftId] || 0;
      const earned = mistakes === 0 ? MATCH_FULL_PTS : MATCH_RETRY_PTS;
      const nextScore = registerScoreHit(earned, mistakes === 0);
      const nextMatched = [...matchedOrder, rightItem.id];
      setMatchedOrder(nextMatched);
      setSelectedLeftId(null);
      setMatchNotice({
        ok: true,
        text: `Juftlik bog'landi! (+${earned} ball)`,
      });
      if (nextMatched.length >= session.matchingLeft.length) {
        window.setTimeout(() => {
          finalizeGame(nextScore, session.matchingLeft.length * MATCH_FULL_PTS);
        }, 480);
      }
    } else {
      playGameSfx("wrong", soundEnabled);
      setMatchMistakesById((prev) => ({
        ...prev,
        [selectedLeftId]: (prev[selectedLeftId] || 0) + 1,
      }));
      setStreak(0);
      setShakeTrigger((s) => s + 1);
      setMatchNotice({
        ok: false,
        text: "Mos kelmadi! Huquqiy ma'no va modda raqamiga e'tibor bering.",
      });
    }
  }

  // Progress computation across all 10 game types
  const progressInfo = useMemo(() => {
    if (!started) return { current: 0, total: 1, pct: 0 };
    if (finished) return { current: 1, total: 1, pct: 100 };
    if (activeSlug === "huquqiy_domino") {
      const total = session.dominoQueue.length;
      const cur = dominoPlacedIds.length;
      return { current: cur, total, pct: Math.round((cur / total) * 100) };
    }
    if (activeSlug === "mosini_top") {
      const total = session.matchingLeft.length;
      const cur = matchedOrder.length;
      return { current: cur, total, pct: Math.round((cur / total) * 100) };
    }
    if (activeSlug === "huquqiy_krossvord") {
      const total = session.crosswordItems.length;
      const cur = roundIdx + (feedback ? 1 : 0);
      return { current: cur, total, pct: Math.round((cur / total) * 100) };
    }
    if (activeSlug === "huquqiy_labirint") {
      const total = session.labyrinth.steps.length;
      const cur = roundIdx + (feedback ? 1 : 0);
      return { current: cur, total, pct: Math.round((cur / total) * 100) };
    }
    if (activeSlug === "voqeani_tahlil_qil") {
      const total = session.caseScenario.steps.length;
      const cur = analyzerStep + (analyzerFeedback ? 1 : 0);
      return { current: cur, total, pct: Math.round((cur / total) * 100) };
    }
    const total = session.choiceRounds.length;
    const cur = roundIdx + (feedback ? 1 : 0);
    return { current: cur, total, pct: Math.round((cur / Math.max(1, total)) * 100) };
  }, [
    started,
    finished,
    activeSlug,
    session,
    dominoPlacedIds.length,
    matchedOrder.length,
    roundIdx,
    feedback,
    analyzerStep,
    analyzerFeedback,
  ]);

  const accuracyPct = maxPossibleScore > 0 ? Math.min(100, Math.round((score / maxPossibleScore) * 100)) : 0;

  // Radar countdown ring geometry
  const ringRadius = 22;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset = ringCircumference * (1 - timeLeft / SPEED_SECONDS);

  return (
    <div className="space-y-6">
      {/* Grade Filter Bar */}
      {onGradeChange && (
        <div className="rounded-2xl border border-border bg-card/95 p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-0.5">
            <div className="text-xs font-semibold text-primary uppercase tracking-wider">
              {activeGrade}-sinf interaktiv o&apos;yinlar bazasi
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground">{gradeBank.curriculumFocus}</p>
          </div>
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-background/75 border border-border">
            {GRADES.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => {
                  if (g !== activeGrade) {
                    playGameSfx("click", soundEnabled);
                    onGradeChange(g);
                  }
                }}
                className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                  activeGrade === g
                    ? "bg-primary text-primary-foreground shadow-[0_0_16px_rgba(5,234,0,0.28)]"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                }`}
              >
                {g}-sinf
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 10-Game Arcade Card Selector Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {games.map((gm, idx) => {
          const active = gm.slug === activeSlug;
          const IconComp = getGameVisualIcon(gm.slug);
          return (
            <motion.button
              key={gm.slug}
              type="button"
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => {
                playGameSfx("click", soundEnabled);
                resetArenaState(gm.slug, activeGrade, false);
              }}
              className={`group relative overflow-hidden rounded-2xl border p-3.5 text-left transition-all cursor-pointer ${
                active
                  ? "border-primary bg-gradient-to-br from-primary/20 via-card to-card shadow-[0_8px_28px_rgba(5,234,0,0.18)]"
                  : "border-border bg-card/90 hover:border-primary/50 hover:bg-secondary/40"
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-2.5">
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center border transition-colors ${
                    active
                      ? "border-primary/60 bg-primary/20 text-primary"
                      : "border-border bg-background/70 text-muted-foreground group-hover:text-primary"
                  }`}
                >
                  <IconComp className="w-4 h-4" />
                </div>
                <BookmarkCheck className="w-4 h-4 text-emerald" aria-hidden="true" />
              </div>
              <div className="text-xs sm:text-sm font-bold text-foreground line-clamp-1">
                {idx + 1}. {gm.title}
              </div>
              <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1.5">
                <span>{gm.difficulty}</span>
                <span aria-hidden="true">·</span>
                <span>{activeGrade}-sinf</span>
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Active Game Arena */}
      {activeGame && (
        <motion.div
          key={`${activeGame.slug}-${activeGrade}`}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22 }}
          className="rounded-2xl border border-border bg-card/95 p-5 sm:p-8 space-y-5 shadow-[0_14px_45px_rgba(0,0,0,0.35)]"
        >
          {/* Arena Header HUD */}
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-4">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2.5">
                {(() => {
                  const ActiveIcon = getGameVisualIcon(activeGame.slug);
                  return (
                    <div className="w-9 h-9 rounded-xl bg-primary/15 border border-primary/40 flex items-center justify-center">
                      <ActiveIcon className="w-5 h-5 text-primary" />
                    </div>
                  );
                })()}
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg sm:text-xl font-bold text-foreground">{activeGame.title}</h3>
                    <span className="text-xs text-muted-foreground">· {activeGrade}-sinf</span>
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground">{activeGame.subtitle}</p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 text-xs sm:text-sm">
              {started && streak >= 2 && (
                <motion.span
                  key={streak}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="inline-flex items-center gap-1 rounded-lg border border-amber-400/40 bg-amber-400/10 px-2.5 py-1 text-xs font-semibold text-amber-300 tabular-nums"
                >
                  <Flame className="w-3.5 h-3.5" /> {streak}× seriya
                </motion.span>
              )}

              <div className="relative flex items-center gap-1.5 rounded-lg border border-border bg-background/70 px-3 py-1.5">
                <span className="text-muted-foreground text-xs">Ball:</span>
                <motion.strong
                  key={score}
                  initial={{ scale: 1.15 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.2 }}
                  className="text-primary tabular-nums"
                >
                  {score}
                </motion.strong>
                <AnimatePresence>
                  {lastEarnedPop && (
                    <motion.span
                      key={lastEarnedPop.key}
                      initial={{ opacity: 0, y: 6, scale: 0.85 }}
                      animate={{ opacity: 1, y: -18, scale: 1 }}
                      exit={{ opacity: 0, y: -28 }}
                      transition={{ duration: 0.55 }}
                      className="pointer-events-none absolute -top-2 right-1 text-xs font-bold text-primary tabular-nums"
                    >
                      +{lastEarnedPop.pts}
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>

              <button
                type="button"
                onClick={() => setSoundEnabled((v) => !v)}
                aria-label={soundEnabled ? "Ovozni o'chirish" : "Ovozni yoqish"}
                title={soundEnabled ? "Ovoz yoqilgan" : "Ovoz o'chirilgan"}
                className="w-9 h-9 rounded-lg border border-border bg-background/70 hover:border-primary/50 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                {soundEnabled ? <Volume2 className="w-4 h-4 text-primary" /> : <VolumeX className="w-4 h-4" />}
              </button>

              {started && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => resetArenaState(activeSlug, activeGrade, true)}
                  className="gap-1.5 text-xs whitespace-nowrap"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Yangi o&apos;yin
                </Button>
              )}
            </div>
          </div>

          {/* Animated Progress Bar */}
          {started && !finished && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground tabular-nums">
                <span>
                  Bosqich: {progressInfo.current} / {progressInfo.total}
                </span>
                <span>{progressInfo.pct}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-secondary overflow-hidden border border-border/60">
                <motion.div
                  className="h-full bg-gradient-to-r from-emerald to-primary rounded-full"
                  initial={false}
                  animate={{ width: `${progressInfo.pct}%` }}
                  transition={{ duration: 0.28, ease: "easeOut" }}
                />
              </div>
            </div>
          )}

          {activeGame.isSimulation && (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>
                Ta&apos;limiy simulyatsiya: Ushbu &quot;Sud Zali&quot; o&apos;yini faqat o&apos;quv maqsadida yaratilgan bo&apos;lib, rasmiy yuridik maslahat hisoblanmaydi.
              </span>
            </div>
          )}

          {/* ==================== MENU / START SCREEN ==================== */}
          {!started ? (
            <div className="space-y-5 py-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl border border-border bg-background/60 p-4 space-y-1.5">
                  <div className="text-xs font-semibold text-primary uppercase tracking-wider">O&apos;yin mexanikasi</div>
                  <p className="text-sm text-foreground/90 leading-relaxed">{activeGame.rules}</p>
                </div>
                <div className="rounded-xl border border-border bg-background/60 p-4 space-y-1.5">
                  <div className="text-xs font-semibold text-emerald uppercase tracking-wider">Ta&apos;limiy natija</div>
                  <p className="text-sm text-foreground/90 leading-relaxed">{activeGame.educationalGoal}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <Button
                  size="lg"
                  onClick={() => resetArenaState(activeSlug, activeGrade, true)}
                  className="gap-2 whitespace-nowrap shadow-[0_0_24px_rgba(5,234,0,0.28)]"
                >
                  <Play className="w-4 h-4" /> O&apos;yinni boshlash ({activeGrade}-sinf)
                </Button>
                <span className="text-xs text-muted-foreground">
                  Har boshlanganda yangi tasodifiy ssenariylar, kartochkalar va harflar chiqadi.
                </span>
              </div>
            </div>
          ) : finished ? (
            /* ==================== VICTORY / SUMMARY SCREEN ==================== */
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.25 }}
              className="text-center py-8 space-y-4"
            >
              <motion.div
                initial={{ rotate: -10, scale: 0.8 }}
                animate={{ rotate: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 18 }}
                className="w-20 h-20 rounded-2xl bg-primary/15 border border-primary/50 flex items-center justify-center mx-auto shadow-[0_0_32px_rgba(5,234,0,0.22)]"
              >
                <Trophy className="w-9 h-9 text-primary" />
              </motion.div>
              <h4 className="text-2xl font-bold text-foreground">O&apos;yin yakunlandi!</h4>
              <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground tabular-nums">
                <span>
                  Natija: <strong className="text-primary">{score}</strong> / {maxPossibleScore} ball ({accuracyPct}%)
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  Eng yaxshi seriya: <strong className="text-amber-300">{bestStreak}×</strong>
                </span>
              </div>
              {savedMsg && <p className="text-sm text-emerald font-medium">{savedMsg}</p>}
              <div className="flex flex-wrap justify-center gap-3 pt-2">
                <Button onClick={() => resetArenaState(activeSlug, activeGrade, true)} className="gap-2 whitespace-nowrap">
                  <RotateCcw className="w-4 h-4" /> Yana o&apos;ynash (Yangi savollar)
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => resetArenaState(activeSlug, activeGrade, false)}
                  className="whitespace-nowrap"
                >
                  Qoidalarga qaytish
                </Button>
              </div>
            </motion.div>
          ) : activeSlug === "huquqiy_krossvord" ? (
            /* ==================== 6. CLICKABLE LETTER-TILE PUZZLE (NO TYPING!) ==================== */
            <AnimatePresence mode="wait">
              {currentCrossword && (
                <motion.div
                  key={`${seed}-cw-${roundIdx}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.18 }}
                  className="space-y-5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span className="tabular-nums font-medium">
                      Pazl {roundIdx + 1} / {session.crosswordItems.length} · {currentCrossword.category}
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleClearUnlockedSlots}
                        disabled={!!feedback || placedSlots.every((t, i) => !t || lockedHintSlots.includes(i))}
                        className="gap-1.5 text-xs h-8 px-2.5"
                      >
                        <Eraser className="w-3.5 h-3.5" /> Tozalash
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleRevealCrosswordHint}
                        disabled={!!feedback || lockedHintSlots.length >= 2}
                        className="gap-1.5 text-xs h-8 px-2.5"
                      >
                        <Lightbulb className="w-3.5 h-3.5 text-amber-300" /> Harf ochish ({2 - lockedHintSlots.length})
                      </Button>
                    </div>
                  </div>

                  {/* Clue & Target Letter Slots */}
                  <div className="rounded-2xl border border-border bg-background/70 p-5 sm:p-6 space-y-5">
                    <div className="space-y-1">
                      <div className="text-[11px] font-semibold text-primary uppercase tracking-wider">
                        Atamani harflardan yig&apos;ing ({expectedCrosswordClean.length} harf)
                      </div>
                      <p className="text-base sm:text-lg font-semibold text-foreground">{currentCrossword.clue}</p>
                    </div>

                    {/* Interactive Word Slots */}
                    <motion.div
                      key={`cw-slots-${shakeTrigger}`}
                      animate={crosswordTryNotice ? { x: [0, -7, 7, -5, 5, 0] } : {}}
                      transition={{ duration: 0.28 }}
                      className="flex flex-wrap gap-2 justify-center py-2"
                    >
                      {placedSlots.map((tile, slotIdx) => {
                        const isLocked = lockedHintSlots.includes(slotIdx);
                        const expectedChar = expectedCrosswordClean[slotIdx];
                        return (
                          <motion.button
                            key={slotIdx}
                            type="button"
                            disabled={!!feedback || isLocked || !tile}
                            whileTap={!feedback && !isLocked && tile ? { scale: 0.92 } : undefined}
                            onClick={() => handleSlotClick(slotIdx)}
                            title={tile && !isLocked ? "Olib tashlash uchun bosing" : undefined}
                            className={`w-10 h-12 sm:w-11 sm:h-12 rounded-xl border-b-4 border flex items-center justify-center text-base font-extrabold transition-all select-none ${
                              feedback?.ok
                                ? "border-primary bg-primary/20 text-primary shadow-[0_0_14px_rgba(5,234,0,0.25)]"
                                : feedback && !feedback.ok
                                ? "border-red-400/70 bg-red-500/15 text-red-200"
                                : isLocked
                                ? "border-amber-400 bg-amber-400/15 text-amber-300 cursor-default"
                                : tile
                                ? "border-primary bg-secondary text-foreground hover:border-red-400 cursor-pointer shadow-sm"
                                : "border-border border-dashed bg-background/50 text-muted-foreground cursor-default"
                            }`}
                          >
                            {feedback && !feedback.ok ? (
                              <span>{expectedChar}</span>
                            ) : tile ? (
                              <motion.span initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                                {tile.char}
                              </motion.span>
                            ) : (
                              ""
                            )}
                          </motion.button>
                        );
                      })}
                    </motion.div>

                    {crosswordTryNotice && (
                      <div className="text-center text-xs text-amber-300 font-medium">{crosswordTryNotice}</div>
                    )}

                    {/* Clickable Shuffled Letter Tile Keyboard */}
                    {!feedback && (
                      <div className="pt-3 border-t border-border/60 space-y-2.5">
                        <div className="text-[11px] text-center text-muted-foreground">
                          Quyidagi harflarni ketma-ket bosing (o&apos;chirish uchun yuqoridagi katakni bosing):
                        </div>
                        <div className="flex flex-wrap justify-center gap-2">
                          {currentCrosswordTiles.map((tile) => {
                            const isUsed = usedTileIds.has(tile.id);
                            return (
                              <motion.button
                                key={tile.id}
                                type="button"
                                disabled={isUsed}
                                whileHover={isUsed ? undefined : { y: -3, scale: 1.04 }}
                                whileTap={isUsed ? undefined : { scale: 0.92 }}
                                onClick={() => handleTrayTileClick(tile)}
                                className={`w-11 h-12 rounded-xl border border-b-4 text-base font-bold transition-all select-none ${
                                  isUsed
                                    ? "border-border/30 bg-background/20 text-transparent cursor-default scale-90"
                                    : "border-border bg-secondary hover:border-primary hover:bg-primary/15 text-foreground cursor-pointer shadow-md"
                                }`}
                              >
                                {isUsed ? "·" : tile.char}
                              </motion.button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {feedback && (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/10 p-4"
                    >
                      <span className={`text-sm font-medium ${feedback.ok ? "text-primary" : "text-red-300"}`}>
                        {feedback.text}
                      </span>
                      <Button size="sm" onClick={advanceCrossword} className="gap-1.5 whitespace-nowrap">
                        {roundIdx + 1 >= session.crosswordItems.length ? "Natijani ko'rish" : "Keyingi atama"}{" "}
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Button>
                    </motion.div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          ) : activeSlug === "huquqiy_domino" ? (
            /* ==================== 3. VISUAL DOMINO CHAIN BUILDER ==================== */
            <div className="space-y-5">
              {/* Visual Domino Track */}
              <div className="rounded-2xl border border-border bg-background/65 p-4 space-y-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-semibold uppercase tracking-wider">
                    Domino zanjiri ({dominoPlacedIds.length} / {session.dominoQueue.length})
                  </span>
                  <span>Mos toshni bosib zanjirga ulang</span>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  {dominoPlacedIds.map((pid, idx) => {
                    const item = session.dominoQueue.find((d) => d.id === pid);
                    if (!item) return null;
                    return (
                      <motion.div
                        key={pid}
                        initial={{ scale: 0.75, opacity: 0, x: -12 }}
                        animate={{ scale: 1, opacity: 1, x: 0 }}
                        transition={{ type: "spring", stiffness: 320, damping: 20 }}
                        className="flex items-stretch rounded-xl border-2 border-primary/60 bg-secondary overflow-hidden shadow-sm"
                      >
                        <div className="px-2.5 py-2 bg-primary/15 border-r border-primary/30 flex items-center justify-center text-xs font-bold text-primary tabular-nums">
                          #{idx + 1}
                        </div>
                        <div className="px-3 py-2 text-xs font-bold text-foreground flex items-center">
                          {item.term}
                        </div>
                      </motion.div>
                    );
                  })}

                  {currentDominoTarget && (
                    <motion.div
                      animate={{ opacity: [0.65, 1, 0.65] }}
                      transition={{ duration: 1.6, repeat: Infinity }}
                      className="rounded-xl border-2 border-dashed border-primary/70 bg-primary/5 px-3.5 py-2 text-xs font-semibold text-primary"
                    >
                      + Keyingi domino bo&apos;g&apos;ini
                    </motion.div>
                  )}
                </div>
              </div>

              {/* Open Clue Half of Active Domino */}
              {currentDominoTarget && (
                <motion.div
                  key={currentDominoTarget.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl border-2 border-primary/40 bg-gradient-to-r from-primary/10 via-background/90 to-background/90 p-5 space-y-2"
                >
                  <div className="text-xs font-semibold text-emerald uppercase tracking-wider">
                    Navbatdagi huquqiy ta&apos;rif ({currentDominoTarget.articleHint}):
                  </div>
                  <p className="text-base sm:text-lg font-semibold text-foreground">{currentDominoTarget.clue}</p>
                </motion.div>
              )}

              {/* Tactile 2-Part Domino Tiles Hand */}
              <motion.div
                key={`domino-tray-${shakeTrigger}`}
                animate={dominoNotice && !dominoNotice.ok ? { x: [0, -7, 7, -4, 4, 0] } : {}}
                transition={{ duration: 0.28 }}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
              >
                {session.dominoTray.map((tile, tIdx) => {
                  const placed = dominoPlacedIds.includes(tile.id);
                  return (
                    <motion.button
                      key={tile.id}
                      type="button"
                      disabled={placed}
                      whileHover={placed ? undefined : { y: -3 }}
                      whileTap={placed ? undefined : { scale: 0.96 }}
                      onClick={() => handleDominoTileClick(tile)}
                      className={`flex items-stretch rounded-2xl border-2 border-b-4 overflow-hidden text-left transition-all ${
                        placed
                          ? "border-primary/30 bg-primary/5 opacity-45 cursor-default"
                          : "border-border bg-secondary/85 hover:border-primary cursor-pointer shadow-md"
                      }`}
                    >
                      <div className="w-10 bg-background/60 border-r border-border flex flex-col items-center justify-center gap-1 py-3">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary/70" />
                        <span className="text-[10px] font-bold text-muted-foreground tabular-nums">{tIdx + 1}</span>
                        <span className="w-1.5 h-1.5 rounded-full bg-primary/70" />
                      </div>
                      <div className="flex-1 p-3.5 flex items-center justify-between gap-2">
                        <span className="text-sm font-bold text-foreground">{tile.term}</span>
                        {placed ? (
                          <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                        ) : (
                          <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                        )}
                      </div>
                    </motion.button>
                  );
                })}
              </motion.div>

              {dominoNotice && (
                <div
                  className={`rounded-xl border px-4 py-3 text-xs sm:text-sm font-medium ${
                    dominoNotice.ok
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-red-500/40 bg-red-500/10 text-red-200"
                  }`}
                >
                  {dominoNotice.text}
                </div>
              )}
            </div>
          ) : activeSlug === "mosini_top" ? (
            /* ==================== 4. INTERACTIVE PAIR CONNECTOR BOARD ==================== */
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm text-muted-foreground">
                <span>Chap tomondagi tokenni bosing, so&apos;ng o&apos;ngdagi mos ta&apos;rif kartasini ulang:</span>
                <span className="font-semibold text-primary tabular-nums">
                  Ulandi: {matchedOrder.length} / {session.matchingLeft.length}
                </span>
              </div>

              <motion.div
                key={`match-grid-${shakeTrigger}`}
                animate={matchNotice && !matchNotice.ok ? { x: [0, -7, 7, -4, 4, 0] } : {}}
                transition={{ duration: 0.28 }}
                className="grid grid-cols-1 md:grid-cols-2 gap-4"
              >
                {/* Left Column */}
                <div className="space-y-2.5">
                  <div className="text-xs font-semibold text-primary uppercase tracking-wider">1. Tushuncha / Modda</div>
                  {session.matchingLeft.map((item, idx) => {
                    const matchIdx = matchedOrder.indexOf(item.id);
                    const isMatched = matchIdx !== -1;
                    const isSelected = selectedLeftId === item.id;
                    const accentCls = isMatched ? PAIR_ACCENTS[matchIdx % PAIR_ACCENTS.length] : "";
                    return (
                      <motion.button
                        key={item.id}
                        type="button"
                        disabled={isMatched}
                        whileHover={isMatched ? undefined : { x: 3 }}
                        whileTap={isMatched ? undefined : { scale: 0.98 }}
                        onClick={() => {
                          playGameSfx("click", soundEnabled);
                          setSelectedLeftId(item.id);
                          setMatchNotice(null);
                        }}
                        className={`w-full rounded-xl border-2 p-3.5 text-left text-sm font-semibold transition-all flex items-center justify-between gap-3 ${
                          isMatched
                            ? `${accentCls} cursor-default`
                            : isSelected
                            ? "border-primary bg-primary/20 text-foreground shadow-[0_0_20px_rgba(5,234,0,0.22)] cursor-pointer"
                            : "border-border bg-secondary/75 hover:border-primary/60 text-foreground cursor-pointer"
                        }`}
                      >
                        <span className="flex items-center gap-2.5">
                          <span className="w-6 h-6 rounded-lg bg-background/70 border border-border flex items-center justify-center text-xs tabular-nums">
                            {idx + 1}
                          </span>
                          <span>{item.left}</span>
                        </span>
                        {isMatched ? (
                          <span className="text-xs font-bold tabular-nums">#{matchIdx + 1}</span>
                        ) : (
                          <Link2 className={`w-4 h-4 shrink-0 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                        )}
                      </motion.button>
                    );
                  })}
                </div>

                {/* Right Column */}
                <div className="space-y-2.5">
                  <div className="text-xs font-semibold text-emerald uppercase tracking-wider">2. Huquqiy ma&apos;nosi</div>
                  {session.matchingRight.map((item) => {
                    const matchIdx = matchedOrder.indexOf(item.id);
                    const isMatched = matchIdx !== -1;
                    const accentCls = isMatched ? PAIR_ACCENTS[matchIdx % PAIR_ACCENTS.length] : "";
                    return (
                      <motion.button
                        key={item.id}
                        type="button"
                        disabled={isMatched || !selectedLeftId}
                        whileHover={!isMatched && selectedLeftId ? { x: -3 } : undefined}
                        whileTap={!isMatched && selectedLeftId ? { scale: 0.98 } : undefined}
                        onClick={() => handleMatchingRightClick(item)}
                        className={`w-full rounded-xl border-2 p-3.5 text-left text-xs sm:text-sm transition-all flex items-center justify-between gap-3 ${
                          isMatched
                            ? `${accentCls} cursor-default`
                            : selectedLeftId
                            ? "border-border bg-background/85 hover:border-primary text-foreground cursor-pointer"
                            : "border-border/60 bg-background/40 text-muted-foreground cursor-not-allowed"
                        }`}
                      >
                        <span>{item.right}</span>
                        {isMatched && <span className="text-xs font-bold tabular-nums shrink-0">#{matchIdx + 1}</span>}
                      </motion.button>
                    );
                  })}
                </div>
              </motion.div>

              {matchNotice && (
                <div
                  className={`rounded-xl border px-4 py-3 text-xs sm:text-sm font-medium ${
                    matchNotice.ok
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-red-500/40 bg-red-500/10 text-red-200"
                  }`}
                >
                  {matchNotice.text}
                </div>
              )}
            </div>
          ) : activeSlug === "huquqiy_labirint" ? (
            /* ==================== 8. INTERACTIVE SVG LABYRINTH NODE MAP ==================== */
            <div className="space-y-5">
              {/* Visual SVG Route Map */}
              <div className="rounded-2xl border border-border bg-background/70 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-primary uppercase tracking-wider">
                    Xarita: {session.labyrinth.title}
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    Bekat {roundIdx + 1} / {session.labyrinth.steps.length}
                  </span>
                </div>

                {/* SVG Animated Maze Route */}
                <div className="w-full overflow-x-auto">
                  <svg viewBox="0 0 600 92" className="w-full min-w-[380px] h-20">
                    <path
                      d="M 60 46 Q 150 18, 230 46 T 400 46 T 540 46"
                      fill="none"
                      stroke="rgba(255,255,255,0.14)"
                      strokeWidth="4"
                      strokeDasharray="6 6"
                    />
                    <motion.path
                      d="M 60 46 Q 150 18, 230 46 T 400 46 T 540 46"
                      fill="none"
                      stroke="#05EA00"
                      strokeWidth="4"
                      strokeLinecap="round"
                      initial={{ pathLength: 0.1 }}
                      animate={{ pathLength: (roundIdx + (feedback ? 1 : 0.25)) / 3 }}
                      transition={{ duration: 0.45, ease: "easeOut" }}
                    />
                    {[
                      { x: 60, label: "1-bekat" },
                      { x: 230, label: "2-bekat" },
                      { x: 400, label: "3-bekat" },
                      { x: 540, label: "Finish" },
                    ].map((node, nIdx) => {
                      const st = nIdx < 3 ? labyrinthHistory[nIdx] : feedback && roundIdx === 2 ? "correct" : "pending";
                      const isActive = nIdx === roundIdx;
                      const fillColor =
                        st === "correct" ? "#05EA00" : st === "wrong" ? "#EF4444" : isActive ? "#FACC15" : "#27272A";
                      return (
                        <g key={node.label}>
                          <circle cx={node.x} cy={46} r={isActive ? 14 : 11} fill="#111713" stroke={fillColor} strokeWidth="3" />
                          {isActive && (
                            <motion.circle
                              cx={node.x}
                              cy={46}
                              r={6}
                              fill="#05EA00"
                              animate={{ scale: [1, 1.35, 1] }}
                              transition={{ duration: 1.2, repeat: Infinity }}
                            />
                          )}
                          <text x={node.x} y={80} textAnchor="middle" fill="#A1A1AA" fontSize="11" fontWeight="600">
                            {node.label}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
              </div>

              <AnimatePresence mode="wait">
                {session.labyrinth.steps[roundIdx] && (
                  <motion.div
                    key={`${session.labyrinth.id}-step-${roundIdx}`}
                    initial={{ opacity: 0, x: 14 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -14 }}
                    transition={{ duration: 0.18 }}
                    className="space-y-4"
                  >
                    <div className="rounded-xl border border-border bg-background/70 p-4">
                      <div className="text-xs font-semibold text-emerald mb-1">
                        {session.labyrinth.steps[roundIdx].stage}
                      </div>
                      <h4 className="text-base sm:text-lg font-semibold text-foreground">
                        {session.labyrinth.steps[roundIdx].question}
                      </h4>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {session.labyrinth.steps[roundIdx].options.map((opt, idx) => {
                        const isPicked = selectedIdx === idx;
                        let cls = "border-border bg-secondary/75 hover:border-primary text-foreground";
                        if (feedback) {
                          if (opt.isCorrect) cls = "border-primary bg-primary/15 text-foreground";
                          else if (isPicked) cls = "border-red-500/60 bg-red-500/10 text-red-200";
                        }
                        return (
                          <motion.button
                            key={idx}
                            type="button"
                            disabled={!!feedback}
                            whileHover={feedback ? undefined : { y: -3 }}
                            whileTap={feedback ? undefined : { scale: 0.97 }}
                            onClick={() => {
                              setSelectedIdx(idx);
                              registerScoreHit(opt.isCorrect ? LABYRINTH_PTS : 0, opt.isCorrect);
                              setLabyrinthHistory((prev) =>
                                prev.map((st, i) => (i === roundIdx ? (opt.isCorrect ? "correct" : "wrong") : st))
                              );
                              setFeedback({ ok: opt.isCorrect, text: opt.feedback });
                            }}
                            className={`rounded-2xl border-2 border-b-4 p-4 text-left text-xs sm:text-sm transition-all flex flex-col justify-between gap-3 cursor-pointer ${cls}`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-bold uppercase tracking-wider text-primary">
                                Yo&apos;lak #{idx + 1}
                              </span>
                              {feedback && opt.isCorrect && <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />}
                              {feedback && isPicked && !opt.isCorrect && <XCircle className="w-4 h-4 text-red-400 shrink-0" />}
                            </div>
                            <span className="leading-relaxed">{opt.label}</span>
                          </motion.button>
                        );
                      })}
                    </div>

                    {feedback && (
                      <motion.div
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/10 p-4"
                      >
                        <span className={`text-sm ${feedback.ok ? "text-primary" : "text-red-200"}`}>{feedback.text}</span>
                        <Button
                          size="sm"
                          onClick={() => {
                            playGameSfx("click", soundEnabled);
                            setFeedback(null);
                            setSelectedIdx(null);
                            if (roundIdx + 1 >= session.labyrinth.steps.length) {
                              finalizeGame(scoreRef.current, session.labyrinth.steps.length * LABYRINTH_PTS);
                            } else {
                              setRoundIdx((r) => r + 1);
                            }
                          }}
                          className="gap-1.5 whitespace-nowrap"
                        >
                          {roundIdx + 1 >= session.labyrinth.steps.length ? "Natijani ko'rish" : "Keyingi bekat"}{" "}
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Button>
                      </motion.div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : activeSlug === "voqeani_tahlil_qil" ? (
            /* ==================== 10. 3-STAGE BLUEPRINT CASE ASSEMBLER ==================== */
            <div className="space-y-5">
              <div className="rounded-xl border border-primary/30 bg-primary/10 p-4 space-y-1.5">
                <div className="text-xs font-semibold text-primary uppercase tracking-wider">
                  Tergov fayli · {session.caseScenario.title}
                </div>
                <p className="text-sm text-foreground leading-relaxed">{session.caseScenario.story}</p>
              </div>

              {/* 3 Interlocking Blueprint Slots */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {["1. Huquq sohasi", "2. Huquqiy asos", "3. Qonuniy chora"].map((label, sIdx) => {
                  const placed = assembledModules[sIdx];
                  const isCurrent = sIdx === analyzerStep;
                  return (
                    <motion.div
                      key={label}
                      animate={placed ? { scale: [0.96, 1] } : {}}
                      className={`rounded-xl border-2 p-3.5 space-y-1.5 transition-colors ${
                        placed
                          ? placed.ok
                            ? "border-primary/60 bg-primary/15"
                            : "border-red-500/50 bg-red-500/10"
                          : isCurrent
                          ? "border-primary border-dashed bg-secondary/70"
                          : "border-border bg-background/40"
                      }`}
                    >
                      <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider">
                        <span className={placed ? "text-foreground" : isCurrent ? "text-primary" : "text-muted-foreground"}>
                          {label}
                        </span>
                        {placed &&
                          (placed.ok ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5 text-red-400" />
                          ))}
                      </div>
                      <div className="text-xs text-foreground/90 min-h-[2.2rem] flex items-center">
                        {placed ? placed.text : isCurrent ? "Quyidan mos modulni tanlang..." : "Kutilmoqda..."}
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              <AnimatePresence mode="wait">
                {session.caseScenario.steps[analyzerStep] && (
                  <motion.div
                    key={`${session.caseScenario.id}-case-${analyzerStep}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.18 }}
                    className="space-y-3"
                  >
                    <h4 className="text-base font-semibold text-foreground">
                      {session.caseScenario.steps[analyzerStep].prompt}
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {session.caseScenario.steps[analyzerStep].options.map((opt, idx) => {
                        const stepObj = session.caseScenario.steps[analyzerStep];
                        const isPicked = analyzerPickedIdx === idx;
                        const isCorrect = idx === stepObj.correctIndex;
                        let cls = "border-border bg-secondary/75 hover:border-primary text-foreground";
                        if (analyzerFeedback) {
                          if (isCorrect) cls = "border-primary bg-primary/15 text-foreground";
                          else if (isPicked) cls = "border-red-500/60 bg-red-500/10 text-red-200";
                        }
                        return (
                          <motion.button
                            key={idx}
                            type="button"
                            disabled={!!analyzerFeedback}
                            whileHover={analyzerFeedback ? undefined : { y: -2 }}
                            whileTap={analyzerFeedback ? undefined : { scale: 0.97 }}
                            onClick={() => {
                              setAnalyzerPickedIdx(idx);
                              const ok = idx === stepObj.correctIndex;
                              registerScoreHit(ok ? CASE_PTS : 0, ok);
                              setAssembledModules((prev) =>
                                prev.map((m, i) => (i === analyzerStep ? { text: stepObj.options[stepObj.correctIndex], ok } : m))
                              );
                              setAnalyzerFeedback({ ok, text: stepObj.explanation });
                            }}
                            className={`rounded-2xl border-2 border-b-4 p-4 text-left text-xs sm:text-sm transition-all flex items-start justify-between gap-2 cursor-pointer ${cls}`}
                          >
                            <span>{opt}</span>
                            {analyzerFeedback && isCorrect && <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />}
                            {analyzerFeedback && isPicked && !isCorrect && <XCircle className="w-4 h-4 text-red-400 shrink-0" />}
                          </motion.button>
                        );
                      })}
                    </div>

                    {analyzerFeedback && (
                      <motion.div
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/10 p-4"
                      >
                        <div className="text-sm text-foreground flex-1 min-w-[200px]">
                          <strong className={analyzerFeedback.ok ? "text-primary" : "text-red-300"}>
                            {analyzerFeedback.ok ? `Modul ulandi! +${CASE_PTS} ball: ` : "Huquqiy izoh: "}
                          </strong>
                          {analyzerFeedback.text}
                        </div>
                        <Button
                          size="sm"
                          onClick={() => {
                            playGameSfx("click", soundEnabled);
                            setAnalyzerFeedback(null);
                            setAnalyzerPickedIdx(null);
                            if (analyzerStep + 1 < session.caseScenario.steps.length) {
                              setAnalyzerStep((s) => s + 1);
                            } else {
                              finalizeGame(scoreRef.current, session.caseScenario.steps.length * CASE_PTS);
                            }
                          }}
                          className="gap-1.5 whitespace-nowrap"
                        >
                          {analyzerStep + 1 >= session.caseScenario.steps.length ? "Natijani ko'rish" : "Keyingi modul"}{" "}
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Button>
                      </motion.div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            /* ==================== 1, 2, 5, 7, 9: INTERACTIVE VISUAL BOARD GAMES ==================== */
            <AnimatePresence mode="wait">
              {currentChoiceRound && (
                <motion.div
                  key={`${seed}-${activeSlug}-${roundIdx}`}
                  initial={{ opacity: 0, x: 14 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -14 }}
                  transition={{ duration: 0.18 }}
                  className="space-y-5"
                >
                  {/* Top Info Row + SVG Radar Timer for Tezkor Qaror */}
                  <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
                    <span className="tabular-nums font-medium">
                      Bosqich {roundIdx + 1} / {session.choiceRounds.length}
                    </span>

                    {activeSlug === "tezkor_qaror" && (
                      <div className="flex items-center gap-2.5">
                        <span className="text-[11px] text-muted-foreground hidden sm:inline">Tezkor tugmalar: 1–4</span>
                        <div className="relative w-12 h-12 flex items-center justify-center">
                          <svg className="w-12 h-12 -rotate-90" viewBox="0 0 54 54">
                            <circle cx="27" cy="27" r={ringRadius} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="4" />
                            <circle
                              cx="27"
                              cy="27"
                              r={ringRadius}
                              fill="none"
                              stroke={timeLeft <= 4 ? "#EF4444" : timeLeft <= 8 ? "#F59E0B" : "#05EA00"}
                              strokeWidth="4"
                              strokeDasharray={ringCircumference}
                              strokeDashoffset={ringOffset}
                              strokeLinecap="round"
                              className="transition-all duration-300"
                            />
                          </svg>
                          <span
                            className={`absolute text-xs font-bold tabular-nums ${
                              timeLeft <= 4 ? "text-red-400" : timeLeft <= 8 ? "text-amber-300" : "text-primary"
                            }`}
                          >
                            {timeLeft}s
                          </span>
                        </div>
                      </div>
                    )}

                    {activeSlug === "qonuniy_yoki_noqonuniy" && (
                      <span className="text-[11px] text-muted-foreground hidden sm:inline">
                        Klaviatura: ← Qonuniy · → Noqonuniy
                      </span>
                    )}
                  </div>

                  {/* SPECIAL VISUAL STAGE PER GAME TYPE */}
                  {activeSlug === "sud_zali" ? (
                    /* Animated SVG Scales of Justice Courtroom */
                    <div className="rounded-2xl border border-border bg-background/75 p-5 space-y-4">
                      <div className="flex flex-col sm:flex-row items-center gap-5">
                        <div className="shrink-0 flex flex-col items-center">
                          <svg viewBox="0 0 140 96" className="w-36 h-24">
                            {/* Stand */}
                            <line x1="70" y1="14" x2="70" y2="84" stroke="#9BA69D" strokeWidth="3.5" strokeLinecap="round" />
                            <rect x="44" y="84" width="52" height="6" rx="3" fill="#39FF55" fillOpacity="0.4" />
                            {/* Dynamic Tilting Beam */}
                            <motion.g
                              animate={{
                                rotate: courtScaleSide === "left" ? -10 : courtScaleSide === "right" ? 10 : 0,
                              }}
                              transition={{ type: "spring", stiffness: 180, damping: 14 }}
                              style={{ originX: "70px", originY: "24px" }}
                            >
                              <line x1="22" y1="24" x2="118" y2="24" stroke="#05EA00" strokeWidth="3" strokeLinecap="round" />
                              {/* Left pan */}
                              <line x1="26" y1="24" x2="16" y2="52" stroke="#9BA69D" strokeWidth="1.5" />
                              <line x1="26" y1="24" x2="36" y2="52" stroke="#9BA69D" strokeWidth="1.5" />
                              <path d="M 12 52 Q 26 62, 40 52 Z" fill={courtScaleSide === "left" ? "#05EA00" : "#52525B"} />
                              {/* Right pan */}
                              <line x1="114" y1="24" x2="104" y2="52" stroke="#9BA69D" strokeWidth="1.5" />
                              <line x1="114" y1="24" x2="124" y2="52" stroke="#9BA69D" strokeWidth="1.5" />
                              <path d="M 100 52 Q 114 62, 128 52 Z" fill={courtScaleSide === "right" ? "#F59E0B" : "#52525B"} />
                            </motion.g>
                            <circle cx="70" cy="24" r="4.5" fill="#05EA00" />
                          </svg>
                          <div className="flex gap-1.5 mt-1">
                            <button
                              type="button"
                              onClick={() => {
                                playGameSfx("click", soundEnabled);
                                setCourtScaleSide("left");
                              }}
                              className={`px-2 py-1 rounded text-[10px] font-semibold border cursor-pointer transition-colors ${
                                courtScaleSide === "left"
                                  ? "border-primary bg-primary/15 text-primary"
                                  : "border-border text-muted-foreground hover:text-foreground"
                              }`}
                            >
                              Da&apos;vogar
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                playGameSfx("click", soundEnabled);
                                setCourtScaleSide("right");
                              }}
                              className={`px-2 py-1 rounded text-[10px] font-semibold border cursor-pointer transition-colors ${
                                courtScaleSide === "right"
                                  ? "border-amber-400 bg-amber-400/15 text-amber-300"
                                  : "border-border text-muted-foreground hover:text-foreground"
                              }`}
                            >
                              Javobgar
                            </button>
                          </div>
                        </div>

                        <div className="flex-1 space-y-2.5">
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-primary uppercase tracking-wider">
                            <Gavel className="w-3.5 h-3.5" /> Sud majlisi materiallari
                          </div>
                          <p className="text-sm sm:text-base font-semibold text-foreground leading-relaxed">
                            {currentChoiceRound.prompt}
                          </p>
                          {currentChoiceRound.clues && (
                            <div className="flex flex-wrap gap-2 pt-1">
                              {currentChoiceRound.clues.map((clue, cIdx) => (
                                <span
                                  key={cIdx}
                                  className="text-xs text-emerald bg-emerald/10 border border-emerald/30 rounded-lg px-2.5 py-1"
                                >
                                  {clue}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : activeSlug === "huquqiy_detektiv" ? (
                    /* Interactive Detective Evidence Board (Flippable Clues) */
                    <div className="rounded-2xl border border-border bg-background/75 p-5 space-y-4">
                      <div className="space-y-1">
                        <div className="text-xs font-semibold text-primary uppercase tracking-wider">
                          Tergov ishi materiallari
                        </div>
                        <p className="text-base sm:text-lg font-semibold text-foreground">{currentChoiceRound.prompt}</p>
                      </div>

                      {currentChoiceRound.clues && (
                        <div className="space-y-2 pt-2 border-t border-border/60">
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>Dalil kartochkalarini bosib oching:</span>
                            {revealedClues.length < currentChoiceRound.clues.length && (
                              <button
                                type="button"
                                onClick={() => {
                                  playGameSfx("snap", soundEnabled);
                                  setRevealedClues(currentChoiceRound.clues!.map((_, i) => i));
                                }}
                                className="text-primary hover:underline cursor-pointer text-xs font-semibold"
                              >
                                Barchasini ochish
                              </button>
                            )}
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                            {currentChoiceRound.clues.map((clue, cIdx) => {
                              const isOpen = revealedClues.includes(cIdx);
                              return (
                                <motion.button
                                  key={cIdx}
                                  type="button"
                                  whileTap={{ scale: 0.97 }}
                                  onClick={() => {
                                    if (!isOpen) {
                                      playGameSfx("snap", soundEnabled);
                                      setRevealedClues((prev) => [...prev, cIdx]);
                                    }
                                  }}
                                  className={`rounded-xl border p-3 text-left text-xs transition-all min-h-[64px] flex items-center gap-2 ${
                                    isOpen
                                      ? "border-emerald/50 bg-emerald/10 text-emerald cursor-default"
                                      : "border-border border-dashed bg-secondary/70 hover:border-primary text-muted-foreground cursor-pointer"
                                  }`}
                                >
                                  <Eye className={`w-4 h-4 shrink-0 ${isOpen ? "text-emerald" : "text-primary"}`} />
                                  <span>{isOpen ? clue : `Dalil #${cIdx + 1} ni tekshirish`}</span>
                                </motion.button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : activeSlug === "qonuniy_yoki_noqonuniy" ? (
                    /* Animated Scanner Document Card + Stamp Slam */
                    <div className="relative overflow-hidden rounded-2xl border-2 border-border bg-background/80 p-6 sm:p-8 text-center space-y-3">
                      {!feedback && (
                        <motion.div
                          aria-hidden="true"
                          animate={{ y: ["-10%", "280%", "-10%"] }}
                          transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
                          className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-primary/15 via-primary/5 to-transparent"
                        />
                      )}
                      <div className="text-xs font-semibold text-primary uppercase tracking-wider">
                        Hujjat / Vaziyat skaneri
                      </div>
                      <p className="text-base sm:text-xl font-bold text-foreground max-w-2xl mx-auto leading-relaxed">
                        {currentChoiceRound.prompt}
                      </p>

                      {feedback && (
                        <motion.div
                          initial={{ scale: 1.8, opacity: 0, rotate: -18 }}
                          animate={{ scale: 1, opacity: 1, rotate: -6 }}
                          transition={{ type: "spring", stiffness: 280, damping: 18 }}
                          className={`inline-block mt-2 rounded-xl border-4 px-5 py-1.5 text-sm font-black uppercase tracking-widest ${
                            currentChoiceRound.correctIndex === 0
                              ? "border-primary text-primary bg-primary/10"
                              : "border-red-400 text-red-400 bg-red-500/10"
                          }`}
                        >
                          {currentChoiceRound.correctIndex === 0 ? "QONUNIY" : "NOQONUNIY"}
                        </motion.div>
                      )}
                    </div>
                  ) : activeSlug === "xatoni_top" ? (
                    /* Scanned Official Document Header for Xatoni Top */
                    <div className="rounded-2xl border border-border bg-background/80 p-5 space-y-2">
                      <div className="flex items-center justify-between text-xs text-muted-foreground border-b border-border/60 pb-2">
                        <span className="font-semibold text-primary uppercase tracking-wider flex items-center gap-1.5">
                          <FileSearch className="w-4 h-4" /> Hujjat ekspertizasi blanki
                        </span>
                        <span>Xato bandni bosib muhrlang</span>
                      </div>
                      <p className="text-base sm:text-lg font-semibold text-foreground pt-1">{currentChoiceRound.prompt}</p>
                    </div>
                  ) : (
                    /* Tezkor Qaror Prompt Card */
                    <div className="rounded-2xl border border-border bg-background/75 p-5 space-y-2">
                      <div className="text-xs font-semibold text-primary uppercase tracking-wider">
                        Tezkor vaziyat signali
                      </div>
                      <p className="text-base sm:text-lg font-semibold text-foreground">{currentChoiceRound.prompt}</p>
                    </div>
                  )}

                  {/* Option Cards */}
                  <motion.div
                    key={`opts-${shakeTrigger}`}
                    animate={feedback && !feedback.ok ? { x: [0, -7, 7, -4, 4, 0] } : {}}
                    transition={{ duration: 0.28 }}
                    className={
                      activeSlug === "qonuniy_yoki_noqonuniy"
                        ? "grid grid-cols-1 sm:grid-cols-2 gap-4"
                        : activeSlug === "xatoni_top"
                        ? "space-y-2.5"
                        : "grid grid-cols-1 md:grid-cols-2 gap-3"
                    }
                  >
                    {currentChoiceRound.options.map((opt, idx) => {
                      const isPicked = selectedIdx === idx;
                      const isCorrect = idx === currentChoiceRound.correctIndex;
                      const displayLabel =
                        activeSlug === "xatoni_top"
                          ? opt.replace(/^\d+\)\s*/, "")
                          : opt;

                      if (activeSlug === "qonuniy_yoki_noqonuniy") {
                        const isLawfulBtn = idx === 0;
                        let cls = isLawfulBtn
                          ? "border-primary/40 bg-primary/10 hover:bg-primary/20 text-foreground"
                          : "border-red-500/40 bg-red-500/10 hover:bg-red-500/20 text-foreground";
                        if (feedback) {
                          if (isCorrect) cls = "border-primary bg-primary/25 text-foreground shadow-[0_0_24px_rgba(5,234,0,0.22)]";
                          else if (isPicked) cls = "border-red-500 bg-red-500/25 text-red-100";
                          else cls = "border-border bg-background/40 text-muted-foreground opacity-60";
                        }
                        return (
                          <motion.button
                            key={idx}
                            type="button"
                            disabled={!!feedback}
                            whileHover={feedback ? undefined : { y: -3, scale: 1.01 }}
                            whileTap={feedback ? undefined : { scale: 0.96 }}
                            onClick={() => handleChoiceAnswer(idx)}
                            className={`rounded-2xl border-2 border-b-4 p-5 text-center transition-all flex items-center justify-center gap-3 cursor-pointer ${cls}`}
                          >
                            {isLawfulBtn ? (
                              <ShieldCheck className="w-6 h-6 text-primary shrink-0" />
                            ) : (
                              <ShieldAlert className="w-6 h-6 text-red-400 shrink-0" />
                            )}
                            <span className="text-base font-extrabold tracking-wide">{displayLabel}</span>
                          </motion.button>
                        );
                      }

                      let cls = "border-border bg-secondary/75 hover:border-primary text-foreground";
                      if (feedback) {
                        if (isCorrect) cls = "border-primary bg-primary/15 text-foreground shadow-[0_0_20px_rgba(5,234,0,0.16)]";
                        else if (isPicked) cls = "border-red-500/70 bg-red-500/10 text-red-200";
                      }
                      return (
                        <motion.button
                          key={idx}
                          type="button"
                          disabled={!!feedback}
                          whileHover={feedback ? undefined : { y: -2 }}
                          whileTap={feedback ? undefined : { scale: 0.98 }}
                          onClick={() => handleChoiceAnswer(idx)}
                          className={`w-full rounded-2xl border-2 border-b-4 p-4 text-left text-xs sm:text-sm transition-all flex items-center justify-between gap-3 cursor-pointer ${cls}`}
                        >
                          <div className="flex items-start gap-2.5">
                            <span className="w-6 h-6 rounded-lg bg-background/70 border border-border flex items-center justify-center text-[11px] font-bold text-primary shrink-0 tabular-nums">
                              {activeSlug === "xatoni_top" ? `${idx + 1}` : ["A", "B", "C", "D"][idx]}
                            </span>
                            <span className="leading-relaxed">{displayLabel}</span>
                          </div>
                          {feedback && isCorrect && <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />}
                          {feedback && isPicked && !isCorrect && <XCircle className="w-4 h-4 text-red-400 shrink-0" />}
                        </motion.button>
                      );
                    })}
                  </motion.div>

                  {feedback && (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/10 p-4"
                    >
                      <div className="text-sm text-foreground flex-1 min-w-[220px]">
                        <strong className={feedback.ok ? "text-primary" : "text-red-300"}>
                          {feedback.ok ? `To'g'ri! +${CHOICE_PTS} ball: ` : "Huquqiy izoh: "}
                        </strong>
                        {feedback.text}
                      </div>
                      <Button size="sm" onClick={advanceChoiceRound} className="gap-1.5 whitespace-nowrap">
                        {roundIdx + 1 >= session.choiceRounds.length ? "Natijani ko'rish" : "Keyingi bosqich"}{" "}
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Button>
                    </motion.div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </motion.div>
      )}
    </div>
  );
}
