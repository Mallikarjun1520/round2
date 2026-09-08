import React, { useState, useEffect, useCallback } from 'react';
import RopeVisualizer from './components/RopeVisualizer';
import Scoreboard from './components/Scoreboard';
import QuestionCard from './components/QuestionCard';
import TieBreaker from './components/TieBreaker';
import JsonManagerModal from './components/JsonManagerModal';
import MatchHistoryModal from './components/MatchHistoryModal';
import { sounds } from './utils/soundEffects';
import confetti from 'canvas-confetti';
import { Trophy, Zap, Play, RotateCcw, Settings, Award, History, Timer } from 'lucide-react';

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
  const [noEscapeRevealSeconds, setNoEscapeRevealSeconds] = useState(15);

  // Original question state (preserved across powerup activations)
  const [originalQuestionDifficulty, setOriginalQuestionDifficulty] = useState(null);
  const [originalQuestionPoints, setOriginalQuestionPoints] = useState(null);
  const [originalQuestionTimeLimit, setOriginalQuestionTimeLimit] = useState(null);
  const [currentQuestionDifficulty, setCurrentQuestionDifficulty] = useState(null);

  // TimeBomb mid-question state
  const [timeBombActive, setTimeBombActive] = useState(false);

  useEffect(() => {
    if (gameMode !== 'TIE_BREAKER_PREP') return;
    if (tieBreakerPrepSeconds <= 0) {
      setGameMode('TIE_BREAKER');
      return;
    }
    const id = setTimeout(() => setTieBreakerPrepSeconds((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [gameMode, tieBreakerPrepSeconds]);

  // No Escape 15-second window before the question opens to the other team
  useEffect(() => {
    if (gameMode !== 'NO_ESCAPE_QUESTION') return;
    if (noEscapeRevealSeconds <= 0) return;
    const id = setTimeout(() => setNoEscapeRevealSeconds((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [gameMode, noEscapeRevealSeconds]);

  // Load questions on mount
  useEffect(() => {
    fetch('/questions.json')
      .then((res) => res.json())
      .then((data) => setQuestionsData(data))
      .catch((err) => console.error('Error loading default questions.json:', err));
  }, []);

  const handleStartGame = () => {
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
    setNoEscapeRevealSeconds(15);
    setOriginalQuestionDifficulty(null);
    setOriginalQuestionPoints(null);
    setOriginalQuestionTimeLimit(null);
    setCurrentQuestionDifficulty(null);
    setTimeBombActive(false);
    setGameMode('BOARD');
    sounds.init();
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

  // === CHALLENGE ACTIVATION (opposing team activates during question) ===
  const handleChallengeActivate = useCallback((challengerTeam) => {
    if (activePowerUp) return;
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
  }, [activePowerUp, currentTurnIndex, questionsData]);

  // === TIMEBOMB ACTIVATION (opposing team activates during question) ===
  const handleTimeBombActivate = useCallback((bombTeam) => {
    if (activePowerUp) return;
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
  }, [activePowerUp, currentTurnIndex]);

  // === NO ESCAPE HANDLER ===
  const handleNoEscape = useCallback(() => {
    if (activePowerUp?.type === 'challenge') return;

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

    setNoEscapeRevealSeconds(15);
    setGameMode('NO_ESCAPE_QUESTION');
  }, [activeTeam, activePowerUp, currentTurnIndex, questionsData, originalQuestionPoints, originalQuestionDifficulty]);

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
    const pts = stageRules.points;
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
    setGameMode('BOARD');
  };

  const triggerGameOver = (winnerName, method) => {
    setWinnerInfo({ name: winnerName, method });
    setGameMode('GAME_OVER');
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
          <h2>Loading Code Clash...</h2>
        </div>
      </div>
    );
  }

  const currentQ = activePowerUp?.type === 'challenge' && challengeQuestion
    ? challengeQuestion
    : getCurrentQuestion();
  const stageRules = getStageRules();
  const opposingTeamObj = activeTeam === 'A' ? teamB : teamA;
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
    const escalatedTimeLimits = { easy: 45, medium: 60, hard: 90, very_hard: 120 };
    effectiveTimeLimit = escalatedTimeLimits[effectiveCurrentDifficulty] || 90;
  }

  const displayDifficulty = effectiveCurrentDifficulty;

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
        onOpenJsonManager={() => setIsJsonModalOpen(true)}
        onOpenMatchHistory={() => setIsHistoryModalOpen(true)}
        onResetGame={() => setGameMode('SETUP')}
      />

      {/* Main Game Screen */}
      {gameMode !== 'SETUP' && (
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
                  {activeTeamObj.name}'s Turn
                </div>
                <div className="turn-sub">
                  <span className={`level-indicator-badge badge-${stageRules.difficulty}`}>
                    {stageRules.difficulty.toUpperCase()} LEVEL • {stageRules.points} PTS
                  </span>
                </div>
              </div>
              
              <div className="active-team-powerups">
                {activeTeamObj.powerUps.challenge ? (
                  <span className="pu-available-badge no-escape-preview" title="Can be used by the OPPONENT while your team is answering">
                    ⚔️ Challenge Available
                  </span>
                ) : (
                  <span className="pu-used-badge">⚔️ Challenge Used</span>
                )}

                {stageRules.difficulty !== 'easy' ? (
                  activeTeamObj.powerUps.timeBomb ? (
                    <span className="pu-available-badge no-escape-preview" title="Can be used by the OPPONENT while your team is answering">
                      💣 TimeBomb Available
                    </span>
                  ) : (
                    <span className="pu-used-badge">💣 TimeBomb Used</span>
                  )
                ) : (
                  <span className="level-restriction-badge">💣 TimeBomb (Med/Hard Only)</span>
                )}

                {activeTeamObj.powerUps.noEscape ? (
                  <span className="pu-available-badge no-escape-preview">
                    🚫 NO ESCAPE (use after reveal)
                  </span>
                ) : (
                  <span className="pu-used-badge">🚫 No Escape Used</span>
                )}
              </div>

              <button className="btn-launch-question" onClick={() => setGameMode('QUESTION')}>
                <Play size={20} /> REVEAL QUESTION
              </button>
            </div>

            <div className="opponent-action-section">
              <div className="opponent-label" style={{ color: activeTeam === 'A' ? 'var(--team-b-color)' : 'var(--team-a-color)' }}>
                {opposingTeamObj.name} (Opponent) Actions:
              </div>
              <div className="pre-question-powerups">
                {opposingTeamObj.powerUps.challenge ? (
                  <span className="opp-pu-available" title="Challenge: activates while the question is live">
                    ⚔️ Challenge Ready
                  </span>
                ) : (
                  <span className="opp-pu-used">⚔️ Challenge Used</span>
                )}
                {stageRules.difficulty !== 'easy' ? (
                  opposingTeamObj.powerUps.timeBomb ? (
                    <span className="opp-pu-available" title="TimeBomb: activates while the question is live">
                      💣 TimeBomb Ready
                    </span>
                  ) : (
                    <span className="opp-pu-used">💣 TimeBomb Used</span>
                  )
                ) : (
                  <span className="opp-pu-locked">💣 TimeBomb N/A (Med/Hard)</span>
                )}
                {opposingTeamObj.powerUps.noEscape ? (
                  <span className="opp-pu-available">🚫 No Escape Ready</span>
                ) : (
                  <span className="opp-pu-used">🚫 No Escape Used</span>
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
              challengerTeamName={isChallengedNow ? (activePowerUp.by === 'A' ? teamA.name : teamB.name) : ''}
              isTimeBombed={activePowerUp?.type === 'timeBomb'}
              timeBombApply={timeBombActive}
              timeBombReduction={activePowerUp?.type === 'timeBomb' ? getTimeBombReduction(stageRules.difficulty) : 0}
              timeBombActivatorName={activePowerUp?.type === 'timeBomb' ? (activePowerUp.by === 'A' ? teamA.name : teamB.name) : ''}
              activeTeamName={answeringTeamObj.name}
              opposingTeamName={actualOpposingTeamObj.name}

              // Opponent can activate Challenge/TimeBomb in-question if they still own them
              opponentHasChallenge={actualOpposingTeamObj.powerUps.challenge}
              opponentHasTimeBomb={actualOpposingTeamObj.powerUps.timeBomb}
              opponentKey={answeringTeamKey === 'A' ? 'B' : 'A'}
              canActivateChallenge={!isChallengedNow && !timeBombActive && actualOpposingTeamObj.powerUps.challenge}
              canActivateTimeBomb={!isChallengedNow && !timeBombActive && actualOpposingTeamObj.powerUps.timeBomb && stageRules.difficulty !== 'easy'}
              onActivateChallenge={handleChallengeActivate}
              onActivateTimeBomb={handleTimeBombActivate}

              noEscapeAvailable={canUseNoEscape}
              onNoEscape={handleNoEscape}
              onSubmitAnswer={handleSubmitAnswer}
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
              timeBombApply={false}
              timeBombReduction={0}
              activeTeamName={noEscapeData.activatingTeam === 'A' ? teamB.name : teamA.name}
              opposingTeamName={noEscapeData.activatingTeam === 'A' ? teamA.name : teamB.name}
              noEscapeAvailable={false}
              isNoEscapeTarget={true}
              noEscapeActivatorName={noEscapeData.activatingTeam === 'A' ? teamA.name : teamB.name}
              opponentHasChallenge={false}
              opponentHasTimeBomb={false}
              canActivateChallenge={false}
              canActivateTimeBomb={false}
              revealLocked={noEscapeRevealSeconds > 0}
              revealSecondsLeft={noEscapeRevealSeconds}
              onSubmitAnswer={handleNoEscapeResult}
            />
          </div>
        </div>
      )}

      {gameMode === 'SETUP' && (
        <div className="start-screen-container">
          <div className="start-header">
            <h1>CODE CLASH</h1>
            <p>Tug of War Edition — Round 2</p>
          </div>

          <div className="rules-summary-card">
            <h3>⚡ OFFICIAL RULES</h3>
            <ul className="rules-list">
              <li><strong>Easy Phase (Q1-12):</strong> 45s timer | 1 Point</li>
              <li><strong>Medium Phase (Q13-24):</strong> 60s timer | 2 Points</li>
              <li><strong>Hard Phase (Q25-36):</strong> 90s timer | 3 Points</li>
              <li><strong>⚔️ Challenge:</strong> OPPONENT can escalate the live question (Easy→Medium→Hard→Very Hard) — timer updates, but <strong>points stay the same.</strong> Wrong answer = <strong>2× original points!</strong></li>
              <li><strong>💣 TimeBomb (Med/Hard Only):</strong> OPPONENT cuts the answering team's remaining time (-25s Medium / -30s Hard). Rope is unaffected.</li>
              <li><strong>🚫 No Escape:</strong> Answering team passes the live question to the opponent. 15s transfer, then the receiving team answers without bonus time.</li>
              <li><strong>Knockout Win:</strong> Pull the pointer past 26 points!</li>
            </ul>
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
            <Play size={24} /> ENTER THE CLASH
          </button>
        </div>
      )}

      {gameMode === 'TIE_BREAKER_PREP' && (
        <div className="board-launch-overlay">
          <div className="board-launch-card" style={{ textAlign: 'center' }}>
            <Timer size={48} />
            <h2>Get Ready — Tie Breaker!</h2>
            <p>The score is tied. Each team gets 5 separate questions — fastest correct answers win!</p>
            <div className="tiebreaker-prep-countdown" style={{ fontSize: '4rem', fontWeight: 800, marginTop: '1rem' }}>
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
            <Trophy size={72} className="trophy-gold" />
            <span className="win-method-badge">VICTORY BY {winnerInfo.method}</span>
            <h1 className="winner-announce">{winnerInfo.name.toUpperCase()} WINS!</h1>
            <div className="final-stats-grid">
              <div className="final-stat-box">
                <span className="team-sub">{teamA.name} Score</span>
                <h2>{teamA.score} pts</h2>
              </div>
              <div className="final-stat-box">
                <span className="team-sub">{teamB.name} Score</span>
                <h2>{teamB.score} pts</h2>
              </div>
            </div>
            <div className="gameover-actions-row">
              <button className="btn-secondary" onClick={() => setIsHistoryModalOpen(true)}>
                <History size={16} /> View Match History
              </button>
              <button className="btn-play-again" onClick={handleStartGame}>
                <RotateCcw size={20} /> PLAY AGAIN
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
