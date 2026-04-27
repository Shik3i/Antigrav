import React from 'react';

const PHASE_LABELS = {
  waiting: 'Next Round Starting…',
  betting_open: 'Place Your Bets',
  betting_closed: 'No More Bets',
  spin: 'Spinning…',
  settlement: 'Payouts',
};

const PHASE_COLORS = {
  waiting: '#666',
  betting_open: '#b8960c',
  betting_closed: '#c0392b',
  spin: '#2980b9',
  settlement: '#27ae60',
};

export default function RoulettePhaseBar({ phase, secondsLeft }) {
  const color = PHASE_COLORS[phase] || '#666';
  const label = PHASE_LABELS[phase] || phase;
  const maxSeconds = phase === 'betting_open' ? 30 : phase === 'spin' ? 10 : phase === 'settlement' ? 5 : 5;
  const pct = Math.min(100, (secondsLeft / maxSeconds) * 100);

  return (
    <div className="phase-bar">
      <div className="phase-bar__label" style={{ color }}>
        {label}
      </div>
      {secondsLeft > 0 && (
        <div className="phase-bar__timer" style={{ color }}>
          {secondsLeft}s
        </div>
      )}
      <div className="phase-bar__track">
        <div
          className="phase-bar__fill"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}
