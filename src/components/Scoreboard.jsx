import React from 'react';
import { Zap, Volume2, VolumeX, RefreshCw, History, Settings, Clock } from 'lucide-react';

export default function Scoreboard({
  stage,
  questionNumber,
  totalQuestionsPerTeam = 18,
  teamA,
  teamB,
  activeTeam,
  soundEnabled,
  onToggleSound,
  onOpenMatchHistory,
  onResetGame
}) {
  const getStagePoints = () => {
    switch (stage) {
      case 'easy': return 1;
      case 'medium': return 2;
      case 'hard': return 3;
      default: return 1;
    }
  };

  return (
    <div className="scoreboard-bar">
      <div className="scoreboard-title-section">
        <div className="game-logo">
          <Zap className="logo-icon" size={20} fill="currentColor" />
          <h2>TUG OF WAR <span className="subtitle">| TECHNICAL CHAMPIONSHIP</span></h2>
        </div>
        <div className="stage-info">
          <span className="stage-tag">
            PHASE: {stage.toUpperCase()} | PTS: {getStagePoints()} | Q: {questionNumber}/{totalQuestionsPerTeam * 2}
          </span>
        </div>
      </div>

      <div className="scoreboard-controls">
        <button
          className="btn-icon"
          title="Settings"
        >
          <Settings size={16} />
        </button>

        <button
          className="btn-icon"
          onClick={onOpenMatchHistory}
          title="Match History"
        >
          <Clock size={16} />
        </button>

        <button
          className="btn-icon btn-reset"
          onClick={onResetGame}
          title="Reset Game"
        >
          <RefreshCw size={16} />
        </button>

        <button
          className="btn-icon"
          onClick={onToggleSound}
          title={soundEnabled ? "Mute Audio" : "Enable Audio"}
        >
          {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
        </button>
      </div>
    </div>
  );
}
