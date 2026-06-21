import React from 'react';

const accent = 'var(--accent-primary)';

function surfaceStyle(isInteractive, extra = {}) {
  return {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: isInteractive ? 'grab' : 'default',
    touchAction: isInteractive ? 'none' : 'auto',
    userSelect: isInteractive ? 'none' : 'auto',
    borderRadius: '18px',
    ...extra
  };
}

export default function TimerVisuals({
  mode,
  formattedTime,
  progress,
  phaseText,
  isZenMode,
  sliderProps
}) {
  const interactive = sliderProps?.role === 'slider';
  const common = { ...sliderProps, 'data-timer-mode': mode };
  const timeStyle = {
    fontFamily: '"Outfit", sans-serif',
    fontWeight: 700,
    letterSpacing: '-0.03em',
    textShadow: '0 0 35px rgba(59, 130, 246, 0.35)'
  };

  if (mode === 'bar') {
    return (
      <div {...common} style={surfaceStyle(interactive, { width: 'min(520px, 90vw)', flexDirection: 'column', gap: '24px', padding: '18px' })}>
        <div style={{ ...timeStyle, fontSize: isZenMode ? '8.5rem' : '6.5rem' }}>{formattedTime}</div>
        <div style={{ width: '100%', height: '14px', background: 'rgba(255,255,255,0.06)', borderRadius: '7px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
          <div style={{ width: `${progress * 100}%`, height: '100%', background: 'var(--accent-gradient)' }} />
        </div>
        <div style={{ color: 'var(--text-muted)', letterSpacing: '0.2em', textTransform: 'uppercase' }}>{phaseText}</div>
      </div>
    );
  }

  if (mode === 'minimal') {
    return (
      <div {...common} style={surfaceStyle(interactive, { padding: '36px 24px', flexDirection: 'column' })}>
        <div style={{ ...timeStyle, fontSize: isZenMode ? '12rem' : '8rem', lineHeight: 1 }}>{formattedTime}</div>
        <div style={{ color: 'var(--text-muted)', marginTop: '16px', letterSpacing: '0.35em', textTransform: 'uppercase' }}>{phaseText}</div>
      </div>
    );
  }

  if (mode === 'battery') {
    return (
      <div {...common} style={surfaceStyle(interactive, { flexDirection: 'column', gap: '28px', padding: '20px' })}>
        <div style={{ ...timeStyle, fontSize: isZenMode ? '6.5rem' : '5rem' }}>{formattedTime}</div>
        <div style={{ position: 'relative', width: '220px', height: '100px', border: '4px solid var(--border-color)', borderRadius: '12px', padding: '6px' }}>
          <div style={{ position: 'absolute', right: '-12px', top: '30px', width: '8px', height: '40px', background: 'var(--border-color)', borderRadius: '0 6px 6px 0' }} />
          <div style={{ width: `${progress * 100}%`, height: '100%', borderRadius: '6px', background: progress < 0.15 ? '#ef4444' : 'var(--accent-gradient)' }} />
        </div>
      </div>
    );
  }

  if (mode === 'hourglass') {
    return (
      <div {...common} style={surfaceStyle(interactive, { flexDirection: 'column', gap: '24px', padding: '20px' })}>
        <div style={{ ...timeStyle, fontSize: isZenMode ? '6.5rem' : '5rem' }}>{formattedTime}</div>
        <div style={{ width: '100px', height: '140px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden', clipPath: 'polygon(0 0,100% 0,55% 100%,45% 100%)', background: 'rgba(255,255,255,0.04)' }}>
            <div style={{ position: 'absolute', inset: 'auto 0 0', height: `${progress * 100}%`, background: 'var(--accent-gradient)' }} />
          </div>
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden', clipPath: 'polygon(45% 0,55% 0,100% 100%,0 100%)', background: 'rgba(255,255,255,0.04)' }}>
            <div style={{ position: 'absolute', inset: 'auto 0 0', height: `${(1 - progress) * 100}%`, background: 'var(--accent-gradient)' }} />
          </div>
        </div>
      </div>
    );
  }

  const size = isZenMode ? 400 : 340;
  const radius = mode === 'ring' ? (isZenMode ? 190 : 160) : (isZenMode ? 145 : 120);
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - progress);

  if (mode === 'dots') {
    return (
      <div {...common} style={surfaceStyle(interactive, { width: size, height: size })}>
        {Array.from({ length: 60 }).map((_, index) => {
          const active = index / 60 < progress;
          return <span key={index} style={{ position: 'absolute', top: 20, left: 'calc(50% - 2px)', width: 4, height: 14, borderRadius: 2, background: active ? accent : 'rgba(255,255,255,0.1)', transformOrigin: `2px ${size / 2 - 20}px`, transform: `rotate(${index * 6}deg)`, boxShadow: active ? `0 0 8px ${accent}` : 'none' }} />;
        })}
        <div style={{ ...timeStyle, fontSize: '4.5rem', zIndex: 1 }}>{formattedTime}</div>
      </div>
    );
  }

  return (
    <div {...common} style={surfaceStyle(interactive, { width: size, height: size })}>
      <svg width={size} height={size} style={{ position: 'absolute', transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--border-color)" strokeWidth={mode === 'ring' ? 2 : 8} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={accent} strokeWidth={mode === 'ring' ? 2 : 8} strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={dashOffset} />
      </svg>
      <div style={{ textAlign: 'center', zIndex: 1 }}>
        <div style={{ ...timeStyle, fontWeight: mode === 'ring' ? 300 : 700, fontSize: isZenMode ? '6.5rem' : '4.5rem' }}>{formattedTime}</div>
        <div style={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.15em' }}>{phaseText}</div>
      </div>
    </div>
  );
}
