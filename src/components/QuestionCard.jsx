import React, { useState, useEffect, useRef } from 'react';
import { Clock, ShieldAlert, CheckCircle, XCircle, ArrowRight, Bomb, ShieldOff, Swords } from 'lucide-react';
import { sounds } from '../utils/soundEffects';

export default function QuestionCard({
  question,
  difficulty, // 'easy' | 'medium' | 'hard' | 'very_hard'
  timeLimit,
  points = 1,
  originalPoints = points,
  isChallenged = false,
  challengerTeamName = '',
  isTimeBombed = false,
  timeBombActivatorName = '',
  timeBombOriginalTime = 0,
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
  onSubmitAnswer,
  revealLocked = false,
  revealSecondsLeft = 0,
  deadline = null,
  startMs = null,
  restoreState = null,
  onQuestionUIChange = null,
  onTimerStart = null
}) {
  const [timeLeft, setTimeLeft] = useState(() => {
    if (deadline) return Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
    return timeLimit;
  });
  const [selectedIndex, setSelectedIndex] = useState(restoreState?.selectedIndex ?? null);
  const [isSubmitted, setIsSubmitted] = useState(restoreState?.isSubmitted ?? false);
  const [answerResult, setAnswerResult] = useState(restoreState?.answerResult ?? null);

  const timerRef = useRef(null);
  const timerKeyRef = useRef(null);
  const selectedIndexRef = useRef(selectedIndex);
  selectedIndexRef.current = selectedIndex;
  const isSubmittedRef = useRef(isSubmitted);
  isSubmittedRef.current = isSubmitted;
  const timeLeftRef = useRef(timeLeft);
  timeLeftRef.current = timeLeft;
  const questionStartRef = useRef(Date.now());

  if (!question) {
    return (
      <div className="question-card-container">
        <h2 className="question-title">Loading question…</h2>
        <p style={{ color: 'var(--text-secondary)' }}>If this does not appear shortly, please refresh.</p>
      </div>
    );
  }

  const executeSubmission = (chosenIndex) => {
    if (isSubmittedRef.current) return;
    if (timerRef.current) clearInterval(timerRef.current);
    setIsSubmitted(true);

    const isCorrect = chosenIndex !== null && chosenIndex === question.correctIndex;
    const rawElapsedSeconds = (Date.now() - questionStartRef.current) / 1000;
    const timeTaken = Math.max(0, Math.min(timeLimit, rawElapsedSeconds));

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

  useEffect(() => {
    if (timeLeft > 0 && timeLeft <= 5 && !isSubmitted) {
      sounds.playTick();
    }
  }, [timeLeft, isSubmitted]);

  useEffect(() => {
    const key = `${question.question}|${timeLimit}|${revealLocked ? 'L' : 'O'}`;
    if (timerKeyRef.current !== null && timerKeyRef.current !== key) {
      setSelectedIndex(null);
      setIsSubmitted(false);
      setAnswerResult(null);
      selectedIndexRef.current = null;
      isSubmittedRef.current = false;
    }
    timerKeyRef.current = key;

    questionStartRef.current = startMs || Date.now();
    if (revealLocked) return;

    const deadlineMs = deadline || Date.now() + timeLimit * 1000;
    if (onTimerStart) onTimerStart(deadlineMs);

    const tick = () => {
      if (isSubmittedRef.current) {
        clearInterval(timerRef.current);
        return;
      }
      const remaining = Math.max(0, Math.ceil((deadlineMs - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (Date.now() >= deadlineMs) {
        clearInterval(timerRef.current);
        handleAutoSubmit();
      }
    };

    tick();
    timerRef.current = setInterval(tick, 250);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question, timeLimit, deadline, revealLocked]);

  useEffect(() => {
    if (onQuestionUIChange) {
      onQuestionUIChange({ selectedIndex, isSubmitted, answerResult });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIndex, isSubmitted, answerResult]);

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

  const timerPercent = (timeLeft / timeLimit) * 100;
  const isUrgent = timeLeft <= 5;

  const getDiffLabel = (diff) => {
    if (diff === 'very_hard') return 'VERY HARD';
    return diff.toUpperCase();
  };

  const getDiffClass = (diff) => {
    if (diff === 'very_hard') return 'diff-very-hard';
    return `diff-${diff}`;
  };

  const timeBombReduction = isTimeBombed ? Math.max(0, timeBombOriginalTime - timeLimit) : 0;

  if (revealLocked) {
    return (
      <div className={`question-card-container no-escape-transition ${getDiffClass(difficulty)}`}>
        <div className="no-escape-transition-card">
          <ShieldOff size={44} className="transition-shield-icon" />
          <h2 className="transition-title">NO ESCAPE</h2>
          <p className="transition-pass-line">
            <strong>{noEscapeActivatorName}</strong> passed this question to <strong>{activeTeamName}</strong>!
          </p>
          <p className="transition-sub">QUESTION TRANSFERRING IN...</p>
          <div className="transition-countdown">{revealSecondsLeft}</div>
          <p className="transition-note">
            The clock will start when the transfer completes. Prepare to answer!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`question-card-container ${getDiffClass(difficulty)}`}>
      {/* Active Pre-Reveal Status Indicators */}
      {isNoEscapeTarget && (
        <div className="no-escape-target-banner">
          <ShieldOff size={18} />
          <span>
            🚫 NO ESCAPE ACTIVATED! {noEscapeActivatorName.toUpperCase()} passed this question to your team!
          </span>
        </div>
      )}

      {isChallenged && (
        <div className="challenged-active-banner">
          <div className="challenge-banner-top">
            <Swords size={18} />
            <span className="challenge-banner-heading">⚔️ CHALLENGE ACTIVE</span>
          </div>
          <div className="challenge-banner-details">
            <span className="cb-detail-line">
              <strong>{challengerTeamName.toUpperCase()}</strong> escalated difficulty for <strong>{activeTeamName.toUpperCase()}</strong>. Wrong answer penalty: <strong>2× Points!</strong>
            </span>
          </div>
        </div>
      )}

      {isTimeBombed && (
        <div className="timebomb-active-banner">
          <div className="timebomb-banner-top">
            <Bomb size={18} />
            <span className="timebomb-banner-heading">💣 TIME BOMB ACTIVE</span>
          </div>
          <div className="timebomb-banner-details">
            <span className="cb-detail-line">
              <strong>{timeBombActivatorName.toUpperCase()}</strong> reduced timer: <strong>{timeBombOriginalTime}s → {timeLimit}s</strong> (-{timeBombReduction}s).
            </span>
          </div>
        </div>
      )}

      {/* Focused Question Header & Clock */}
      <div className="question-header">
        <div className="meta-left">
          <span className={`diff-pill ${getDiffClass(difficulty)}`}>
            {getDiffLabel(difficulty)} • {originalPoints} PT{originalPoints > 1 ? 'S' : ''}
          </span>
          <span className="turn-indicator-pill">
            Answering: <strong style={{ color: 'var(--text-primary)' }}>{activeTeamName}</strong>
          </span>
        </div>

        <div className={`timer-box ${isUrgent ? 'timer-urgent' : ''} ${isTimeBombed ? 'timer-bombed' : ''}`}>
          {isTimeBombed && <Bomb size={14} className="bomb-icon-small" />}
          <Clock size={16} className="clock-icon" />
          <span className="time-number">{timeLeft}s</span>
          <div className="timer-bar-track">
            <div
              className="timer-bar-fill"
              style={{ width: `${timerPercent}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Main Question / Code Display */}
      {question.presentation?.type === 'code' ? (
        <div className="question-code-block-container">
          <h2 className="question-title code-prompt">
            {question.presentation.prompt || 'Analyze the code below:'}
          </h2>
          <pre className="code-display-block">
            <code>{question.presentation.code}</code>
          </pre>
        </div>
      ) : (
        <div className="question-text-box">
          <h2 className="question-title">{question.question}</h2>
        </div>
      )}

      {/* NO ESCAPE Power-up Trigger (usable during Question state before answering) */}
      {!isSubmitted && noEscapeAvailable && !isNoEscapeTarget && onNoEscape && !isChallenged && (
        <div className="no-escape-availability-bar">
          <div className="no-escape-availability-label">
            <ShieldOff size={18} />
            <span>POWERUP AVAILABLE:</span>
          </div>
          <button
            className="btn-no-escape-prominent"
            onClick={onNoEscape}
            title="Pass this question to the opposing team."
          >
            🚫 NO ESCAPE — Pass to {opposingTeamName}
          </button>
        </div>
      )}

      {/* Options Grid */}
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
                <CheckCircle className="status-icon icon-correct" size={20} />
              )}
              {isSubmitted && idx === selectedIndex && idx !== question.correctIndex && (
                <XCircle className="status-icon icon-wrong" size={20} />
              )}
            </button>
          );
        })}
      </div>

      {/* Footer Actions & Post-Answer Feedback */}
      <div className="question-footer">
        {!isSubmitted ? (
          <div className="pre-submit-footer">
            <div className="footer-left-actions">
              <span className="key-hint">Press <strong>1-4</strong> to select, <strong>Enter</strong> to submit</span>
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
                    <span>✅ Correct — Question neutralized (No Escape).</span>
                  ) : (
                    <span>✅ CORRECT! +{originalPoints} Pt{originalPoints > 1 ? 's' : ''} to {activeTeamName}</span>
                  )
                ) : isNoEscapeTarget ? (
                  <span>❌ INCORRECT! {noEscapeActivatorName} gains +{points} Pt{points > 1 ? 's' : ''}!</span>
                ) : isChallenged ? (
                  <span>❌ WRONG ON CHALLENGE! {opposingTeamName} gains +{originalPoints * 2} Pt{originalPoints * 2 > 1 ? 's' : ''}!</span>
                ) : (
                  <span>❌ INCORRECT — 0 Points awarded</span>
                )}
              </div>
              {answerResult?.explanation && (
                <p className="res-explanation">
                  <strong>Explanation:</strong> {answerResult.explanation}
                </p>
              )}
            </div>

            <button className="btn-next-question" onClick={handleNextTurn}>
              CONTINUE <ArrowRight size={18} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}