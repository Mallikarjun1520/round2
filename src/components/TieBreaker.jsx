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
  onLogRound,
  restoredState,
  onTieBreakerStateChange,
  firstRoundStats = { A: { correct: 0, totalMs: 0 }, B: { correct: 0, totalMs: 0 } }
}) {
  const [activeTeam, setActiveTeam] = useState(() => restoredState?.activeTeam ?? 'A');
  const [questionIndex, setQuestionIndex] = useState(() => restoredState?.questionIndex ?? 0);
  const [history, setHistory] = useState(() => restoredState?.history ?? []);
  const [winnerTeam, setWinnerTeam] = useState(() => restoredState?.winnerTeam ?? null);
  const [winReason, setWinReason] = useState(() => restoredState?.winReason ?? null);

  const [elapsedMs, setElapsedMs] = useState(0);
  const [selectedOption, setSelectedOption] = useState(() => restoredState?.selectedOption ?? null);
  const [isAnswerSubmitted, setIsAnswerSubmitted] = useState(() => restoredState?.isAnswerSubmitted ?? false);
  const [lastCorrect, setLastCorrect] = useState(() => restoredState?.lastCorrect ?? null);
  const [lastTimeMs, setLastTimeMs] = useState(() => restoredState?.lastTimeMs ?? 0);

  const [isPrepping, setIsPrepping] = useState(() => restoredState?.isPrepping ?? true);
  const [prepSecondsLeft, setPrepSecondsLeft] = useState(BETWEEN_QUESTIONS_PREP_SECONDS);
  // Absolute deadline for the 5s between-question prep, so a reload resumes it.
  const [prepDeadlineMs, setPrepDeadlineMs] = useState(() => {
    if (restoredState?.isPrepping) {
      return restoredState.prepDeadlineMs ?? Date.now() +
        (restoredState.prepSecondsLeft ?? BETWEEN_QUESTIONS_PREP_SECONDS) * 1000;
    }
    return Date.now() + BETWEEN_QUESTIONS_PREP_SECONDS * 1000;
  });
  // Absolute wall-clock start of the current tie-breaker question, so the 30s
  // clock survives a reload. Null until the live question actually begins.
  const [qStartMs, setQStartMs] = useState(() => {
    if (restoredState && !restoredState.isPrepping && !restoredState.isAnswerSubmitted && restoredState.qStartMs) {
      return restoredState.qStartMs;
    }
    return null;
  });
  const pendingAdvanceRef = useRef(restoredState?.pendingAdvance ?? null);
  // Skips the per-question reset on the first mount when a live (unsubmitted)
  // question was restored, keeping the restored selection/time base intact.
  const startedKeyRef = useRef(
    restoredState && !restoredState.isPrepping && !restoredState.isAnswerSubmitted
      ? `${restoredState.activeTeam}-${restoredState.questionIndex}`
      : null
  );

  const timerIntervalRef = useRef(null);
  const selectedOptionRef = useRef(selectedOption);
  // Single-resolution guard: after the question is resolved (manual submit or
  // timeout) no further submission is ever allowed, even if a stale timer tick
  // fires. Timeout with no selection resolves as a wrong answer.
  const isAnswerSubmittedRef = useRef(false);
  isAnswerSubmittedRef.current = isAnswerSubmitted;
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

  useEffect(() => {
    if (winnerTeam) {
      confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
      sounds.playVictory();
    }
  }, [winnerTeam]);

  useEffect(() => {
    if (!isPrepping) return;

    const completePrep = () => {
      const pending = pendingAdvanceRef.current;
      pendingAdvanceRef.current = null;
      setIsPrepping(false);
      if (pending) {
        setActiveTeam(pending.activeTeam);
        setQuestionIndex(pending.questionIndex);
        // The prep always transitions to a NEW question. Clearing the previous
        // team's submitted/selection state here lets the question-start effect
        // below treat it as a fresh start — otherwise the new question would
        // render as an already-answered result and its answer timer would
        // never begin.
        setIsAnswerSubmitted(false);
        isAnswerSubmittedRef.current = false;
        setLastCorrect(null);
        setSelectedOption(null);
        selectedOptionRef.current = null;
        // Drop the old question's clock base so the answer-timer effect cannot
        // pick up a stale start and instantly auto-submit the new question.
        setQStartMs(null);
        setElapsedMs(0);
      }
    };

    const update = () => {
      // Single authoritative transition timer: this interval advances the UI
      // AND completes the transition the moment the deadline is reached. It is
      // also what re-anchors/resumes a restored prep countdown — no refresh or
      // second timer is needed.
      if (prepDeadlineMs - Date.now() <= 0) {
        setPrepSecondsLeft(0);
        completePrep();
        return;
      }
      setPrepSecondsLeft(Math.max(0, Math.ceil((prepDeadlineMs - Date.now()) / 1000)));
    };
    update();
    const id = setInterval(update, 250);
    return () => clearInterval(id);
  }, [isPrepping, prepDeadlineMs]);

  useEffect(() => {
    if (winnerTeam || !currentQ || isPrepping || isAnswerSubmitted) return;

    // Only reset per-question UI when this is truly a new question (navigated
    // into), not on the initial mount when a live question was restored.
    const key = `${activeTeam}-${questionIndex}`;
    const isFreshStart = startedKeyRef.current !== key;
    startedKeyRef.current = key;

    if (isFreshStart) {
      setQStartMs(Date.now());
      setElapsedMs(0);
      setSelectedOption(null);
      selectedOptionRef.current = null;
      setIsAnswerSubmitted(false);
      isAnswerSubmittedRef.current = false;
      setLastCorrect(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionIndex, activeTeam, winnerTeam, isPrepping, isAnswerSubmitted, currentQ]);

  useEffect(() => {
    if (winnerTeam || !currentQ || isPrepping || isAnswerSubmitted || qStartMs == null) return;

    timerIntervalRef.current = setInterval(() => {
      const diff = Date.now() - qStartMs;
      setElapsedMs(diff);

      if (diff >= SUDDEN_DEATH_TIME_LIMIT * 1000) {
        clearInterval(timerIntervalRef.current);
        // Auto-submit whatever is currently selected on timeout. If nothing is
        // selected this resolves as a wrong (no-answer) result — exactly once.
        submitAnswer(selectedOptionRef.current);
      }
    }, 50);

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qStartMs, questionIndex, activeTeam, winnerTeam, isPrepping, isAnswerSubmitted]);

  const submitAnswer = (optionIdx) => {
    if (isAnswerSubmittedRef.current || winnerTeam) return;
    isAnswerSubmittedRef.current = true;
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

    const rawElapsed = Date.now() - (qStartMs || Date.now());
    const takenMs = Math.min(Math.max(0, rawElapsed), SUDDEN_DEATH_TIME_LIMIT * 1000);

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
    if (isAnswerSubmittedRef.current) return;
    selectedOptionRef.current = idx;
    setSelectedOption(idx);
  };

  const handleManualSubmit = () => {
    if (isAnswerSubmittedRef.current) return;
    if (selectedOptionRef.current === null) return;
    submitAnswer(selectedOptionRef.current);
  };

  const startPrepThenAdvance = (nextActiveTeam, nextQuestionIndex) => {
    pendingAdvanceRef.current = {
      activeTeam: nextActiveTeam,
      questionIndex: nextQuestionIndex
    };
    setPrepSecondsLeft(BETWEEN_QUESTIONS_PREP_SECONDS);
    setPrepDeadlineMs(Date.now() + BETWEEN_QUESTIONS_PREP_SECONDS * 1000);
    setIsPrepping(true);
  };

  // Report persistent state to the parent so a reload resumes the exact tie
  // breaker. Absolute deadlines (prepDeadlineMs, qStartMs) travel with it;
  // per-tick values (prepSecondsLeft, elapsedMs) are deliberately excluded.
  useEffect(() => {
    if (!onTieBreakerStateChange) return;
    onTieBreakerStateChange({
      activeTeam,
      questionIndex,
      history,
      winnerTeam,
      winReason,
      isPrepping,
      prepDeadlineMs,
      isAnswerSubmitted,
      selectedOption,
      lastCorrect,
      lastTimeMs,
      qStartMs,
      pendingAdvance: pendingAdvanceRef.current
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTeam, questionIndex, history, winnerTeam, winReason, isPrepping, prepDeadlineMs, isAnswerSubmitted, selectedOption, lastCorrect, lastTimeMs, qStartMs]);

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
      // Special case: BOTH teams got ALL their tie-breaker questions wrong, so
      // fall back to the original 18 main-game questions — correct-answer
      // count first, then total correct-answer selection time (lower wins).
      const firstACorrect = firstRoundStats?.A?.correct ?? 0;
      const firstBCorrect = firstRoundStats?.B?.correct ?? 0;
      const firstATime = firstRoundStats?.A?.totalMs ?? 0;
      const firstBTime = firstRoundStats?.B?.totalMs ?? 0;

      if (firstACorrect > firstBCorrect) {
        setWinnerTeam('A');
        setWinReason('FIRST_ROUND_MORE_CORRECT');
      } else if (firstBCorrect > firstACorrect) {
        setWinnerTeam('B');
        setWinReason('FIRST_ROUND_MORE_CORRECT');
      } else if (firstATime < firstBTime) {
        setWinnerTeam('A');
        setWinReason('FIRST_ROUND_FASTER_TIME');
      } else if (firstBTime < firstATime) {
        setWinnerTeam('B');
        setWinReason('FIRST_ROUND_FASTER_TIME');
      } else {
        // Both teams also have zero/first-round equal stats — keep the
        // original final-tie behavior.
        setWinnerTeam('TIE');
        setWinReason('DEAD_TIE');
      }
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
    // Alternating team-by-team: after the current team answers, hand the same
    // question to the OTHER team first, then advance the question number and
    // start again with the first team. Order: A1, B1, A2, B2, ..., A5, B5.
    if (activeTeam === 'A') {
      startPrepThenAdvance('B', questionIndex);
      return;
    }

    if (questionIndex < QUESTIONS_PER_TEAM - 1) {
      startPrepThenAdvance('A', questionIndex + 1);
      return;
    }

    // Both teams have answered their 5th question — history is already
    // up to date (this runs after the final submission), so no manual append.
    decideWinner(history);
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
    // When the winner was decided by the FIRST-18-question fallback (both teams
    // got every tie-breaker question wrong), the tie-breaker stats (0/5, 0.00s)
    // are meaningless — hide the comparison cards entirely in that case.
    const isFirst18Decision =
      winReason === 'FIRST_ROUND_MORE_CORRECT' || winReason === 'FIRST_ROUND_FASTER_TIME';

    return (
      <div className="tiebreaker-results-card">
        <Trophy className="trophy-gold" size={64} />
        <h2>TIE BREAKER CHAMPION!</h2>
        <h1 className="winner-title">{winnerObj.name}</h1>
        <p className="tb-elimination-summary">
          {winReason === 'MORE_CORRECT'
            ? `${winnerObj.name} answered more questions correctly!`
            : winReason === 'FIRST_ROUND_MORE_CORRECT'
            ? `Both teams missed every tie-breaker question — ${winnerObj.name} had more correct answers in the opening 18 questions!`
            : winReason === 'FIRST_ROUND_FASTER_TIME'
            ? `Both teams missed every tie-breaker question — ${winnerObj.name} had the faster total time on correct answers in the opening 18 questions!`
            : `Both teams matched — ${winnerObj.name} wins with the faster total time!`}
        </p>

        {!isFirst18Decision && (
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
        )}

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
            ? `Question ${questionIndex + 1} of ${QUESTIONS_PER_TEAM} — ${teamB.name} answers next.`
            : questionIndex < QUESTIONS_PER_TEAM - 1
            ? `Question ${questionIndex + 1} of ${QUESTIONS_PER_TEAM} — ${teamA.name} answers next.`
            : 'Final question — winner decided after this round.'}
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
              {activeTeam === 'A'
                ? ` — Now ${teamB.name}'s turn: Question ${questionIndex + 1}.`
                : questionIndex < QUESTIONS_PER_TEAM - 1
                ? ` — Now ${teamA.name}'s turn: Question ${questionIndex + 2}.`
                : ` — All questions complete. Deciding winner...`}
            </div>
            <button className="btn-next-tb" onClick={handleContinue}>
              {activeTeam === 'A'
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
