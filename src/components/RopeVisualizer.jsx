import React, { useEffect, useState } from 'react';
import { Flag, Swords, Bomb, ShieldOff, Shield } from 'lucide-react';

export default function RopeVisualizer({
  ropePosition,
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

  const maxRange = 25;
  const clampedPos = Math.max(-maxRange, Math.min(maxRange, ropePosition));
  const pointerPercent = 50 + (clampedPos / maxRange) * 50;

  // Horizontal shift offset in SVG pixels (max ±160px)
  const ropeShiftX = (clampedPos / maxRange) * 160;

  const leftKnockoutPercent = 50 - (knockoutThreshold / maxRange) * 50;
  const rightKnockoutPercent = 50 + (knockoutThreshold / maxRange) * 50;

  const renderPowerUpDots = (team) => {
    const pu = team.powerUps || { challenge: true, timeBomb: true, noEscape: true };
    return (
      <div className="rope-powerup-dots">
        <div className={`rope-pu-dot ${pu.challenge ? 'dot-active' : 'dot-used'}`} title="Challenge">
          <Swords size={11} />
        </div>
        <div className={`rope-pu-dot ${pu.timeBomb ? 'dot-active' : 'dot-used'}`} title="TimeBomb">
          <Bomb size={11} />
        </div>
        <div className={`rope-pu-dot ${pu.noEscape ? 'dot-active' : 'dot-used'}`} title="No Escape">
          <ShieldOff size={11} />
        </div>
      </div>
    );
  };

  let pointerLabel = 'CENTER';
  if (ropePosition < 0) pointerLabel = `+${Math.abs(ropePosition)}`;
  if (ropePosition > 0) pointerLabel = `+${ropePosition}`;

  return (
    <div className="rope-arena-container">
      {/* Stadium Top Header Panels matching Reference Image */}
      <div className="arena-header">
        {/* Red Dragons Panel */}
        <div className={`team-side team-a ${activeTeam === 'A' ? 'active-turn' : ''}`}>
          <div className="team-avatar-box">
            <div className="avatar-icon">🐉</div>
            <div>
              <h3 className="team-name">{teamA.name}</h3>
              <div className="team-sub">RED TEAM</div>
              {renderPowerUpDots(teamA)}
            </div>
          </div>
          <div className="team-score-badge">
            <span className="score-val">{teamA.score}</span>
            <span className="score-lbl">PTS</span>
          </div>
        </div>

        {/* Center VS & Score Displacement Display */}
        <div className="center-versus">
          <div className="vs-badge">VS</div>
          <div className="rope-pos-display">
            <span className={ropePosition < 0 ? 'pos-a' : ropePosition > 0 ? 'pos-b' : 'pos-neutral'}>
              {ropePosition < 0
                ? `${teamA.name} +${Math.abs(ropePosition)}`
                : ropePosition > 0
                ? `${teamB.name} +${ropePosition}`
                : '0 (CENTER)'}
            </span>
          </div>
        </div>

        {/* Blue Titans Panel */}
        <div className={`team-side team-b ${activeTeam === 'B' ? 'active-turn' : ''}`}>
          <div className="team-avatar-box">
            <div>
              <h3 className="team-name">{teamB.name}</h3>
              <div className="team-sub">BLUE TEAM</div>
              {renderPowerUpDots(teamB)}
            </div>
            <div className="avatar-icon">🛡️</div>
          </div>
          <div className="team-score-badge">
            <span className="score-val">{teamB.score}</span>
            <span className="score-lbl">PTS</span>
          </div>
        </div>
      </div>

      {/* Main Arena Rope Track with Background Coordinate Grid */}
      <div className={`rope-track-wrapper ${pullAnim}`}>
        <div className="rope-track">
          <svg className="rope-svg" viewBox="0 0 1000 240" preserveAspectRatio="none">
            <defs>
              {/* Background Rectangular Grid Pattern matching Reference Image */}
              <pattern id="arenaGridPattern" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#e2e8f0" strokeWidth="1.5" />
              </pattern>

              {/* Heavy Jute Rope Gradient */}
              <linearGradient id="hempGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#d97706" />
                <stop offset="25%" stopColor="#b45309" />
                <stop offset="75%" stopColor="#78350f" />
                <stop offset="100%" stopColor="#451a03" />
              </linearGradient>

              {/* Team Red Sleeve/Taper Gradient */}
              <linearGradient id="redArmGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#991b1b" />
                <stop offset="60%" stopColor="#dc2626" />
                <stop offset="100%" stopColor="#b91c1c" />
              </linearGradient>

              {/* Team Blue Sleeve/Taper Gradient */}
              <linearGradient id="blueArmGrad" x1="100%" y1="0%" x2="0%" y2="0%">
                <stop offset="0%" stopColor="#1e3a8a" />
                <stop offset="60%" stopColor="#2563eb" />
                <stop offset="100%" stopColor="#1d4ed8" />
              </linearGradient>

              {/* Neutral Brass / Warm Gold Center Clamp Gradient */}
              <linearGradient id="brassClampGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#f59e0b" />
                <stop offset="50%" stopColor="#d97706" />
                <stop offset="100%" stopColor="#92400e" />
              </linearGradient>

              {/* Human Skin Tones */}
              <linearGradient id="skinToneGradA" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ffdbac" />
                <stop offset="50%" stopColor="#f1c27d" />
                <stop offset="100%" stopColor="#c68642" />
              </linearGradient>

              <linearGradient id="skinToneGradB" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#f1c27d" />
                <stop offset="50%" stopColor="#e0ac69" />
                <stop offset="100%" stopColor="#b27438" />
              </linearGradient>

              <filter id="arenaDropShadow" x="-10%" y="-10%" width="120%" height="120%">
                <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#000000" floodOpacity="0.25" />
              </filter>
            </defs>

            {/* BACKGROUND RECTANGULAR COORDINATE GRID (Reference Image) */}
            <rect x="0" y="0" width="1000" height="240" fill="url(#arenaGridPattern)" />

            {/* Stadium Floor Shadow */}
            <ellipse cx="500" cy="216" rx="490" ry="14" fill="rgba(0,0,0,0.12)" />

            {/* KO Zone Fill Highlights */}
            <rect x="0" y="70" width={1000 * (leftKnockoutPercent / 100)} height="60" fill="rgba(220,38,38,0.06)" />
            <rect x={1000 * (rightKnockoutPercent / 100)} y="70" width={1000 - 1000 * (rightKnockoutPercent / 100)} height="60" fill="rgba(37,99,235,0.06)" />

            {/* Center Dashed Vertical Axis Line (Reference Image) */}
            <line x1="500" y1="10" x2="500" y2="220" stroke="#475569" strokeWidth="2" strokeDasharray="5 5" />
            <line x1={1000 * (leftKnockoutPercent / 100)} y1="10" x2={1000 * (leftKnockoutPercent / 100)} y2="220" stroke="#dc2626" strokeWidth="2.5" />
            <line x1={1000 * (rightKnockoutPercent / 100)} y1="10" x2={1000 * (rightKnockoutPercent / 100)} y2="220" stroke="#2563eb" strokeWidth="2.5" />

            {/* ================================================================= */}
            {/* MOVING ROPE & HANDS ASSEMBLY (Shifts horizontally with ropePosition) */}
            {/* ================================================================= */}
            <g style={{ transform: `translateX(${ropeShiftX}px)`, transition: 'transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)' }}>

              {/* TAPERED TEAM SLEEVES & REAR HAND BASES BEHIND ROPE */}
              <g filter="url(#arenaDropShadow)">
                {/* Red Tapered Sleeve Banner on Left (Reference Image) */}
                <path d="M -150 30 L 140 72 L 130 92 L -150 120 Z" fill="url(#redArmGrad)" stroke="#991b1b" strokeWidth="2" />
                <path d="M -150 120 L 220 90 L 210 110 L -150 180 Z" fill="url(#redArmGrad)" stroke="#991b1b" strokeWidth="2" />

                {/* Blue Tapered Sleeve Banner on Right (Reference Image) */}
                <path d="M 1150 30 L 860 72 L 870 92 L 1150 120 Z" fill="url(#blueArmGrad)" stroke="#1e3a8a" strokeWidth="2" />
                <path d="M 1150 120 L 780 90 L 790 110 L 1150 180 Z" fill="url(#blueArmGrad)" stroke="#1e3a8a" strokeWidth="2" />
              </g>

              {/* MAIN THICK HEAVY BRAIDED ROPE (42px Thick Physical Rope) */}
              <g filter="url(#arenaDropShadow)">
                <rect x="-150" y="78" width="1300" height="44" rx="22" fill="url(#hempGrad)" stroke="#451a03" strokeWidth="2.5" />

                {/* Rope Braid Texture Strands */}
                <path d="M -120 78 Q -100 100 -80 122 M -70 78 Q -50 100 -30 122 M -20 78 Q 0 100 20 122 M 30 78 Q 50 100 70 122 M 80 78 Q 100 100 120 122 M 130 78 Q 150 100 170 122 M 180 78 Q 200 100 220 122 M 230 78 Q 250 100 270 122 M 280 78 Q 300 100 320 122 M 330 78 Q 350 100 370 122 M 380 78 Q 400 100 420 122 M 430 78 Q 450 100 470 122 M 480 78 Q 500 100 520 122 M 530 78 Q 550 100 570 122 M 580 78 Q 600 100 620 122 M 630 78 Q 650 100 670 122 M 680 78 Q 700 100 720 122 M 730 78 Q 750 100 770 122 M 780 78 Q 800 100 820 122 M 830 78 Q 850 100 870 122 M 880 78 Q 900 100 920 122 M 930 78 Q 950 100 970 122 M 980 78 Q 1000 100 1020 122 M 1030 78 Q 1050 100 1070 122 M 1080 78 Q 1100 100 1120 122" 
                      stroke="rgba(254, 243, 199, 0.45)" strokeWidth="3.5" fill="none" strokeLinecap="round" />
                
                <path d="M -95 78 Q -115 100 -135 122 M -45 78 Q -65 100 -85 122 M 5 78 Q -15 100 -35 122 M 55 78 Q 35 100 15 122 M 105 78 Q 85 100 65 122 M 155 78 Q 135 100 115 122 M 205 78 Q 185 100 165 122 M 255 78 Q 235 100 215 122 M 305 78 Q 285 100 265 122 M 355 78 Q 335 100 315 122 M 405 78 Q 385 100 365 122 M 455 78 Q 435 100 415 122 M 505 78 Q 485 100 465 122 M 555 78 Q 535 100 515 122 M 605 78 Q 585 100 565 122 M 655 78 Q 635 100 615 122 M 705 78 Q 685 100 665 122 M 755 78 Q 735 100 715 122 M 805 78 Q 785 100 765 122 M 855 78 Q 835 100 815 122 M 905 78 Q 885 100 865 122 M 955 78 Q 935 100 915 122 M 1005 78 Q 985 100 965 122 M 1055 78 Q 1040 100 1025 122" 
                      stroke="rgba(69, 26, 3, 0.6)" strokeWidth="3.5" fill="none" strokeLinecap="round" />
              </g>

              {/* NEUTRAL WARM GOLD / BRASS CENTER CLAMP MARKER ON ROPE (Reference Specification) */}
              <g transform="translate(500, 0)" filter="url(#arenaDropShadow)">
                {/* Brass Clamp Ring attached physically to center of rope */}
                <rect x="-16" y="72" width="32" height="56" rx="8" fill="url(#brassClampGrad)" stroke="#78350f" strokeWidth="2" />
                {/* Brass Center Marker Flag Ribbon */}
                <path d="M -12 128 L -12 168 L 0 156 L 12 168 L 12 128 Z" fill="#d97706" stroke="#92400e" strokeWidth="2" />
                {/* Gold Accent Band */}
                <rect x="-14" y="84" width="28" height="6" fill="#fef08a" />
              </g>

              {/* =================================================================== */}
              {/* FRONT HAND FINGERS & THUMBS (WRAPPING OVER/UNDER ROPE LIKE REFERENCE) */}
              {/* =================================================================== */}
              <g filter="url(#arenaDropShadow)">
                
                {/* --- RED TEAM HAND 1 (Upper Hand at x=140) --- */}
                <g transform="translate(118, 62)">
                  <path d="M 0 0 C 18 -6, 34 8, 28 26 C 22 42, 6 42, -4 28 C -10 16, -8 4, 0 0 Z" fill="url(#skinToneGradA)" stroke="#8c5220" strokeWidth="2" />
                  <path d="M 12 0 C 30 -6, 46 8, 40 26 C 34 42, 18 42, 8 28 Z" fill="url(#skinToneGradA)" stroke="#8c5220" strokeWidth="2" />
                  <path d="M 24 2 C 42 -4, 58 10, 52 28 C 46 44, 30 44, 20 30 Z" fill="url(#skinToneGradA)" stroke="#8c5220" strokeWidth="2" />
                  <path d="M 36 6 C 54 0, 70 14, 64 32 C 58 46, 42 46, 32 32 Z" fill="url(#skinToneGradA)" stroke="#8c5220" strokeWidth="2" />
                  <path d="M 8 12 Q 18 16 26 12 M 20 12 Q 30 16 38 12 M 32 14 Q 42 18 50 14" stroke="#78350f" strokeWidth="1.5" fill="none" />
                  <path d="M -8 18 Q 12 28 22 44 Q 10 52 -10 34 Z" fill="url(#skinToneGradA)" stroke="#8c5220" strokeWidth="2" />
                </g>

                {/* --- RED TEAM HAND 2 (Lower Hand at x=220) --- */}
                <g transform="translate(195, 92)">
                  <path d="M 0 36 C 18 42, 34 28, 28 10 C 22 -6, 6 -6, -4 8 C -10 20, -8 32, 0 36 Z" fill="url(#skinToneGradA)" stroke="#8c5220" strokeWidth="2" />
                  <path d="M 12 36 C 30 42, 46 28, 40 10 C 34 -6, 18 -6, 8 8 Z" fill="url(#skinToneGradA)" stroke="#8c5220" strokeWidth="2" />
                  <path d="M 24 34 C 42 40, 58 26, 52 8 C 46 -8, 30 -8, 20 6 Z" fill="url(#skinToneGradA)" stroke="#8c5220" strokeWidth="2" />
                  <path d="M 36 30 C 54 36, 70 22, 64 4 C 58 -10, 42 -10, 32 4 Z" fill="url(#skinToneGradA)" stroke="#8c5220" strokeWidth="2" />
                  <path d="M 8 24 Q 18 20 26 24 M 20 24 Q 30 20 38 24 M 32 22 Q 42 18 50 22" stroke="#78350f" strokeWidth="1.5" fill="none" />
                  <path d="M -8 18 Q 12 8 22 -8 Q 10 -16 -10 2 Z" fill="url(#skinToneGradA)" stroke="#8c5220" strokeWidth="2" />
                </g>

                {/* --- BLUE TEAM HAND 1 (Upper Hand at x=860) --- */}
                <g transform="translate(825, 62)">
                  <path d="M 64 0 C 46 -6, 30 8, 36 26 C 42 42, 58 42, 68 28 C 74 16, 72 4, 64 0 Z" fill="url(#skinToneGradB)" stroke="#78350f" strokeWidth="2" />
                  <path d="M 52 0 C 34 -6, 18 8, 24 26 C 30 42, 46 42, 56 28 Z" fill="url(#skinToneGradB)" stroke="#78350f" strokeWidth="2" />
                  <path d="M 40 2 C 22 -4, 6 10, 12 28 C 18 44, 34 44, 44 30 Z" fill="url(#skinToneGradB)" stroke="#78350f" strokeWidth="2" />
                  <path d="M 28 6 C 10 0, -6 14, 0 32 C 6 46, 22 46, 32 32 Z" fill="url(#skinToneGradB)" stroke="#78350f" strokeWidth="2" />
                  <path d="M 56 12 Q 46 16 38 12 M 44 12 Q 34 16 26 12 M 32 14 Q 22 18 14 14" stroke="#78350f" strokeWidth="1.5" fill="none" />
                  <path d="M 72 18 Q 52 28 42 44 Q 54 52 74 34 Z" fill="url(#skinToneGradB)" stroke="#78350f" strokeWidth="2" />
                </g>

                {/* --- BLUE TEAM HAND 2 (Lower Hand at x=780) --- */}
                <g transform="translate(745, 92)">
                  <path d="M 64 36 C 46 42, 30 28, 36 10 C 42 -6, 58 -6, 68 8 C 74 20, 72 32, 64 36 Z" fill="url(#skinToneGradB)" stroke="#78350f" strokeWidth="2" />
                  <path d="M 52 36 C 34 42, 18 28, 24 10 C 30 -6, 46 -6, 56 8 Z" fill="url(#skinToneGradB)" stroke="#78350f" strokeWidth="2" />
                  <path d="M 40 34 C 22 40, 6 26, 12 8 C 18 -8, 34 -8, 44 6 Z" fill="url(#skinToneGradB)" stroke="#78350f" strokeWidth="2" />
                  <path d="M 28 30 C 10 36, -6 22, 0 4 C 6 -10, 22 -10, 32 4 Z" fill="url(#skinToneGradB)" stroke="#78350f" strokeWidth="2" />
                  <path d="M 56 24 Q 46 20 38 24 M 44 24 Q 34 20 26 24 M 32 22 Q 22 18 14 22" stroke="#78350f" strokeWidth="1.5" fill="none" />
                  <path d="M 72 18 Q 52 8 42 -8 Q 54 -16 74 2 Z" fill="url(#skinToneGradB)" stroke="#78350f" strokeWidth="2" />
                </g>

              </g>

            </g>

            {/* Position Pointer Circle attached to center marker */}
            <div
              className="red-pointer-assembly"
              style={{ left: `${pointerPercent}%` }}
            >
              <div className="pointer-circle-body">
                <span className="pointer-label">{pointerLabel}</span>
              </div>
            </div>
          </svg>
        </div>
      </div>

      {/* Scale Footer Ticks (Reference Image) */}
      <div className="scale-ticks">
        <span className="tick-label left-max">◄ Team A KO Zone (−{knockoutThreshold})</span>
        <span className="tick-label center-tick">0 (CENTER)</span>
        <span className="tick-label right-max">Team B KO Zone (+{knockoutThreshold}) ►</span>
      </div>
    </div>
  );
}
