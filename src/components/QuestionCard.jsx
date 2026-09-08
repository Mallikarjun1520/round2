import React, { useState, useEffect, useRef } from 'react';
import { Clock, ShieldAlert, CheckCircle, XCircle, ArrowRight, Bomb, ShieldOff, Swords } from 'lucide-react';
import { sounds } from '../utils/soundEffects';

export default function QuestionCard({
  question,
  difficulty, // 'easy' | 'medium' | 'hard' | 'very_hard' (current display difficulty)
  timeLimit, // effective full time for this question state
  points = 1, // ORIGINAL point value (never changes after a Challenge)
  originalPoints = points,
  isChallenged = false,
  challengerTeamName = '',
  isTimeBombed = false,
  timeBombApply = false,
  timeBombReduction = 0,
  timeBombActivatorName = '',
  activeTeamName,
  opposingTeamName,
  noEscapeAvailable = false,
  isNoEscapeTarget = false,
  noEscapeActivatorName = '',
  onNoEscape,
  opponentHasChallenge = false,
  opponentHasTimeBomb = false,
  opponentActionsVisible = false,
  opponentKey = 'B',
  canActivateChallenge = false,
  canActivateTimeBomb = false,
  onActivateChallenge,
  onActivateTimeBomb,
  onTimeBombApplied,
  onSubmitAnswer,
  revealLocked = false,
  revealSecondsLeft = 0
}) {
  const [timeLeft, setTimeLeft] = useState(timeLimit);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [answerResult, setAnswerResult] = useState(null);
  // Actual remaining time right after a Time Bomb reduction is applied, used so
  // the banner shows the real shortened deadline (not full time minus reduction).
  const [appliedBombRemaining, setAppliedBombRemaining] = useState(null);

  const timerRef = useRef(null);
  const selectedIndexRef = useRef(selectedIndex);
  selectedIndexRef.current = selectedIndex;
  const isSubmittedRef = useRef(isSubmitted);
  isSubmittedRef.current = isSubmitted;
  const timeLeftRef = useRef(timeLimit);
  timeLeftRef.current = timeLeft;
  // Guarantees the Time Bomb reduction is applied to the CURRENT remaining
  // time exactly once per question. Without this guard React.StrictMode's dev
  // double-effect would subtract the reduction twice (60 -> 35 -> 10).
  const bombAppliedRef = useRef(false);
  // Wall-clock start time for this question, used to compute an exact
  // "time taken" figure for the match history log — independent of the
  // 1-second tick granularity of the visible countdown.
  const questionStartRef = useRef(Date.now());

  // Guard against a missing/not-yet-loaded question so a bad state never
  // crashes the whole app — show a small fallback instead of throwing.
  if (!question) {
    return (
      <div className="question-card">
        <h2 className="question-title">Loading question…</h2>
        <p>If this doesn't go away, please refresh the page.</p>
      </div>
    );
  }

  const executeSubmission = (chosenIndex) => {
    if (isSubmittedRef.current) return;
    if (timerRef.current) clearInterval(timerRef.current);
    setIsSubmitted(true);

    const isCorrect = chosenIndex !== null && chosenIndex === question.correctIndex;

    // Exact elapsed time since the question appeared, capped at the time
    // limit (a timeout can never register as taking longer than the clock
    // allowed). This feeds the match history / dispute log.
    const rawElapsedSeconds = (Date.now() - questionStartRef.current) / 1000;
    const timeTaken = Math.max(0, Math.min(timeLimit, rawElapsedSeconds));

    // Calculate point delta (rope movement handled authoritatively in App)
    let delta = 0;
    if (isCorrect) {
      delta = points;
      sounds.playCorrect();
      sounds.playRopePull(1);
    } else {
      sounds.playWrong();
      if (isChallenged) {
        delta = -(points * 2);
        sounds.playRopePull(-1);
      }
    }

    const resultObj = {
      isCorrect,
      chosenIndex,
      correctIndex: question.correctIndex,
      delta,
      isChallenged,
      explanation: question.explanation,
      questionText: question.question,
      chosenAnswerText: chosenIndex !== null ? question.options[chosenIndex] : null,
      correctAnswerText: question.options[question.correctIndex],
      timeTaken,
      timeLimit
    };

    setAnswerResult(resultObj);
  };

  const handleAutoSubmit = () => {
    if (isSubmittedRef.current) return;
    executeSubmission(selectedIndexRef.current);
  };

  const handleManualSubmit = () => {
    if (selectedIndex === null) return;
    executeSubmission(selectedIndex);
  };

  const handleNextTurn = () => {
    if (answerResult) {
      onSubmitAnswer(answerResult);
    }
  };

  // Sound tick effect on low time
  useEffect(() => {
    if (timeLeft > 0 && timeLeft <= 5 && !isSubmitted) {
      sounds.playTick();
    }
  }, [timeLeft, isSubmitted]);

  // Main countdown timer — resets on new question / difficulty change /
  // when the No Escape reveal lock lifts (receiving team's clock starts then).
  useEffect(() => {
    setTimeLeft(timeLimit);
    setSelectedIndex(null);
    setIsSubmitted(false);
    setAnswerResult(null);
    setAppliedBombRemaining(null);
    bombAppliedRef.current = false;
    questionStartRef.current = Date.now();
    if (revealLocked) return;

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          handleAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question, timeLimit, revealLocked]);

  // Time Bomb: reduce the CURRENT remaining time exactly once, immediately,
  // without pausing or resetting the countdown. If remaining time is <= the
  // reduction the question expires right away (treated as one timeout).
  useEffect(() => {
    if (!timeBombApply || timeBombReduction <= 0) return;
    if (bombAppliedRef.current) return;
    bombAppliedRef.current = true;
    const current = timeLeftRef.current;
    const reduced = Math.max(0, current - timeBombReduction);
    timeLeftRef.current = reduced;
    setTimeLeft(reduced);
    setAppliedBombRemaining(reduced);
    if (onTimeBombApplied) onTimeBombApplied(reduced);
    if (reduced <= 0) {
      handleAutoSubmit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeBombApply]);

  // Keyboard shortcut listener (1-4 keys)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (isSubmitted || revealLocked) return;
      if (['1', '2', '3', '4'].includes(e.key)) {
        const idx = parseInt(e.key) - 1;
        if (idx >= 0 && idx < question.options.length) {
          setSelectedIndex(idx);
        }
      } else if (e.key === 'Enter' && selectedIndex !== null) {
        executeSubmission(selectedIndex);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIndex, isSubmitted, question, revealLocked]);

  // Calculate percentage of timer
  const timerPercent = (timeLeft / timeLimit) * 100;
  const isUrgent = timeLeft <= 5;

  // Difficulty display helpers
  const getDiffLabel = (diff) => {
    if (diff === 'very_hard') return 'VERY HARD';
    return diff.toUpperCase();
  };

  const getDiffClass = (diff) => {
    if (diff === 'very_hard') return 'diff-very-hard';
    return `diff-${diff}`;
  };

  // === NO ESCAPE TRANSITION SCREEN ===
  // After No Escape activation the question, options and timer stay hidden for
  // 15 seconds. The receiving team cannot answer and the clock does not tick.
  if (revealLocked) {
    return (
      <div className={`question-card-container no-escape-transition ${getDiffClass(difficulty)}`}>
        <div className="no-escape-transition-card">
          <ShieldOff size={44} className="transition-shield-icon" />
          <h2 className="transition-title">NO ESCAPE</h2>
          <p className="transition-pass-line">
            <strong>{noEscapeActivatorName}</strong> passed the question to <strong>{activeTeamName}</strong>.
          </p>
          <p className="transition-sub">Question transferring…</p>
          <div className="transition-countdown">{revealSecondsLeft}</div>
          <p className="transition-note">
            The question, options, and timer will appear when the transfer completes.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`question-card-container ${getDiffClass(difficulty)}`}>
      {/* No Escape Target Banner */}
      {isNoEscapeTarget && (
        <div className="no-escape-target-banner">
          <ShieldOff size={22} />
          <span>
            🚫 NO ESCAPE! {noEscapeActivatorName.toUpperCase()} passed this question to you!
          </span>
        </div>
      )}

      {/* Challenge Banner if active — brief: who challenged, who still answers.
          (Difficulty/points/timer details are managed by the game logic.) */}
      {isChallenged && (
        <div className="challenged-active-banner">
          <div className="challenge-banner-top">
            <ShieldAlert size={22} className="pulse-icon" />
            <span className="challenge-banner-heading">⚔️ CHALLENGE ACTIVATED</span>
          </div>
          <div className="challenge-banner-details">
            <span className="cb-detail-line">
              <strong>{challengerTeamName.toUpperCase()}</strong> challenged <strong>{activeTeamName.toUpperCase()}</strong>.
            </span>
          </div>
        </div>
      )}

      {/* TimeBomb Banner if active */}
      {isTimeBombed && (
        <div className="timebomb-active-banner">
          <div className="timebomb-banner-top">
            <Bomb size={22} />
            <span className="timebomb-banner-heading">💣 TIME BOMB ACTIVATED</span>
          </div>
          <div className="timebomb-banner-details">
            <span className="cb-detail-line">
              <strong>{timeBombActivatorName.toUpperCase()}</strong> shortened {activeTeamName.toUpperCase()}'s timer!
            </span>
            <span className="cb-detail-line">
              Original time: <strong>{timeLimit}s</strong> • Time reduction: <strong>-{timeBombReduction}s</strong> • New deadline: <strong>{appliedBombRemaining != null ? appliedBombRemaining : Math.max(0, timeLeft - timeBombReduction)}s</strong>
            </span>
            <span className="cb-detail-line">
              The countdown continues normally — answer before the deadline or forfeit the question.
            </span>
          </div>
        </div>
      )}

      {/* Card Header & Timer */}
      <div className="question-header">
        <div className="meta-left">
          <span className={`diff-pill ${getDiffClass(difficulty)}`}>
            {getDiffLabel(difficulty)} ({originalPoints} PT{originalPoints > 1 ? 'S' : ''})
          </span>
          <span className="turn-indicator-pill">
            Turn: <strong>{activeTeamName}</strong>
          </span>
        </div>

        {/* Dynamic Timer */}
        <div className={`timer-box ${isUrgent ? 'timer-urgent' : ''} ${isTimeBombed ? 'timer-bombed' : ''}`}>
          {isTimeBombed && <Bomb size={16} className="bomb-icon-small" />}
          <Clock size={20} className="clock-icon" />
          <span className="time-number">{timeLeft}s</span>
          <div className="timer-bar-track">
            <div
              className="timer-bar-fill"
              style={{ width: `${timerPercent}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Main Question Text */}
      <div className="question-text-box">
        <h2 className="question-title">{question.question}</h2>
      </div>

      {/* Opponent Power-Up Bar — BEFORE reveal only. Never shown once the
          question has been revealed (Challenge/TimeBomb are board-time actions). */}
      {!isNoEscapeTarget && opponentActionsVisible && (
        <div className="opponent-powerups-bar">
          <div className="opponent-pu-label">
            <span>{opposingTeamName} (Opponent):</span>
          </div>
          <div className="opponent-pu-buttons">
            {canActivateChallenge ? (
              <button
                className="btn-opp-pu challenge"
                onClick={() => onActivateChallenge(opponentKey)}
                title="Challenge: escalate the difficulty of the question being answered. Points stay the same but the timer becomes the new difficulty's."
              >
                <Swords size={16} /> ⚔️ CHALLENGE
              </button>
            ) : opponentHasChallenge ? (
              <span className="opp-pu-badge disabled">⚔️ Challenge not available now</span>
            ) : (
              <span className="opp-pu-badge used">⚔️ Challenge Used</span>
            )}

            {canActivateTimeBomb ? (
              <button
                className="btn-opp-pu timebomb"
                onClick={() => onActivateTimeBomb(opponentKey)}
                title="TimeBomb: reduce the answering team's remaining time. The rope is unaffected."
              >
                <Bomb size={16} /> 💣 TIMEBOMB
              </button>
            ) : opponentHasTimeBomb ? (
              <span className="opp-pu-badge disabled">💣 TimeBomb not available now</span>
            ) : (
              <span className="opp-pu-badge used">💣 TimeBomb Used</span>
            )}
          </div>
        </div>
      )}

      {/* No Escape Availability — its own bar, clearly separated from the
          answer options below, so the power-up doesn't get lost */}
      {!isSubmitted && noEscapeAvailable && !isNoEscapeTarget && onNoEscape && !isChallenged && (
        <div className="no-escape-availability-bar">
          <div className="no-escape-availability-label">
            <ShieldOff size={20} />
            <span>Power-Up Available</span>
          </div>
          <button
            className="btn-no-escape-prominent"
            onClick={onNoEscape}
            title="Pass the current question to the opposing team. 15 seconds, then they must answer it."
          >
            🚫 NO ESCAPE — Pass to {opposingTeamName}
          </button>
        </div>
      )}

      {/* Options List */}
      <div className="options-grid">
        {question.options.map((opt, idx) => {
          let stateClass = '';
          if (isSubmitted) {
            if (idx === question.correctIndex) {
              stateClass = 'option-correct';
            } else if (idx === selectedIndex) {
              stateClass = 'option-wrong';
            } else {
              stateClass = 'option-disabled';
            }
          } else if (idx === selectedIndex) {
            stateClass = 'option-selected';
          }

          return (
            <button
              key={idx}
              className={`option-card ${stateClass}`}
              onClick={() => !isSubmitted && !revealLocked && setSelectedIndex(idx)}
              disabled={isSubmitted || revealLocked}
            >
              <span className="option-key">{String.fromCharCode(65 + idx)}</span>
              <span className="option-text">{opt}</span>
              {isSubmitted && idx === question.correctIndex && (
                <CheckCircle className="status-icon icon-correct" size={22} />
              )}
              {isSubmitted && idx === selectedIndex && idx !== question.correctIndex && (
                <XCircle className="status-icon icon-wrong" size={22} />
              )}
            </button>
          );
        })}
      </div>

      {/* Controls & Feedback Footer */}
      <div className="question-footer">
        {!isSubmitted ? (
          <div className="pre-submit-footer">
            <div className="footer-left-actions">
              <span className="key-hint">Press 1-4 to select, Enter to submit</span>
            </div>
            <button
              className="btn-submit-answer"
              onClick={handleManualSubmit}
              disabled={selectedIndex === null}
            >
              SUBMIT ANSWER
            </button>
          </div>
        ) : (
          <div className="post-submit-footer">
            <div className={`result-summary ${answerResult?.isCorrect ? 'res-success' : 'res-danger'}`}>
              <div className="res-title">
                {answerResult?.isCorrect ? (
                  isNoEscapeTarget ? (
                    <span>✅ Correct — No points awarded (No Escape transfer).</span>
                  ) : (
                    <span>✅ CORRECT! +{originalPoints} Pt{originalPoints > 1 ? 's' : ''} awarded to {activeTeamName}</span>
                  )
                ) : isNoEscapeTarget ? (
                  <span>❌ INCORRECT! {noEscapeActivatorName} gains +{points} Pt{points > 1 ? 's' : ''} from No Escape!</span>
                ) : isChallenged ? (
                  <span>❌ WRONG ON CHALLENGE! {opposingTeamName} gains +{originalPoints * 2} Pt{originalPoints * 2 > 1 ? 's' : ''}!</span>
                ) : (
                  <span>❌ INCORRECT! 0 Pts awarded</span>
                )}
              </div>
              {answerResult?.explanation && (
                <p className="res-explanation">
                  <strong>Explanation:</strong> {answerResult.explanation}
                </p>
              )}
            </div>

            <button className="btn-next-question" onClick={handleNextTurn}>
              CONTINUE GAME <ArrowRight size={20} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}