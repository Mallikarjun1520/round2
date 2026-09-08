import React, { useState, useEffect, useRef } from 'react';
import { Zap, Timer, ArrowRight, Trophy, CheckCircle2, XCircle, Gauge, Lightbulb } from 'lucide-react';
import { sounds } from '../utils/soundEffects';
import confetti from 'canvas-confetti';

const SUDDEN_DEATH_TIME_LIMIT = 30;
const BETWEEN_QUESTIONS_PREP_SECONDS = 5;
const QUESTIONS_PER_TEAM = 5;

export default function TieBreaker({
  tiebreakerQuestions,
  teamA,
  teamB,
  onFinishTieBreaker,
  onLogRound
}) {
  const [activeTeam, setActiveTeam] = useState('A');
  const [questionIndex, setQuestionIndex] = useState(0);
  const [history, setHistory] = useState([]);
  const [winnerTeam, setWinnerTeam] = useState(null);
  const [winReason, setWinReason] = useState(null);

  const [elapsedMs, setElapsedMs] = useState(0);
  const [selectedOption, setSelectedOption] = useState(null);
  const [isAnswerSubmitted, setIsAnswerSubmitted] = useState(false);
  const [lastCorrect, setLastCorrect] = useState(null);
  const [lastTimeMs, setLastTimeMs] = useState(0);

  const [isPrepping, setIsPrepping] = useState(true);
  const [prepSecondsLeft, setPrepSecondsLeft] = useState(BETWEEN_QUESTIONS_PREP_SECONDS);
  const pendingAdvanceRef = useRef(null);

  const timerIntervalRef = useRef(null);
  const selectedOptionRef = useRef(selectedOption);
  const qStartRef = useRef(Date.now());
  selectedOptionRef.current = selectedOption;

  const teamAQuestions = tiebreakerQuestions?.teamA || [];
  const teamBQuestions = tiebreakerQuestions?.teamB || [];
  const activePool = activeTeam === 'A' ? teamAQuestions : teamBQuestions;
  const currentQ = questionIndex < activePool.length ? activePool[questionIndex] : null;
  const showHint = currentQ?.hint && questionIndex === QUESTIONS_PER_TEAM - 1;

  const activeTeamObj = activeTeam === 'A' ? teamA : teamB;
  const otherTeamObj = activeTeam === 'A' ? teamB : teamA;

  const getTeamTotalTime = (teamKey) =>
    history
      .filter((h) => h.team === teamKey && h.isCorrect)
      .reduce((sum, h) => sum + h.timeMs, 0);

  const getTeamCorrectCount = (teamKey) =>
    history.filter((h) => h.team === teamKey && h.isCorrect).length;

  const totalAnswered = history.length;
  const isTeamADone = history.filter(h => h.team === 'A').length >= QUESTIONS_PER_TEAM;
  const isTeamBDone = history.filter(h => h.team === 'B').length >= QUESTIONS_PER_TEAM;

  useEffect(() => {
    if (winnerTeam) {
      confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
      sounds.playVictory();
    }
  }, [winnerTeam]);

  useEffect(() => {
    if (!isPrepping) return;
    if (prepSecondsLeft <= 0) {
      const pending = pendingAdvanceRef.current;
      pendingAdvanceRef.current = null;
      setIsPrepping(false);
      if (pending) {
        setActiveTeam(pending.activeTeam);
        setQuestionIndex(pending.questionIndex);
      }
      return;
    }
    const id = setTimeout(() => setPrepSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [isPrepping, prepSecondsLeft]);

  useEffect(() => {
    if (winnerTeam || !currentQ || isPrepping) return;

    const startTime = Date.now();
    qStartRef.current = startTime;
    setElapsedMs(0);
    setSelectedOption(null);
    setIsAnswerSubmitted(false);
    setLastCorrect(null);

    timerIntervalRef.current = setInterval(() => {
      const diff = Date.now() - qStartRef.current;
      setElapsedMs(diff);

      if (diff >= SUDDEN_DEATH_TIME_LIMIT * 1000) {
        clearInterval(timerIntervalRef.current);
        submitAnswer(selectedOptionRef.current);
      }
    }, 50);

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionIndex, activeTeam, winnerTeam, isPrepping]);

  const submitAnswer = (optionIdx) => {
    if (isAnswerSubmitted || winnerTeam) return;
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

    const rawElapsed = Date.now() - qStartRef.current;
    const takenMs = Math.min(rawElapsed, SUDDEN_DEATH_TIME_LIMIT * 1000);

    setIsAnswerSubmitted(true);
    setSelectedOption(optionIdx);
    setLastTimeMs(takenMs);

    const isCorrect = optionIdx !== null && optionIdx === currentQ.correctIndex;
    setLastCorrect(isCorrect);
    setHistory((prev) => [...prev, { team: activeTeam, isCorrect, timeMs: takenMs, questionIdx: questionIndex }]);

    if (isCorrect) {
      sounds.playCorrect();
    } else {
      sounds.playWrong();
    }

    if (onLogRound) {
      onLogRound({
        round: questionIndex + 1,
        team: activeTeam,
        teamName: activeTeamObj.name,
        questionText: currentQ.question,
        chosenAnswerText: optionIdx !== null ? currentQ.options[optionIdx] : null,
        correctAnswerText: currentQ.options[currentQ.correctIndex],
        isCorrect,
        timeTaken: takenMs / 1000,
        timeLimit: SUDDEN_DEATH_TIME_LIMIT
      });
    }
  };

  const handleSelect = (idx) => {
    if (isAnswerSubmitted) return;
    setSelectedOption(idx);
  };

  const handleManualSubmit = () => {
    if (isAnswerSubmitted) return;
    if (selectedOption === null) return;
    submitAnswer(selectedOption);
  };

  const startPrepThenAdvance = (nextActiveTeam, nextQuestionIndex) => {
    pendingAdvanceRef.current = {
      activeTeam: nextActiveTeam,
      questionIndex: nextQuestionIndex
    };
    setPrepSecondsLeft(BETWEEN_QUESTIONS_PREP_SECONDS);
    setIsPrepping(true);
  };

  const decideWinner = (updatedHistory) => {
    const teamACorrect = updatedHistory.filter(h => h.team === 'A' && h.isCorrect).length;
    const teamBCorrect = updatedHistory.filter(h => h.team === 'B' && h.isCorrect).length;
    const aTime = updatedHistory.filter(h => h.team === 'A' && h.isCorrect).reduce((s, h) => s + h.timeMs, 0);
    const bTime = updatedHistory.filter(h => h.team === 'B' && h.isCorrect).reduce((s, h) => s + h.timeMs, 0);

    if (teamACorrect > teamBCorrect) {
      setWinnerTeam('A');
      setWinReason('MORE_CORRECT');
    } else if (teamBCorrect > teamACorrect) {
      setWinnerTeam('B');
      setWinReason('MORE_CORRECT');
    } else if (teamACorrect === 0 && teamBCorrect === 0) {
      setWinnerTeam('TIE');
      setWinReason('DEAD_TIE');
    } else if (aTime < bTime) {
      setWinnerTeam('A');
      setWinReason('FASTER_TIME');
    } else if (bTime < aTime) {
      setWinnerTeam('B');
      setWinReason('FASTER_TIME');
    } else {
      setWinnerTeam('TIE');
      setWinReason('DEAD_TIE');
    }
  };

  const handleContinue = () => {
    if (activeTeam === 'A') {
      if (questionIndex < QUESTIONS_PER_TEAM - 1) {
        startPrepThenAdvance('A', questionIndex + 1);
      } else {
        startPrepThenAdvance('B', 0);
      }
      return;
    }

    if (questionIndex < QUESTIONS_PER_TEAM - 1) {
      startPrepThenAdvance('B', questionIndex + 1);
      return;
    }

    const updatedHistory = [...history, { team: 'B', isCorrect: lastCorrect, timeMs: lastTimeMs, questionIdx: questionIndex }];
    decideWinner(updatedHistory);
  };

  const formatMs = (ms) => `${(ms / 1000).toFixed(2)}s`;
  const timePercent = Math.max(0, 100 - (elapsedMs / (SUDDEN_DEATH_TIME_LIMIT * 1000)) * 100);

  const getDifficultyLabel = (idx) => {
    const labels = ['HARD', 'MEDIUM-HARD', 'MEDIUM', 'EASY-MEDIUM', 'EASY'];
    return labels[idx] || `Q${idx + 1}`;
  };

  if (winnerTeam) {
    if (winReason === 'DEAD_TIE') {
      return (
        <div className="tiebreaker-results-card">
          <Trophy className="trophy-gold" size={64} />
          <h2>IT'S A TIE!</h2>
          <p className="tb-elimination-summary">
            Both teams matched — no winner could be determined.
          </p>
          <button className="btn-finish-all" onClick={() => onFinishTieBreaker('TIE GAME!')}>
            COMPLETE ROUND 2 <ArrowRight size={20} />
          </button>
        </div>
      );
    }

    const winnerObj = winnerTeam === 'A' ? teamA : teamB;

    return (
      <div className="tiebreaker-results-card">
        <Trophy className="trophy-gold" size={64} />
        <h2>TIE BREAKER CHAMPION!</h2>
        <h1 className="winner-title">{winnerObj.name}</h1>
        <p className="tb-elimination-summary">
          {winReason === 'MORE_CORRECT'
            ? `${winnerObj.name} answered more questions correctly!`
            : `Both teams matched — ${winnerObj.name} wins with the faster total time!`}
        </p>

        <div className="tiebreaker-comparison-grid">
          <div className={`team-res-card ${winnerTeam === 'A' ? 'winner-card' : ''}`}>
            <h3>{teamA.name}</h3>
            <div className="res-stat">
              <span>Correct Answers:</span>
              <strong>{getTeamCorrectCount('A')} / {QUESTIONS_PER_TEAM}</strong>
            </div>
            <div className="res-stat">
              <span>Total Time (correct only):</span>
              <strong>{formatMs(getTeamTotalTime('A'))}</strong>
            </div>
          </div>
          <div className={`team-res-card ${winnerTeam === 'B' ? 'winner-card' : ''}`}>
            <h3>{teamB.name}</h3>
            <div className="res-stat">
              <span>Correct Answers:</span>
              <strong>{getTeamCorrectCount('B')} / {QUESTIONS_PER_TEAM}</strong>
            </div>
            <div className="res-stat">
              <span>Total Time (correct only):</span>
              <strong>{formatMs(getTeamTotalTime('B'))}</strong>
            </div>
          </div>
        </div>

        <button className="btn-finish-all" onClick={() => onFinishTieBreaker(winnerObj.name)}>
          COMPLETE ROUND 2 <ArrowRight size={20} />
        </button>
      </div>
    );
  }

  if (!currentQ) {
    return (
      <div className="tiebreaker-container">
        <p>No tie-breaker questions available.</p>
      </div>
    );
  }

  if (isPrepping) {
    const upcomingTeamObj = pendingAdvanceRef.current
      ? (pendingAdvanceRef.current.activeTeam === 'B' ? teamB : teamA)
      : (activeTeam === 'A' ? teamA : teamB);

    return (
      <div className="tiebreaker-container">
        <div className="tiebreaker-banner">
          <Zap className="bolt-icon" size={28} />
          <div>
            <h2>TIE BREAKER</h2>
            <p>
              Each team answers 5 separate questions. The team with more correct answers wins.
              If tied, fastest total time (correct answers only) decides!
            </p>
          </div>
        </div>

        <div className="board-launch-card" style={{ textAlign: 'center' }}>
          <Timer size={48} />
          <h2>Get Ready — {upcomingTeamObj.name}!</h2>
          <p>Next tie-breaker question in:</p>
          <div className="tiebreaker-prep-countdown" style={{ fontSize: '4rem', fontWeight: 800, marginTop: '1rem' }}>
            {prepSecondsLeft}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="tiebreaker-container">
      <div className="tiebreaker-banner">
        <Zap className="bolt-icon" size={28} />
        <div>
          <h2>TIE BREAKER</h2>
          <p>
            Each team answers 5 separate questions. The team with more correct answers wins.
            If tied, fastest total time (correct answers only) decides!
          </p>
        </div>
      </div>

      {history.length > 0 && (
        <div className="tb-history-track">
          {history.map((h, i) => (
            <span
              key={i}
              className={`tb-history-chip ${h.team === 'A' ? 'color-a' : 'color-b'} ${h.isCorrect ? 'tb-chip-correct' : 'tb-chip-wrong'}`}
              title={`${h.team === 'A' ? teamA.name : teamB.name} Q${h.questionIdx + 1}: ${h.isCorrect ? 'Correct' : 'Wrong'} (${formatMs(h.timeMs)})`}
            >
              {h.isCorrect ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
            </span>
          ))}
        </div>
      )}

      <div className="tb-time-tally">
        <span className="tb-time-chip color-a">
          <Gauge size={14} /> {teamA.name}: {getTeamCorrectCount('A')} / {QUESTIONS_PER_TEAM} ({formatMs(getTeamTotalTime('A'))})
        </span>
        <span className="tb-time-chip color-b">
          <Gauge size={14} /> {teamB.name}: {getTeamCorrectCount('B')} / {QUESTIONS_PER_TEAM} ({formatMs(getTeamTotalTime('B'))})
        </span>
      </div>

      <div className={`tb-active-team-banner ${activeTeam === 'A' ? 'color-a' : 'color-b'}`}>
        <span className="tb-active-team-label">
          {activeTeam === 'A' ? teamA.name : teamB.name} — Question {questionIndex + 1} of {QUESTIONS_PER_TEAM} ({getDifficultyLabel(questionIndex)})
        </span>
        <h3>{activeTeamObj.name}'S TURN</h3>
        <span className="tb-active-team-sub">
          {activeTeam === 'A'
            ? isTeamADone
              ? 'All questions complete!'
              : `${teamB.name} has not started yet.`
            : isTeamBDone
            ? 'All questions complete — deciding winner...'
            : `${teamA.name} has completed their questions.`}
        </span>
      </div>

      <div className="tiebreaker-status-bar">
        <div className="active-team-indicator">
          Playing Now: <strong>{activeTeamObj.name}</strong>
        </div>
        <div className="speed-timer-pill">
          <Timer size={18} />
          <span>Time: {formatMs(elapsedMs)} / {SUDDEN_DEATH_TIME_LIMIT}s</span>
        </div>
      </div>

      <div className="tb-timer-bar-track">
        <div className="tb-timer-bar-fill" style={{ width: `${timePercent}%` }}></div>
      </div>

      {showHint && currentQ.hint && (
        <div className="tb-hint-banner">
          <Lightbulb size={22} />
          <div>
            <strong>HINT:</strong> {currentQ.hint}
          </div>
        </div>
      )}

      <div className="tiebreaker-q-card">
        <h3 className="tb-question-text">{currentQ.question}</h3>

        <div className="options-grid">
          {currentQ.options.map((opt, idx) => {
            let stateClass = '';
            if (isAnswerSubmitted) {
              if (idx === currentQ.correctIndex) stateClass = 'option-correct';
              else if (idx === selectedOption) stateClass = 'option-wrong';
              else stateClass = 'option-disabled';
            } else if (idx === selectedOption) {
              stateClass = 'option-selected';
            }

            return (
              <button
                key={idx}
                className={`option-card ${stateClass}`}
                disabled={isAnswerSubmitted}
                onClick={() => handleSelect(idx)}
              >
                <span className="option-key">{String.fromCharCode(65 + idx)}</span>
                <span className="option-text">{opt}</span>
              </button>
            );
          })}
        </div>

        {!isAnswerSubmitted && (
          <div className="tb-next-footer">
            <span className="key-hint">Select an option, then click SUBMIT. Auto-submit on time-out.</span>
            <button
              className="btn-submit-answer"
              onClick={handleManualSubmit}
              disabled={selectedOption === null}
            >
              SUBMIT ANSWER
            </button>
          </div>
        )}

        {isAnswerSubmitted && (
          <div className="tb-next-footer">
            <div className={`tb-result-banner ${lastCorrect ? 'tb-result-correct' : 'tb-result-wrong'}`}>
              {lastCorrect
                ? `Correct in ${formatMs(lastTimeMs)}!`
                : 'Incorrect!'}
              {activeTeam === 'A' && questionIndex < QUESTIONS_PER_TEAM - 1
                ? ` — Next question for ${teamA.name} coming up.`
                : activeTeam === 'A'
                ? ` — ${teamA.name} complete! ${teamB.name}'s turn next.`
                : questionIndex < QUESTIONS_PER_TEAM - 1
                ? ` — Next question for ${teamB.name} coming up.`
                : ` — All questions complete. Deciding winner...`}
            </div>
            <button className="btn-next-tb" onClick={handleContinue}>
              {activeTeam === 'A' && questionIndex < QUESTIONS_PER_TEAM - 1
                ? `QUESTION ${questionIndex + 2}`
                : activeTeam === 'A'
                ? `${teamB.name}'S TURN`
                : questionIndex < QUESTIONS_PER_TEAM - 1
                ? `QUESTION ${questionIndex + 2}`
                : 'SEE FINAL RESULT'} <ArrowRight size={18} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
