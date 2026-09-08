import React from 'react';
import { Zap, Volume2, VolumeX, Swords, Bomb, ShieldOff, RefreshCw, FileText, History } from 'lucide-react';

export default function Scoreboard({
  stage, // 'easy' | 'medium' | 'hard'
  questionNumber, // 1 to 36
  totalQuestionsPerTeam = 18,
  teamA,
  teamB,
  activeTeam,
  soundEnabled,
  onToggleSound,
  onOpenJsonManager,
  onOpenMatchHistory,
  onResetGame
}) {
  const getStageBadge = () => {
    switch (stage) {
      case 'easy':
        return <span className="stage-tag tag-easy">EASY STAGE (45s / 1 Pt)</span>;
      case 'medium':
        return <span className="stage-tag tag-medium">MEDIUM STAGE (60s / 2 Pts)</span>;
      case 'hard':
        return <span className="stage-tag tag-hard">HARD STAGE (90s / 3 Pts)</span>;
      default:
        return <span className="stage-tag">ROUND 2</span>;
    }
  };

  const renderPowerUpTokens = (team, teamLabel) => {
    const powerUps = team.powerUps || { challenge: true, timeBomb: true, noEscape: true };
    return (
      <div className="team-tokens">
        <span className="token-label">{team.name}:</span>
        <div className="tokens-flex">
          <div
            className={`powerup-token-icon ${powerUps.challenge ? 'token-available' : 'token-used'}`}
            title={powerUps.challenge ? 'Challenge — Available' : 'Challenge — Used'}
          >
            <Swords size={13} />
          </div>
          <div
            className={`powerup-token-icon ${powerUps.timeBomb ? 'token-available' : 'token-used'}`}
            title={powerUps.timeBomb ? 'TimeBomb — Available' : 'TimeBomb — Used'}
          >
            <Bomb size={13} />
          </div>
          <div
            className={`powerup-token-icon ${powerUps.noEscape ? 'token-available' : 'token-used'}`}
            title={powerUps.noEscape ? 'No Escape — Available' : 'No Escape — Used'}
          >
            <ShieldOff size={13} />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="scoreboard-bar">
      {/* Game Title & Stage */}
      <div className="scoreboard-title-section">
        <div className="game-logo">
          <Zap className="logo-icon" size={24} />
          <h2>TUG OF WAR <span className="subtitle">ROUND 2</span></h2>
        </div>
        <div className="stage-info">
          {getStageBadge()}
          <span className="question-progress">
            Q{questionNumber} of {totalQuestionsPerTeam * 2} Total Turns
          </span>
        </div>
      </div>

      {/* Power-up Tokens Tracker */}
      <div className="challenge-tokens-bar">
        {renderPowerUpTokens(teamA, 'A')}
        <div className="vs-divider">|</div>
        {renderPowerUpTokens(teamB, 'B')}
      </div>

      {/* Utility Buttons */}
      <div className="scoreboard-controls">
        <button
          className="btn-icon"
          onClick={onToggleSound}
          title={soundEnabled ? "Mute Audio" : "Enable Audio"}
        >
          {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
        </button>

        <button
          className="btn-icon"
          onClick={onOpenMatchHistory}
          title="Match History — resolve disputes"
        >
          <History size={18} />
        </button>

        <button
          className="btn-icon"
          onClick={onOpenJsonManager}
          title="Questions JSON Editor"
        >
          <FileText size={18} />
        </button>

        <button
          className="btn-icon btn-reset"
          onClick={onResetGame}
          title="Reset Round 2"
        >
          <RefreshCw size={18} />
        </button>
      </div>
    </div>
  );
}
