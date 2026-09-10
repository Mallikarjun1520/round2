import React, { useState, useEffect, useCallback, useRef } from 'react';
import RopeVisualizer from './components/RopeVisualizer';
import Scoreboard from './components/Scoreboard';
import QuestionCard from './components/QuestionCard';
import TieBreaker from './components/TieBreaker';
import JsonManagerModal from './components/JsonManagerModal';
import MatchHistoryModal from './components/MatchHistoryModal';
import { sounds } from './utils/soundEffects';
import { saveGame, loadGame, clearGame } from './utils/gamePersistence';
import confetti from 'canvas-confetti';
import { Trophy, Zap, Play, RotateCcw, Settings, Award, History, Timer, Swords, Bomb } from 'lucide-react';

export default function App() {
  // Game Configuration & Question Data State
  const [questionsData, setQuestionsData] = useState(null);
  // 'SETUP' | 'BOARD' | 'QUESTION' | 'NO_ESCAPE_QUESTION' | 'TIE_BREAKER_PREP' | 'TIE_BREAKER' | 'GAME_OVER'
  const [gameMode, setGameMode] = useState('SETUP');

  // Team States
  const [teamA, setTeamA] = useState({
    name: 'Red Dragons',
    score: 0,
    powerUps: { challenge: true, timeBomb: true, noEscape: true }
  });
  const [teamB, setTeamB] = useState({
    name: 'Blue Titans',
    score: 0,
    powerUps: { challenge: true, timeBomb: true, noEscape: true }
  });

  // Game Mechanics State
  const [ropePosition, setRopePosition] = useState(0); // range: -25 to +25. KO at ±20
  const [lastDelta, setLastDelta] = useState(0);
  const [activeTeam, setActiveTeam] = useState('A'); // 'A' or 'B'
  const [currentTurnIndex, setCurrentTurnIndex] = useState(0); // 0 to 35 (36 total turns)

  // Power-up state for current turn
  const [activePowerUp, setActivePowerUp] = useState(null); // null | { type: 'challenge'|'timeBomb', by: 'A'|'B' }
  const [challengeQuestion, setChallengeQuestion] = useState(null); // upgraded question for challenge

  // No Escape state
  const [noEscapeData, setNoEscapeData] = useState(null);

  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isJsonModalOpen, setIsJsonModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  const [matchHistory, setMatchHistory] = useState([]);
  const [winnerInfo, setWinnerInfo] = useState(null);
  const [tieBreakerPrepSeconds, setTieBreakerPrepSeconds] = useState(15);
  const [noEscapeRevealSeconds, setNoEscapeRevealSeconds] = useState(10);

  // Original question state (preserved across powerup activations)
  const [originalQuestionDifficulty, setOriginalQuestionDifficulty] = useState(null);
  const [originalQuestionPoints, setOriginalQuestionPoints] = useState(null);
  const [originalQuestionTimeLimit, setOriginalQuestionTimeLimit] = useState(null);
  const [currentQuestionDifficulty, setCurrentQuestionDifficulty] = useState(null);

  // TimeBomb mid-question state
  const [timeBombActive, setTimeBombActive] = useState(false);

  // === Explicit powerup / timer state (follows the existing state architecture) ===
  // activePowerup mirrors the logical state of the live question/turn.
  // 'NORMAL_TURN' | 'CHALLENGE_ACTIVE' | 'TIME_BOMB_ACTIVE' | 'NO_ESCAPE_TRANSFER'
  // | 'NO_ESCAPE_RECEIVER_TURN' | 'QUESTION_RESULT' | 'GAME_OVER'
  const [activePowerup, setActivePowerup] = useState('NORMAL_TURN');
  const [challengeActivatedBy, setChallengeActivatedBy] = useState(null); // 'A' | 'B'
  const [timeBombActivatedBy, setTimeBombActivatedBy] = useState(null); // 'A' | 'B'
  const [noEscapeActivatedBy, setNoEscapeActivatedBy] = useState(null); // 'A' | 'B'
  const [noEscapeReceivingTeam, setNoEscapeReceivingTeam] = useState(null); // 'A' | 'B'
  const [originalQuestionTimer, setOriginalQuestionTimer] = useState(null); // seconds
  const [currentQuestionDeadline, setCurrentQuestionDeadline] = useState(null); // effective seconds remaining on the authoritative clock
  const [timerState, setTimerState] = useState('IDLE'); // 'IDLE' | 'RUNNING' | 'PAUSED' | 'STOPPED'
  const [timeBombDecrease, setTimeBombDecrease] = useState(0); // seconds removed from the remaining time

  // Absolute wall-clock timestamps used so a reload resumes timers exactly.
  // questionStartMs = when the current question was revealed,
  // questionDeadlineMs = when it expires (effective time applied at reveal).
  const [questionStartMs, setQuestionStartMs] = useState(null);
  const [questionDeadlineMs, setQuestionDeadlineMs] = useState(null);
  // Absolute deadline for the 10s No Escape transfer window.
  const [noEscapeRevealDeadlineMs, setNoEscapeRevealDeadlineMs] = useState(null);
  // Absolute deadline for the 15s lead-in prep before the tie breaker question.
  const [tieBreakerPrepDeadlineMs, setTieBreakerPrepDeadlineMs] = useState(null);
  // Live child-component state mirrors (auto-saved / restored on reload).
  const [questionUIState, setQuestionUIState] = useState(null); // { selectedIndex, isSubmitted, answerResult }
  const [tieBreakerState, setTieBreakerState] = useState(null);

  // Persistence plumbing
  const restorePerformedRef = useRef(false);
  const freshGameStartedRef = useRef(false);
  const saveTimerRef = useRef(null);
  const buildSnapshotRef = useRef(null);

  // Absolute-deadline lead-in prep before the tie breaker (15s), so a reload
  // resumes the exact countdown. When it expires, move to the tie breaker.
  useEffect(() => {
    if (gameMode !== 'TIE_BREAKER_PREP') {
      setTieBreakerPrepDeadlineMs(null);
      return;
    }
    if (restorePerformedRef.current && tieBreakerPrepDeadlineMs == null) {
      // A restored prep screen arrived without a deadline — re-anchor it.
      setTieBreakerPrepDeadlineMs(Date.now() + tieBreakerPrepSeconds * 1000);
      return;
    }
    const deadline = tieBreakerPrepDeadlineMs;
    const update = () => {
      const secondsLeft = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setTieBreakerPrepSeconds(secondsLeft);
      if (Date.now() >= deadline) {
        setGameMode('TIE_BREAKER');
      }
    };
    update();
    const id = setInterval(update, 250);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameMode, tieBreakerPrepDeadlineMs]);

  // No Escape 10-second window before the question opens to the other team —
  // anchored to an absolute deadline so a reload resumes the exact transition.
  useEffect(() => {
    if (gameMode !== 'NO_ESCAPE_QUESTION') {
      setNoEscapeRevealDeadlineMs(null);
      return;
    }
    if (restorePerformedRef.current && noEscapeRevealDeadlineMs == null) {
      setNoEscapeRevealDeadlineMs(Date.now() + noEscapeRevealSeconds * 1000);
      return;
    }
    const deadline = noEscapeRevealDeadlineMs;
    const update = () => {
      const secondsLeft = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setNoEscapeRevealSeconds(secondsLeft);
      if (Date.now() >= deadline) {
        setNoEscapeRevealSeconds(0);
      }
    };
    update();
    const id = setInterval(update, 250);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameMode, noEscapeRevealDeadlineMs]);

  // When the No Escape 10s transition completes, the receiving team's question
  // timer starts (the separate transition countdown is NOT the receiver's time).
  useEffect(() => {
    if (gameMode !== 'NO_ESCAPE_QUESTION') return;
    if (noEscapeRevealSeconds > 0) return;
    setActivePowerup('NO_ESCAPE_RECEIVER_TURN');
    setTimerState('RUNNING');
    if (questionDeadlineMs == null && noEscapeData) {
      const now = Date.now();
      const points = noEscapeData.points;
      const seconds =
        points === 1 ? 45 : points === 2 ? 60 : points === 3 ? 90 : 90;
      setQuestionStartMs(now);
      setQuestionDeadlineMs(now + seconds * 1000);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameMode, noEscapeRevealSeconds]);

  // Load questions on mount
  useEffect(() => {
    fetch('/questions.json')
      .then((res) => res.json())
      .then((data) => setQuestionsData(data))
      .catch((err) => console.error('Error loading default questions.json:', err));
  }, []);

  // === PERSISTENCE (IndexedDB snapshot / restore) ===
  // Snapshot builder always reflects the latest render, so any effect can call
  // buildSnapshotRef.current() without stale-closure issues.
  buildSnapshotRef.current = () => ({
    gameMode,
    teamA,
    teamB,
    ropePosition,
    lastDelta,
    activeTeam,
    currentTurnIndex,
    activePowerUp,
    challengeQuestion,
    noEscapeData,
    winnerInfo,
    matchHistory,
    noEscapeRevealSeconds,
    noEscapeRevealDeadlineMs,
    originalQuestionDifficulty,
    originalQuestionPoints,
    originalQuestionTimeLimit,
    currentQuestionDifficulty,
    timeBombActive,
    activePowerup,
    challengeActivatedBy,
    timeBombActivatedBy,
    noEscapeActivatedBy,
    noEscapeReceivingTeam,
    originalQuestionTimer,
    currentQuestionDeadline,
    timerState,
    timeBombDecrease,
    questionStartMs,
    questionDeadlineMs,
    tieBreakerPrepSeconds,
    tieBreakerPrepDeadlineMs,
    questionUIState,
    tieBreakerState
  });

  const applySnapshot = (snap) => {
    if (!snap || typeof snap !== 'object') return;
    setGameMode(snap.gameMode ?? 'SETUP');
    setTeamA(snap.teamA ?? teamA);
    setTeamB(snap.teamB ?? teamB);
    setRopePosition(snap.ropePosition ?? 0);
    setLastDelta(snap.lastDelta ?? 0);
    setActiveTeam(snap.activeTeam ?? 'A');
    setCurrentTurnIndex(snap.currentTurnIndex ?? 0);
    setActivePowerUp(snap.activePowerUp ?? null);
    setChallengeQuestion(snap.challengeQuestion ?? null);
    setNoEscapeData(snap.noEscapeData ?? null);
    setWinnerInfo(snap.winnerInfo ?? null);
    setMatchHistory(snap.matchHistory ?? []);
    setNoEscapeRevealSeconds(snap.noEscapeRevealSeconds ?? 0);
    setNoEscapeRevealDeadlineMs(snap.noEscapeRevealDeadlineMs ?? null);
    setOriginalQuestionDifficulty(snap.originalQuestionDifficulty ?? null);
    setOriginalQuestionPoints(snap.originalQuestionPoints ?? null);
    setOriginalQuestionTimeLimit(snap.originalQuestionTimeLimit ?? null);
    setCurrentQuestionDifficulty(snap.currentQuestionDifficulty ?? null);
    setTimeBombActive(snap.timeBombActive ?? false);
    setActivePowerup(snap.activePowerup ?? 'NORMAL_TURN');
    setChallengeActivatedBy(snap.challengeActivatedBy ?? null);
    setTimeBombActivatedBy(snap.timeBombActivatedBy ?? null);
    setNoEscapeActivatedBy(snap.noEscapeActivatedBy ?? null);
    setNoEscapeReceivingTeam(snap.noEscapeReceivingTeam ?? null);
    setOriginalQuestionTimer(snap.originalQuestionTimer ?? null);
    setCurrentQuestionDeadline(snap.currentQuestionDeadline ?? null);
    setTimerState(snap.timerState ?? 'IDLE');
    setTimeBombDecrease(snap.timeBombDecrease ?? 0);
    setQuestionStartMs(snap.questionStartMs ?? null);
    setQuestionDeadlineMs(snap.questionDeadlineMs ?? null);
    setTieBreakerPrepSeconds(snap.tieBreakerPrepSeconds ?? 0);
    setTieBreakerPrepDeadlineMs(snap.tieBreakerPrepDeadlineMs ?? null);
    setQuestionUIState(snap.questionUIState ?? null);
    setTieBreakerState(snap.tieBreakerState ?? null);
  };

  // Boot restore: resume the exact prior match (once per component mount).
  useEffect(() => {
    if (restorePerformedRef.current) return;
    restorePerformedRef.current = true;
    loadGame().then((snap) => {
      if (snap && !freshGameStartedRef.current) applySnapshot(snap);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced auto-save. Uses buildSnapshotRef so it always writes the latest
  // state after every render without a sprawling dependency array.
  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      if (gameMode !== 'SETUP') {
        saveGame(buildSnapshotRef.current());
      }
    }, 250);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  });

  // Flush any pending save immediately when the tab is hidden/closing.
  useEffect(() => {
    const flush = () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveGame(buildSnapshotRef.current());
    };
    window.addEventListener('pagehide', flush);
    return () => window.removeEventListener('pagehide', flush);
  }, []);

  const handleStartGame = () => {
    freshGameStartedRef.current = true;
    setTeamA((prev) => ({
      ...prev,
      score: 0,
      powerUps: { challenge: true, timeBomb: true, noEscape: true }
    }));
    setTeamB((prev) => ({
      ...prev,
      score: 0,
      powerUps: { challenge: true, timeBomb: true, noEscape: true }
    }));
    setRopePosition(0);
    setLastDelta(0);
    setActiveTeam('A');
    setCurrentTurnIndex(0);
    setActivePowerUp(null);
    setChallengeQuestion(null);
    setNoEscapeData(null);
    setWinnerInfo(null);
    setMatchHistory([]);
    setNoEscapeRevealSeconds(10);
    setOriginalQuestionDifficulty(null);
    setOriginalQuestionPoints(null);
    setOriginalQuestionTimeLimit(null);
    setCurrentQuestionDifficulty(null);
    setTimeBombActive(false);
    setActivePowerup('NORMAL_TURN');
    setChallengeActivatedBy(null);
    setTimeBombActivatedBy(null);
    setNoEscapeActivatedBy(null);
    setNoEscapeReceivingTeam(null);
    setOriginalQuestionTimer(null);
    setCurrentQuestionDeadline(null);
    setTimerState('IDLE');
    setTimeBombDecrease(0);
    setQuestionStartMs(null);
    setQuestionDeadlineMs(null);
    setNoEscapeRevealDeadlineMs(null);
    setTieBreakerPrepDeadlineMs(null);
    setQuestionUIState(null);
    setTieBreakerState(null);
    setGameMode('BOARD');
    sounds.init();
    clearGame();
  };

  // === MATCH HISTORY LOGGING ===
  const logMatchEvent = useCallback((entry) => {
    setMatchHistory((prev) => [
      ...prev,
      { id: `${Date.now()}-${prev.length}`, timestamp: new Date().toISOString(), ...entry }
    ]);
  }, []);

  // === QUESTION ROUTING ===
  const getCurrentStage = () => {
    if (currentTurnIndex < 12) return 'easy';
    if (currentTurnIndex < 24) return 'medium';
    return 'hard';
  };

  const getStageRules = () => {
    const stage = getCurrentStage();
    if (stage === 'easy') return { difficulty: 'easy', timeLimit: 45, points: 1 };
    if (stage === 'medium') return { difficulty: 'medium', timeLimit: 60, points: 2 };
    return { difficulty: 'hard', timeLimit: 90, points: 3 };
  };

  const getTeamQuestionIndex = () => {
    const stageTurnOffset = currentTurnIndex < 12 ? 0 : currentTurnIndex < 24 ? 12 : 24;
    const turnWithinStage = currentTurnIndex - stageTurnOffset;
    return Math.floor(turnWithinStage / 2);
  };

  const getCurrentQuestion = () => {
    if (!questionsData || !questionsData.questions) return null;
    const stage = getCurrentStage();
    const teamKey = activeTeam === 'A' ? 'teamA' : 'teamB';
    const teamQuestions = questionsData.questions[teamKey];
    if (!teamQuestions) return null;

    const stageQuestions = teamQuestions[stage] || [];
    const qIndex = getTeamQuestionIndex();

    return stageQuestions[qIndex % stageQuestions.length] || stageQuestions[0];
  };

  const getChallengeUpgradeQuestion = () => {
    if (!questionsData?.questions?.challenge_upgrades) return null;
    const stage = getCurrentStage();
    let upgradeKey;
    if (stage === 'easy') upgradeKey = 'medium';
    else if (stage === 'medium') upgradeKey = 'hard';
    else upgradeKey = 'very_hard';

    const upgradeQuestions = questionsData.questions.challenge_upgrades[upgradeKey] || [];
    const qIndex = getTeamQuestionIndex();
    return upgradeQuestions[qIndex % upgradeQuestions.length] || upgradeQuestions[0];
  };

  const getTimeBombReduction = (difficulty) => {
    if (difficulty === 'easy') return 0;
    if (difficulty === 'medium') return 25;
    return 30;
  };

  // === CHALLENGE ACTIVATION (opposing team activates BEFORE reveal) ===
  const handleChallengeActivate = useCallback((challengerTeam) => {
    if (activePowerUp) return;
    // Enforce rules: Challenge is an OPPONENT powerup usable ONLY before reveal.
    if (gameMode !== 'BOARD') return;
    if (challengerTeam === activeTeam) return;
    if (challengerTeam === 'A') {
      setTeamA((prev) => ({ ...prev, powerUps: { ...prev.powerUps, challenge: false } }));
    } else {
      setTeamB((prev) => ({ ...prev, powerUps: { ...prev.powerUps, challenge: false } }));
    }
    sounds.playChallengeAlert();
    const stageRules = getStageRules();
    const escalatedDifficulty = stageRules.difficulty === 'easy' ? 'medium'
      : stageRules.difficulty === 'medium' ? 'hard' : 'very_hard';
    const upgradeQ = getChallengeUpgradeQuestion();
    setOriginalQuestionDifficulty(stageRules.difficulty);
    setOriginalQuestionPoints(stageRules.points);
    setOriginalQuestionTimeLimit(stageRules.timeLimit);
    setCurrentQuestionDifficulty(escalatedDifficulty);
    setChallengeQuestion(upgradeQ);
    setTimeBombActive(false);
    setActivePowerUp({ type: 'challenge', by: challengerTeam });
    // Explicit powerup / timer state
    setActivePowerup('CHALLENGE_ACTIVE');
    setChallengeActivatedBy(challengerTeam);
    setOriginalQuestionTimer(stageRules.timeLimit);
    setCurrentQuestionDeadline(stageRules.timeLimit);
    setTimerState('RUNNING');
  }, [activePowerUp, currentTurnIndex, questionsData, gameMode, activeTeam]);

  // === TIMEBOMB ACTIVATION (opposing team activates BEFORE reveal) ===
  const handleTimeBombActivate = useCallback((bombTeam) => {
    if (activePowerUp) return;
    // Enforce rules: Time Bomb is an OPPONENT powerup usable ONLY before reveal.
    if (gameMode !== 'BOARD') return;
    if (bombTeam === activeTeam) return;
    const stageRules = getStageRules();
    if (stageRules.difficulty === 'easy') return;
    if (bombTeam === 'A') {
      setTeamA((prev) => ({ ...prev, powerUps: { ...prev.powerUps, timeBomb: false } }));
    } else {
      setTeamB((prev) => ({ ...prev, powerUps: { ...prev.powerUps, timeBomb: false } }));
    }
    sounds.playChallengeAlert();
    setActivePowerUp({ type: 'timeBomb', by: bombTeam });
    setTimeBombActive(true);
    // Explicit powerup / timer state. The reduction is applied to the actual
    // remaining time inside the question timer (authoritative deadline).
    setActivePowerup('TIME_BOMB_ACTIVE');
    setTimeBombActivatedBy(bombTeam);
    setTimeBombDecrease(getTimeBombReduction(stageRules.difficulty));
    setTimerState('RUNNING');
  }, [activePowerUp, currentTurnIndex, gameMode, activeTeam]);

  // === NO ESCAPE HANDLER ===
  const handleNoEscape = useCallback(() => {
    if (activePowerUp?.type === 'challenge') return;
    // Enforce rules: No Escape is usable ONLY by the current answering team
    // AFTER the question is revealed (i.e., while the question is open).
    if (gameMode !== 'QUESTION') return;

    const currentAnsweringTeam = activeTeam;

    const stageRules = getStageRules();
    const currentQ = getCurrentQuestion();

    if (currentAnsweringTeam === 'A') {
      setTeamA((prev) => ({ ...prev, powerUps: { ...prev.powerUps, noEscape: false } }));
    } else {
      setTeamB((prev) => ({ ...prev, powerUps: { ...prev.powerUps, noEscape: false } }));
    }

    const origPts = originalQuestionPoints ?? stageRules.points;
    const origDiff = originalQuestionDifficulty ?? stageRules.difficulty;

    setNoEscapeData({
      question: currentQ,
      difficulty: stageRules.difficulty,
      points: origPts,
      originalDifficulty: origDiff,
      activatingTeam: currentAnsweringTeam
    });

    setNoEscapeRevealSeconds(10);
    setNoEscapeRevealDeadlineMs(Date.now() + 10000);
    setQuestionStartMs(null);
    setQuestionDeadlineMs(null);
    setQuestionUIState(null);
    setGameMode('NO_ESCAPE_QUESTION');
    // Explicit powerup / timer state. Receiving team = the opposite team; its
    // question clock is PAUSED until the blank 10s transition completes.
    setActivePowerup('NO_ESCAPE_TRANSFER');
    setNoEscapeActivatedBy(currentAnsweringTeam);
    setNoEscapeReceivingTeam(currentAnsweringTeam === 'A' ? 'B' : 'A');
    setTimerState('PAUSED');
  }, [activeTeam, activePowerUp, currentTurnIndex, questionsData, originalQuestionPoints, originalQuestionDifficulty, gameMode]);

  // === NO ESCAPE RESULT HANDLER ===
  const handleNoEscapeResult = (result) => {
    const { isCorrect, chosenAnswerText, correctAnswerText, questionText, timeTaken, timeLimit } = result;
    const { points, activatingTeam, originalDifficulty, difficulty } = noEscapeData;
    const answeringTeam = activatingTeam === 'A' ? 'B' : 'A';
    let posChange = 0;
    let pointsAwardedTo = null;
    let pointsAwarded = 0;

    if (!isCorrect) {
      pointsAwardedTo = activatingTeam;
      pointsAwarded = points;
      if (activatingTeam === 'A') {
        posChange = -points;
        setTeamA((prev) => ({ ...prev, score: prev.score + points }));
      } else {
        posChange = +points;
        setTeamB((prev) => ({ ...prev, score: prev.score + points }));
      }
    }

    logMatchEvent({
      turnLabel: `Q${currentTurnIndex + 1}`,
      eventType: 'NO_ESCAPE',
      difficulty: originalDifficulty || difficulty,
      answeringTeamKey: answeringTeam,
      answeringTeamName: answeringTeam === 'A' ? teamA.name : teamB.name,
      initiatorName: activatingTeam === 'A' ? teamA.name : teamB.name,
      questionText,
      chosenAnswerText,
      correctAnswerText,
      isCorrect,
      pointsAwardedToName: pointsAwardedTo === 'A' ? teamA.name : pointsAwardedTo === 'B' ? teamB.name : null,
      pointsAwarded,
      timeTaken,
      timeLimit
    });

    setLastDelta(posChange);
    const newPos = Math.max(-25, Math.min(25, ropePosition + posChange));
    setRopePosition(newPos);

    const koThreshold = questionsData?.rules?.knockoutThreshold || 20;
    if (newPos <= -koThreshold) {
      triggerGameOver(teamA.name, 'KNOCKOUT');
      setNoEscapeData(null);
      return;
    }
    if (newPos >= koThreshold) {
      triggerGameOver(teamB.name, 'KNOCKOUT');
      setNoEscapeData(null);
      return;
    }

    advanceTurn(newPos);
    setNoEscapeData(null);
  };

  // === SUBMIT ANSWER ===
  const handleSubmitAnswer = (result) => {
    const { isCorrect, isChallenged: wasChallenged, chosenAnswerText, correctAnswerText, questionText, timeTaken, timeLimit } = result;
    const stageRules = getStageRules();
    // Rope movement and scoring must always use the ORIGINAL question point value,
    // even when the difficulty was escalated by a Challenge.
    const pts = originalQuestionPoints ?? stageRules.points;
    let posChange = 0;

    const answeringTeam = activeTeam;

    let pointsAwardedTo = null;
    let pointsAwarded = 0;

    if (answeringTeam === 'A') {
      if (isCorrect) {
        posChange = -pts;
        pointsAwardedTo = 'A';
        pointsAwarded = pts;
        setTeamA((prev) => ({ ...prev, score: prev.score + pts }));
      } else if (wasChallenged) {
        posChange = +(pts * 2);
        pointsAwardedTo = 'B';
        pointsAwarded = pts * 2;
        setTeamB((prev) => ({ ...prev, score: prev.score + (pts * 2) }));
      }
    } else {
      if (isCorrect) {
        posChange = +pts;
        pointsAwardedTo = 'B';
        pointsAwarded = pts;
        setTeamB((prev) => ({ ...prev, score: prev.score + pts }));
      } else if (wasChallenged) {
        posChange = -(pts * 2);
        pointsAwardedTo = 'A';
        pointsAwarded = pts * 2;
        setTeamA((prev) => ({ ...prev, score: prev.score + (pts * 2) }));
      }
    }

    const loggedDifficulty = wasChallenged
      ? (stageRules.difficulty === 'easy' ? 'medium' : stageRules.difficulty === 'medium' ? 'hard' : 'very_hard')
      : stageRules.difficulty;

    logMatchEvent({
      turnLabel: `Q${currentTurnIndex + 1}`,
      eventType: wasChallenged ? 'CHALLENGE' : (activePowerUp?.type === 'timeBomb' ? 'TIMEBOMB' : 'NORMAL'),
      difficulty: loggedDifficulty,
      answeringTeamKey: answeringTeam,
      answeringTeamName: answeringTeam === 'A' ? teamA.name : teamB.name,
      initiatorName: activePowerUp ? (activePowerUp.by === 'A' ? teamA.name : teamB.name) : null,
      questionText,
      chosenAnswerText,
      correctAnswerText,
      isCorrect,
      pointsAwardedToName: pointsAwardedTo === 'A' ? teamA.name : pointsAwardedTo === 'B' ? teamB.name : null,
      pointsAwarded,
      timeTaken,
      timeLimit
    });

    setLastDelta(posChange);
    const newPos = Math.max(-25, Math.min(25, ropePosition + posChange));
    setRopePosition(newPos);

    const koThreshold = questionsData?.rules?.knockoutThreshold || 20;
    if (newPos <= -koThreshold) {
      triggerGameOver(teamA.name, 'KNOCKOUT');
      return;
    }
    if (newPos >= koThreshold) {
      triggerGameOver(teamB.name, 'KNOCKOUT');
      return;
    }

    advanceTurn(newPos);
  };

  const advanceTurn = (currentPos) => {
    const nextTurn = currentTurnIndex + 1;
    if (nextTurn >= 36) {
      if (currentPos < 0) {
        triggerGameOver(teamA.name, 'ROPE POSITION');
      } else if (currentPos > 0) {
        triggerGameOver(teamB.name, 'ROPE POSITION');
      } else {
        setTieBreakerPrepSeconds(15);
        setTieBreakerPrepDeadlineMs(Date.now() + 15000);
        setGameMode('TIE_BREAKER_PREP');
      }
      return;
    }
    setCurrentTurnIndex(nextTurn);
    setActiveTeam((prev) => (prev === 'A' ? 'B' : 'A'));
    setActivePowerUp(null);
    setChallengeQuestion(null);
    setTimeBombActive(false);
    setOriginalQuestionDifficulty(null);
    setOriginalQuestionPoints(null);
    setOriginalQuestionTimeLimit(null);
    setCurrentQuestionDifficulty(null);
    setActivePowerup('NORMAL_TURN');
    setChallengeActivatedBy(null);
    setTimeBombActivatedBy(null);
    setNoEscapeActivatedBy(null);
    setNoEscapeReceivingTeam(null);
    setOriginalQuestionTimer(null);
    setCurrentQuestionDeadline(null);
    setTimeBombDecrease(0);
    setTimerState('IDLE');
    setQuestionStartMs(null);
    setQuestionDeadlineMs(null);
    setQuestionUIState(null);
    setGameMode('BOARD');
  };

  const triggerGameOver = (winnerName, method) => {
    setWinnerInfo({ name: winnerName, method });
    setGameMode('GAME_OVER');
    setActivePowerup('GAME_OVER');
    setTimerState('STOPPED');
    sounds.playVictory();
    confetti({ particleCount: 200, spread: 100, origin: { y: 0.5 } });
  };

  const handleFinishTieBreaker = (tbWinnerName) => {
    triggerGameOver(tbWinnerName, 'TIE BREAKER');
  };

  const toggleSound = () => {
    const enabled = sounds.toggleSound();
    setSoundEnabled(enabled);
  };

  if (!questionsData) {
    return (
      <div className="app-container" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div className="loading-screen">
          <div className="loading-spinner"></div>
          <h2>Loading Tug of War...</h2>
        </div>
      </div>
    );
  }

  // First-round (opening 18 questions per team) stats: correct-answer count and
  // total selection time for CORRECT answers only. Used only when the Tie
  // Breaker ends in a deadlock where BOTH teams got every tie-breaker question
  // wrong. Tie-breaker rounds are excluded from this tally.
  const firstRoundStats = { A: { correct: 0, totalMs: 0 }, B: { correct: 0, totalMs: 0 } };
  matchHistory.forEach((entry) => {
    if (entry.eventType === 'TIEBREAKER') return;
    const teamKey = entry.answeringTeamKey;
    if (teamKey !== 'A' && teamKey !== 'B') return;
    if (!entry.isCorrect) return;
    firstRoundStats[teamKey].correct += 1;
    firstRoundStats[teamKey].totalMs += (Number(entry.timeTaken) || 0) * 1000;
  });

  const currentQ = activePowerUp?.type === 'challenge' && challengeQuestion
    ? challengeQuestion
    : getCurrentQuestion();
  const stageRules = getStageRules();
  const opposingTeamObj = activeTeam === 'A' ? teamB : teamA;
  const opponentKey = activeTeam === 'A' ? 'B' : 'A';
  const activeTeamObj = activeTeam === 'A' ? teamA : teamB;

  // Track original question properties (preserved across powerup activations)
  const effectiveOriginalDifficulty = originalQuestionDifficulty ?? stageRules.difficulty;
  const effectiveOriginalPoints = originalQuestionPoints ?? stageRules.points;
  const effectiveOriginalTimeLimit = originalQuestionTimeLimit ?? stageRules.timeLimit;

  // Current difficulty after challenge escalation
  const effectiveCurrentDifficulty = currentQuestionDifficulty ?? stageRules.difficulty;

  // Determine which team is answering — ALWAYS the active (turn) team.
  // A Challenge escalates the CURRENT team's question; it never hands the
  // turn to the challenger.
  const isChallengedNow = activePowerUp?.type === 'challenge';
  const answeringTeamKey = activeTeam;
  const answeringTeamObj = answeringTeamKey === 'A' ? teamA : teamB;
  const actualOpposingTeamObj = answeringTeamKey === 'A' ? teamB : teamA;

  // STRICT RULE: If the turn is challenged, No Escape is explicitly FALSE.
  const canUseNoEscape = !isChallengedNow && answeringTeamObj.powerUps.noEscape;

  let effectiveTimeLimit = stageRules.timeLimit;
  if (activePowerUp?.type === 'challenge') {
    effectiveTimeLimit = stageRules.timeLimit;
  } else if (activePowerUp?.type === 'timeBomb') {
    effectiveTimeLimit = Math.max(0, stageRules.timeLimit - getTimeBombReduction(stageRules.difficulty));
  }

  const displayDifficulty = effectiveCurrentDifficulty;

  // Launch question with an authoritative deadline so the clock survives refreshes.
  const launchQuestion = () => {
    const now = Date.now();
    setQuestionStartMs(now);
    setQuestionDeadlineMs(now + effectiveTimeLimit * 1000);
    setQuestionUIState(null);
    setGameMode('QUESTION');
  };

  return (
    <div className="app-container">
      <Scoreboard
        stage={getCurrentStage()}
        questionNumber={currentTurnIndex + 1}
        teamA={teamA}
        teamB={teamB}
        activeTeam={activeTeam}
        soundEnabled={soundEnabled}
        onToggleSound={toggleSound}
        onOpenMatchHistory={() => setIsHistoryModalOpen(true)}
        onResetGame={() => {
          clearGame();
          setGameMode('SETUP');
        }}
      />

      {/* Main Game Screen — Arena / Pre-Reveal State */}
      {gameMode === 'BOARD' && (
        <RopeVisualizer
          ropePosition={ropePosition}
          teamA={teamA}
          teamB={teamB}
          knockoutThreshold={questionsData.rules?.knockoutThreshold || 20}
          activeTeam={activeTeam}
          lastDelta={lastDelta}
        />
      )}

      {/* BOARD: Waiting for next turn to launch */}
      {gameMode === 'BOARD' && (
        <div className="board-launch-overlay">
          <div className="board-launch-card">
            <div className="active-turn-section">
              <div className="turn-identity">
                <div className="turn-label" style={{ color: activeTeam === 'A' ? 'var(--team-a-color)' : 'var(--team-b-color)' }}>
                  {activeTeamObj.name.toUpperCase()}'S TURN
                </div>
                <div className="turn-sub">
                  <span className="level-indicator-badge">
                    {stageRules.difficulty.toUpperCase()} | {stageRules.points} PTS | {stageRules.timeLimit}S
                  </span>
                </div>
              </div>

              <div className="active-team-powerups">
                {activeTeamObj.powerUps.challenge ? (
                  <span className="pu-available-badge" title="Can be used by the OPPONENT while your team is answering">
                    🟢 Challenge Available
                  </span>
                ) : (
                  <span className="pu-used-badge">❌ Challenge Used</span>
                )}

                {stageRules.difficulty !== 'easy' ? (
                  activeTeamObj.powerUps.timeBomb ? (
                    <span className="pu-available-badge" title="Can be used by the OPPONENT while your team is answering">
                      🟢 TimeBomb Available
                    </span>
                  ) : (
                    <span className="pu-used-badge">❌ TimeBomb Used</span>
                  )
                ) : (
                  <span className="level-restriction-badge">💣 TimeBomb (Med/Hard Only)</span>
                )}

                {activeTeamObj.powerUps.noEscape ? (
                  <span className="pu-available-badge">
                    🟡 NO ESCAPE (use after reveal)
                  </span>
                ) : (
                  <span className="pu-used-badge">❌ No Escape Used</span>
                )}
              </div>

              <button className="btn-launch-question" onClick={launchQuestion}>
                &gt; REVEAL QUESTION
              </button>
            </div>

            <div className="opponent-action-section">
              <div className="opponent-label" style={{ color: activeTeam === 'A' ? 'var(--team-b-color)' : 'var(--team-a-color)' }}>
                {opposingTeamObj.name} — Opponent Actions:
              </div>
              <div className="pre-question-powerups">
                {opposingTeamObj.powerUps.challenge ? (
                  <button
                    className="btn-opp-pu challenge"
                    onClick={() => handleChallengeActivate(opponentKey)}
                    title="Challenge: escalate the difficulty of the question about to be revealed."
                  >
                    <Swords size={14} /> ⚔️ CHALLENGE
                  </button>
                ) : (
                  <span className="opp-pu-used">⚔️ Challenge Used</span>
                )}
                {stageRules.difficulty !== 'easy' ? (
                  opposingTeamObj.powerUps.timeBomb ? (
                    <button
                      className="btn-opp-pu timebomb"
                      onClick={() => handleTimeBombActivate(opponentKey)}
                      title="TimeBomb: reduce the answering team's remaining time."
                    >
                      <Bomb size={14} /> 💣 TIMEBOMB
                    </button>
                  ) : (
                    <span className="opp-pu-used">💣 TimeBomb Used</span>
                  )
                ) : (
                  <span className="opp-pu-locked">💣 TimeBomb N/A (Med/Hard)</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* QUESTION MODAL */}
      {gameMode === 'QUESTION' && currentQ && (
        <div className="question-modal-overlay">
          <div className="question-modal-container">
            <QuestionCard
              question={currentQ}
              difficulty={displayDifficulty}
              timeLimit={effectiveTimeLimit}
              points={effectiveOriginalPoints}
              originalPoints={effectiveOriginalPoints}
              originalDifficulty={effectiveOriginalDifficulty}
              originalTimeLimit={effectiveOriginalTimeLimit}
              isChallenged={isChallengedNow}
              challengerTeamName={challengeActivatedBy ? (challengeActivatedBy === 'A' ? teamA.name : teamB.name) : ''}
              isTimeBombed={activePowerUp?.type === 'timeBomb'}
              timeBombOriginalTime={activePowerUp?.type === 'timeBomb' ? stageRules.timeLimit : 0}
              timeBombActivatorName={timeBombActivatedBy === 'A' ? teamA.name : timeBombActivatedBy === 'B' ? teamB.name : ''}
              activeTeamName={answeringTeamObj.name}
              opposingTeamName={actualOpposingTeamObj.name}

              // Opponent Challenge/TimeBomb are ONLY available BEFORE reveal (on
              // the board screen). They are never shown once the question opens.
              opponentActionsVisible={false}
              opponentHasChallenge={false}
              opponentHasTimeBomb={false}
              opponentKey={answeringTeamKey === 'A' ? 'B' : 'A'}
              canActivateChallenge={false}
              canActivateTimeBomb={false}
              onActivateChallenge={handleChallengeActivate}
              onActivateTimeBomb={handleTimeBombActivate}

              noEscapeAvailable={canUseNoEscape}
              onNoEscape={handleNoEscape}
              onSubmitAnswer={handleSubmitAnswer}

              deadline={questionDeadlineMs}
              startMs={questionStartMs}
              restoreState={questionUIState}
              onQuestionUIChange={setQuestionUIState}
              onTimerStart={(deadline) => setQuestionDeadlineMs(deadline)}
            />
          </div>
        </div>
      )}

      {/* NO ESCAPE MODAL */}
      {gameMode === 'NO_ESCAPE_QUESTION' && noEscapeData && (
        <div className="question-modal-overlay">
          <div className="question-modal-container">
            <QuestionCard
              question={noEscapeData.question}
              difficulty={noEscapeData.difficulty}
              timeLimit={noEscapeData.points === 1 ? 45 : noEscapeData.points === 2 ? 60 : 90}
              points={noEscapeData.points}
              originalPoints={noEscapeData.points}
              originalDifficulty={noEscapeData.originalDifficulty || noEscapeData.difficulty}
              originalTimeLimit={noEscapeData.points === 1 ? 45 : noEscapeData.points === 2 ? 60 : 90}
              isChallenged={false}
              isTimeBombed={false}
              activeTeamName={(noEscapeReceivingTeam ?? (noEscapeData.activatingTeam === 'A' ? 'B' : 'A')) === 'A' ? teamA.name : teamB.name}
              opposingTeamName={(noEscapeReceivingTeam ?? (noEscapeData.activatingTeam === 'A' ? 'B' : 'A')) === 'A' ? teamB.name : teamA.name}
              noEscapeAvailable={false}
              isNoEscapeTarget={true}
              noEscapeActivatorName={noEscapeActivatedBy === 'A' ? teamA.name : noEscapeActivatedBy === 'B' ? teamB.name : ''}
              opponentHasChallenge={false}
              opponentHasTimeBomb={false}
              canActivateChallenge={false}
              canActivateTimeBomb={false}
              revealLocked={noEscapeRevealSeconds > 0}
              revealSecondsLeft={noEscapeRevealSeconds}
              onSubmitAnswer={handleNoEscapeResult}
              deadline={questionDeadlineMs}
              startMs={questionStartMs}
              restoreState={questionUIState}
              onQuestionUIChange={setQuestionUIState}
              onTimerStart={(deadline) => setQuestionDeadlineMs(deadline)}
            />
          </div>
        </div>
      )}

      {gameMode === 'SETUP' && (
        <div className="start-screen-container">
          <div className="start-header">
            <h1>TUG OF WAR</h1>
            <p>Round 2 — Technical Quiz Championship</p>
          </div>


          <div className="team-setup-grid">
            <div className="setup-team-box">
              <h4 style={{ color: 'var(--team-a-color)' }}>TEAM A NAME</h4>
              <input
                type="text"
                className="input-team-name"
                value={teamA.name}
                onChange={(e) => setTeamA({ ...teamA, name: e.target.value })}
              />
            </div>
            <div className="setup-team-box">
              <h4 style={{ color: 'var(--team-b-color)' }}>TEAM B NAME</h4>
              <input
                type="text"
                className="input-team-name"
                value={teamB.name}
                onChange={(e) => setTeamB({ ...teamB, name: e.target.value })}
              />
            </div>
          </div>

          <button className="btn-start-game" onClick={handleStartGame}>
            <Play size={22} /> ENTER THE ARENA
          </button>
        </div>
      )}

      {gameMode === 'TIE_BREAKER_PREP' && (
        <div className="board-launch-overlay">
          <div className="board-launch-card" style={{ textAlign: 'center' }}>
            <Timer size={44} style={{ color: 'var(--accent-gold)' }} />
            <h2 style={{ color: 'var(--accent-gold)' }}>SUDDEN DEATH — Tie Breaker!</h2>
            <p>The score is tied. Each team gets 5 separate questions — fastest correct answers win!</p>
            <div className="tiebreaker-prep-countdown" style={{ fontSize: '4rem', fontWeight: 900, marginTop: '0.5rem', fontFamily: 'var(--font-mono)', color: 'var(--accent-gold)' }}>
              {tieBreakerPrepSeconds}
            </div>
          </div>
        </div>
      )}

      {gameMode === 'TIE_BREAKER' && (
        <TieBreaker
          tiebreakerQuestions={questionsData.questions.tiebreaker || []}
          teamA={teamA}
          teamB={teamB}
          onFinishTieBreaker={handleFinishTieBreaker}
          restoredState={tieBreakerState}
          onTieBreakerStateChange={setTieBreakerState}
          firstRoundStats={firstRoundStats}
          onLogRound={(round) => logMatchEvent({
            turnLabel: `SD${round.round}`,
            eventType: 'TIEBREAKER',
            difficulty: null,
            answeringTeamKey: round.team,
            answeringTeamName: round.teamName,
            initiatorName: null,
            questionText: round.questionText,
            chosenAnswerText: round.chosenAnswerText,
            correctAnswerText: round.correctAnswerText,
            isCorrect: round.isCorrect,
            pointsAwardedToName: null,
            pointsAwarded: 0,
            timeTaken: round.timeTaken,
            timeLimit: round.timeLimit
          })}
        />
      )}

      {gameMode === 'GAME_OVER' && winnerInfo && (
        <div className="gameover-overlay">
          <div className="gameover-card">
            <Trophy size={64} className="trophy-gold" />
            <span className="win-method-badge">VICTORY BY {winnerInfo.method}</span>
            <h1 className="winner-announce">{winnerInfo.name.toUpperCase()} WINS!</h1>
            <div className="final-stats-grid">
              <div className="final-stat-box">
                <span className="team-sub">{teamA.name}</span>
                <h2 style={{ color: 'var(--team-a-color)' }}>{teamA.score} pts</h2>
              </div>
              <div className="final-stat-box">
                <span className="team-sub">{teamB.name}</span>
                <h2 style={{ color: 'var(--team-b-color)' }}>{teamB.score} pts</h2>
              </div>
            </div>
            <div className="gameover-actions-row">
              <button className="btn-secondary" onClick={() => setIsHistoryModalOpen(true)}>
                <History size={14} /> Match History
              </button>
              <button className="btn-play-again" onClick={handleStartGame}>
                <RotateCcw size={18} /> PLAY AGAIN
              </button>
            </div>
          </div>
        </div>
      )}

      {isHistoryModalOpen && (
        <MatchHistoryModal
          matchHistory={matchHistory}
          teamA={teamA}
          teamB={teamB}
          onClose={() => setIsHistoryModalOpen(false)}
        />
      )}

      {isJsonModalOpen && (
        <JsonManagerModal
          currentQuestionsJson={questionsData}
          onSaveQuestions={(newJson) => setQuestionsData(newJson)}
          onClose={() => setIsJsonModalOpen(false)}
        />
      )}
    </div>
  );
}
