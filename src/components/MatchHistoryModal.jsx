import React, { useMemo, useState } from 'react';
import {
  X,
  History,
  CheckCircle2,
  XCircle,
  Clock,
  Swords,
  Bomb,
  ShieldOff,
  Download,
  Printer
} from 'lucide-react';

// Human-readable label + icon for each kind of turn event, so the log reads
// clearly to someone who wasn't watching the whole game (e.g. a judge called
// in to settle a dispute).
const EVENT_META = {
  NORMAL: { label: 'Standard Question', icon: null },
  CHALLENGE: { label: 'Challenge', icon: Swords },
  TIMEBOMB: { label: 'TimeBomb', icon: Bomb },
  NO_ESCAPE: { label: 'No Escape', icon: ShieldOff },
  TIEBREAKER: { label: 'Sudden Death', icon: Clock }
};

const DIFF_LABEL = (d) => {
  if (!d) return '—';
  if (d === 'very_hard') return 'VERY HARD';
  return d.toUpperCase();
};

export default function MatchHistoryModal({ matchHistory, teamA, teamB, onClose }) {
  const [teamFilter, setTeamFilter] = useState('ALL'); // 'ALL' | 'A' | 'B'
  const [expandedId, setExpandedId] = useState(null);

  const filteredHistory = useMemo(() => {
    if (teamFilter === 'ALL') return matchHistory;
    return matchHistory.filter((entry) => entry.answeringTeamKey === teamFilter);
  }, [matchHistory, teamFilter]);

  const stats = useMemo(() => {
    const build = (teamKey) => {
      const answered = matchHistory.filter((e) => e.answeringTeamKey === teamKey);
      const correct = answered.filter((e) => e.isCorrect).length;
      const totalTime = answered.reduce((sum, e) => sum + (e.timeTaken || 0), 0);
      const avgTime = answered.length ? totalTime / answered.length : 0;
      return {
        answered: answered.length,
        correct,
        wrong: answered.length - correct,
        accuracy: answered.length ? Math.round((correct / answered.length) * 100) : 0,
        avgTime
      };
    };
    return { A: build('A'), B: build('B') };
  }, [matchHistory]);

  const formatTime = (secs) => {
    if (secs === undefined || secs === null) return '—';
    return `${secs.toFixed(1)}s`;
  };

  const handleExportCsv = () => {
    const headers = [
      'Turn', 'Event', 'Difficulty', 'Answering Team', 'Question',
      'Chosen Answer', 'Correct Answer', 'Result', 'Points Awarded To',
      'Points', 'Time Taken (s)', 'Time Limit (s)', 'Timestamp'
    ];
    const rows = matchHistory.map((e) => [
      e.turnLabel,
      EVENT_META[e.eventType]?.label || e.eventType,
      DIFF_LABEL(e.difficulty),
      e.answeringTeamName,
      e.questionText,
      e.chosenAnswerText ?? '(no answer)',
      e.correctAnswerText,
      e.isCorrect ? 'Correct' : 'Wrong',
      e.pointsAwardedToName || '—',
      e.pointsAwarded ?? 0,
      e.timeTaken !== undefined ? e.timeTaken.toFixed(1) : '',
      e.timeLimit ?? '',
      e.timestamp
    ]);
    const escapeCsv = (val) => `"${String(val).replace(/"/g, '""')}"`;
    const csv = [headers, ...rows].map((r) => r.map(escapeCsv).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'match_history.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="modal-overlay">
      <div className="history-modal-card">
        <div className="modal-header">
          <div className="title-box">
            <History size={24} className="icon-blue" />
            <h2>MATCH HISTORY & DISPUTE LOG</h2>
          </div>
          <button className="btn-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <p className="modal-desc">
          Complete record of every question asked, who answered, what was chosen, whether it
          was correct, and how long it took — use this to resolve any scoring disputes.
        </p>

        {/* Summary Stats */}
        <div className="history-summary-grid">
          <div className="history-summary-box" style={{ borderColor: 'var(--team-a-color)' }}>
            <h4 style={{ color: 'var(--team-a-color)' }}>{teamA?.name}</h4>
            <div className="history-summary-row">
              <span>Answered</span><strong>{stats.A.answered}</strong>
            </div>
            <div className="history-summary-row">
              <span>Correct / Wrong</span>
              <strong>{stats.A.correct} / {stats.A.wrong}</strong>
            </div>
            <div className="history-summary-row">
              <span>Accuracy</span><strong>{stats.A.accuracy}%</strong>
            </div>
            <div className="history-summary-row">
              <span>Avg Time</span><strong>{formatTime(stats.A.avgTime)}</strong>
            </div>
          </div>
          <div className="history-summary-box" style={{ borderColor: 'var(--team-b-color)' }}>
            <h4 style={{ color: 'var(--team-b-color)' }}>{teamB?.name}</h4>
            <div className="history-summary-row">
              <span>Answered</span><strong>{stats.B.answered}</strong>
            </div>
            <div className="history-summary-row">
              <span>Correct / Wrong</span>
              <strong>{stats.B.correct} / {stats.B.wrong}</strong>
            </div>
            <div className="history-summary-row">
              <span>Accuracy</span><strong>{stats.B.accuracy}%</strong>
            </div>
            <div className="history-summary-row">
              <span>Avg Time</span><strong>{formatTime(stats.B.avgTime)}</strong>
            </div>
          </div>
        </div>

        {/* Team Filter */}
        <div className="history-filter-row">
          <button
            className={`history-filter-chip ${teamFilter === 'ALL' ? 'active' : ''}`}
            onClick={() => setTeamFilter('ALL')}
          >
            All Turns ({matchHistory.length})
          </button>
          <button
            className={`history-filter-chip ${teamFilter === 'A' ? 'active' : ''}`}
            style={teamFilter === 'A' ? { borderColor: 'var(--team-a-color)', color: 'var(--team-a-color)' } : {}}
            onClick={() => setTeamFilter('A')}
          >
            {teamA?.name}
          </button>
          <button
            className={`history-filter-chip ${teamFilter === 'B' ? 'active' : ''}`}
            style={teamFilter === 'B' ? { borderColor: 'var(--team-b-color)', color: 'var(--team-b-color)' } : {}}
            onClick={() => setTeamFilter('B')}
          >
            {teamB?.name}
          </button>
        </div>

        {/* History Log */}
        <div className="history-log-scroll">
          {filteredHistory.length === 0 ? (
            <p className="history-empty-msg">No questions logged yet.</p>
          ) : (
            filteredHistory.map((entry) => {
              const meta = EVENT_META[entry.eventType] || EVENT_META.NORMAL;
              const EventIcon = meta.icon;
              const isExpanded = expandedId === entry.id;
              return (
                <div
                  key={entry.id}
                  className={`history-entry-card ${entry.isCorrect ? 'entry-correct' : 'entry-wrong'}`}
                  onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                >
                  <div className="history-entry-row">
                    <span className="history-turn-badge">{entry.turnLabel}</span>
                    <span
                      className="history-team-name"
                      style={{ color: entry.answeringTeamKey === 'A' ? 'var(--team-a-color)' : 'var(--team-b-color)' }}
                    >
                      {entry.answeringTeamName}
                    </span>
                    <span className={`history-diff-pill diff-${entry.difficulty}`}>
                      {DIFF_LABEL(entry.difficulty)}
                    </span>
                    {EventIcon && (
                      <span className="history-event-pill">
                        <EventIcon size={12} /> {meta.label}
                      </span>
                    )}
                    <span className="history-time-pill">
                      <Clock size={12} /> {formatTime(entry.timeTaken)}
                      {entry.timeLimit ? ` / ${entry.timeLimit}s` : ''}
                    </span>
                    <span className="history-result-icon">
                      {entry.isCorrect ? (
                        <CheckCircle2 size={18} className="icon-correct" />
                      ) : (
                        <XCircle size={18} className="icon-wrong" />
                      )}
                    </span>
                    {entry.pointsAwarded ? (
                      <span className="history-points-pill">
                        +{entry.pointsAwarded} {entry.pointsAwardedToName}
                      </span>
                    ) : (
                      <span className="history-points-pill history-points-zero">No pts</span>
                    )}
                  </div>

                  <p className="history-question-line">{entry.questionText}</p>

                  {isExpanded && (
                    <div className="history-entry-detail">
                      <div className="history-detail-row">
                        <span className="detail-label">Chosen Answer:</span>
                        <span className={entry.isCorrect ? 'detail-value-correct' : 'detail-value-wrong'}>
                          {entry.chosenAnswerText || '(no answer submitted)'}
                        </span>
                      </div>
                      {!entry.isCorrect && (
                        <div className="history-detail-row">
                          <span className="detail-label">Correct Answer:</span>
                          <span className="detail-value-correct">{entry.correctAnswerText}</span>
                        </div>
                      )}
                      {entry.initiatorName && (
                        <div className="history-detail-row">
                          <span className="detail-label">Power-Up Used By:</span>
                          <span>{entry.initiatorName}</span>
                        </div>
                      )}
                      <div className="history-detail-row">
                        <span className="detail-label">Logged At:</span>
                        <span>{new Date(entry.timestamp).toLocaleTimeString()}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="modal-footer">
          <span className="history-hint">Tap a row to see full answer details.</span>
          <div className="save-actions">
            <button className="btn-secondary" onClick={handleExportCsv}>
              <Download size={16} /> Export CSV
            </button>
            <button className="btn-secondary" onClick={() => window.print()}>
              <Printer size={16} /> Print
            </button>
            <button className="btn-primary" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
