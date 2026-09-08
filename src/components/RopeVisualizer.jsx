import React, { useEffect, useState } from 'react';
import { Flag, Swords, Bomb, ShieldOff } from 'lucide-react';

export default function RopeVisualizer({
  ropePosition, // -25 (Team A max win) to +25 (Team B max win)
  teamA,
  teamB,
  knockoutThreshold = 20,
  activeTeam,
  lastDelta = 0
}) {
  const [pullAnim, setPullAnim] = useState('');

  useEffect(() => {
    if (lastDelta !== 0) {
      setPullAnim(lastDelta < 0 ? 'pull-left' : 'pull-right');
      const timer = setTimeout(() => setPullAnim(''), 800);
      return () => clearTimeout(timer);
    }
  }, [ropePosition, lastDelta]);

  // Convert position to percentage (range -25 to 25 -> 0% to 100%)
  const maxRange = 25;
  const clampedPos = Math.max(-maxRange, Math.min(maxRange, ropePosition));
  const pointerPercent = 50 + (clampedPos / maxRange) * 50;

  // Calculate knockout line percentages
  const leftKnockoutPercent = 50 - (knockoutThreshold / maxRange) * 50;
  const rightKnockoutPercent = 50 + (knockoutThreshold / maxRange) * 50;

  // Power-up status helpers
  const renderPowerUpDots = (team) => {
    const pu = team.powerUps || { challenge: true, timeBomb: true, noEscape: true };
    return (
      <div className="rope-powerup-dots">
        <div className={`rope-pu-dot ${pu.challenge ? 'dot-active' : 'dot-used'}`} title="Challenge">
          <Swords size={10} />
        </div>
        <div className={`rope-pu-dot ${pu.timeBomb ? 'dot-active' : 'dot-used'}`} title="TimeBomb">
          <Bomb size={10} />
        </div>
        <div className={`rope-pu-dot ${pu.noEscape ? 'dot-active' : 'dot-used'}`} title="No Escape">
          <ShieldOff size={10} />
        </div>
      </div>
    );
  };

  let pointerLabel = 'MIDDLE';
  if (ropePosition < 0) pointerLabel = teamA.name;
  if (ropePosition > 0) pointerLabel = teamB.name;

  return (
    <div className="rope-arena-container">
      {/* Team Headers / Avatars */}
      <div className="arena-header">
        <div className={`team-side team-a ${activeTeam === 'A' ? 'active-turn' : ''}`}>
          <div className="team-avatar-box">
            <div className="avatar-icon">〇</div>
            <div>
              <h3 className="team-name">{teamA.name}</h3>
              <div className="team-sub">Team A</div>
              {renderPowerUpDots(teamA)}
            </div>
          </div>
          <div className="team-score-badge">
            <span className="score-val">{teamA.score}</span>
            <span className="score-lbl">pts</span>
          </div>
        </div>

        <div className="center-versus">
          <div className="vs-badge">VS</div>
          <div className="rope-pos-display">
            Position: <span className={ropePosition < 0 ? 'pos-a' : ropePosition > 0 ? 'pos-b' : 'pos-neutral'}>
              {ropePosition < 0 ? `${teamA.name} +${Math.abs(ropePosition)}` : ropePosition > 0 ? `${teamB.name} +${ropePosition}` : 'CENTER (0)'}
            </span>
          </div>
        </div>

        <div className={`team-side team-b ${activeTeam === 'B' ? 'active-turn' : ''}`}>
          <div className="team-score-badge">
            <span className="score-val">{teamB.score}</span>
            <span className="score-lbl">pts</span>
          </div>
          <div className="team-avatar-box">
            <div>
              <h3 className="team-name">{teamB.name}</h3>
              <div className="team-sub">Team B</div>
              {renderPowerUpDots(teamB)}
            </div>
            <div className="avatar-icon">△</div>
          </div>
        </div>
      </div>

      {/* Main Rope Track */}
      <div className={`rope-track-wrapper ${pullAnim}`}>
        <div className="rope-track">
          {/* Tension Lines SVG */}
          <svg className="rope-svg" viewBox="0 0 1000 120" preserveAspectRatio="none">
            <defs>
              <linearGradient id="ropeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="var(--team-a-color)" />
                <stop offset="25%" stopColor="#8a2be2" />
                <stop offset="50%" stopColor="#4a0e4e" />
                <stop offset="75%" stopColor="#8a2be2" />
                <stop offset="100%" stopColor="var(--team-b-color)" />
              </linearGradient>
            </defs>

            {/* Base Rope Cable */}
            <rect x="0" y="36" width="1000" height="48" rx="24" fill="url(#ropeGradient)" opacity="0.9" />
            <line x1="0" y1="60" x2="1000" y2="60" stroke="#ffffff" strokeWidth="8" strokeDasharray="30 15" opacity="0.5" />

            {/* Center Deadzone Marker */}
            <line x1="500" y1="10" x2="500" y2="110" stroke="#94a3b8" strokeWidth="6" strokeDasharray="8 8" />

            {/* Knockout Threshold Flags */}
            <line x1={1000 * (leftKnockoutPercent / 100)} y1="15" x2={1000 * (leftKnockoutPercent / 100)} y2="105" stroke="var(--team-a-color)" strokeWidth="4" />
            <line x1={1000 * (rightKnockoutPercent / 100)} y1="15" x2={1000 * (rightKnockoutPercent / 100)} y2="105" stroke="var(--team-b-color)" strokeWidth="4" />
          </svg>

          {/* Knockout Indicators */}
          <div className="ko-marker left-ko" style={{ left: `${leftKnockoutPercent}%` }}>
            <Flag size={16} className="ko-icon-left" />
            <span>WIN A</span>
          </div>

          <div className="ko-marker right-ko" style={{ left: `${rightKnockoutPercent}%` }}>
            <Flag size={16} className="ko-icon-right" />
            <span>WIN B</span>
          </div>

          <div className="center-flag">
            <span>MID</span>
          </div>

          {/* RED POINTER (Middle Marker) */}
          <div
            className="red-pointer-assembly"
            style={{ left: `${pointerPercent}%` }}
          >
            <div className="pointer-circle-body">
              <span className="pointer-label">{pointerLabel}</span>
              <div className="pointer-glow-ring"></div>
            </div>
          </div>
        </div>

        {/* Rope Pullers Animation (Avatars pulling) */}
        <div className="pullers-container">
          <div className={`puller-group team-a-pullers ${activeTeam === 'A' ? 'active-pull' : ''}`}>
            <div className="figure figure-1 squid-shape">〇</div>
            <div className="figure figure-2 squid-shape">□</div>
          </div>
          <div className={`puller-group team-b-pullers ${activeTeam === 'B' ? 'active-pull' : ''}`}>
            <div className="figure figure-2 squid-shape">△</div>
            <div className="figure figure-1 squid-shape">〇</div>
          </div>
        </div>
      </div>

      {/* Numerical Scale Ticks */}
      <div className="scale-ticks">
        <span className="tick-label left-max">Team A Win (-{knockoutThreshold})</span>
        <span className="tick-label center-tick">0</span>
        <span className="tick-label right-max">Team B Win (+{knockoutThreshold})</span>
      </div>
    </div>
  );
}
