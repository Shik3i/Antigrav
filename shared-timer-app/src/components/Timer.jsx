import React from 'react';
import { Pause, Play, Repeat, RotateCcw, StopCircle } from 'lucide-react';
import EVENTS from '../../socketEvents.json';
import { ALARM_SOUNDS, playAlarmSound } from '../utils/soundGenerator';
import { getNextPokemon } from '../utils/pokemonUtils';
import { useAuth } from '../context/AuthContext';
import TimerVisuals from '../features/timer/TimerVisuals';
import { formatTimerTitle } from '../features/timer/timerSelectors';
import { useSynchronizedTimer } from '../features/timer/useSynchronizedTimer';
import { useTimerScrubber } from '../features/timer/useTimerScrubber';

const Timer = ({ roomState, socket, roomId, userRole, user, isZenMode, serverTimeOffset = 0 }) => {
  const { setUser } = useAuth();
  const visualMode = user?.preferences?.timerVisual || 'circle';
  const isWriter = userRole === 'write';

  const handleCompleted = payload => {
    const soundChoice = user?.preferences?.alarmSound || ALARM_SOUNDS.CLASSIC_BEEP;
    const volume = user?.preferences?.alarmVolume ?? 0.5;
    playAlarmSound(soundChoice, volume);

    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification('Timer Completed!', {
        body: `The timer "${roomState?.config?.name || 'Session'}" has finished.`,
        icon: '/vite.svg'
      });
    }

    const pokemonTheme = user?.preferences?.pokemonTheme;
    if (pokemonTheme?.active && pokemonTheme?.timerSync) {
      fetch('/api/pokemon')
        .then(response => response.json())
        .then(list => {
          const nextPokemon = getNextPokemon(list, pokemonTheme);
          if (!nextPokemon) return;
          setUser(previous => ({
            ...previous,
            preferences: {
              ...previous.preferences,
              pokemonTheme: { ...previous.preferences.pokemonTheme, ...nextPokemon }
            }
          }));
        })
        .catch(error => console.error('Pokemon timer sync failed:', error));
    }
    return payload;
  };

  const { remainingMs, showConfetti, presentation } = useSynchronizedTimer({
    roomState,
    socket,
    serverTimeOffset,
    onCompleted: handleCompleted
  });

  const scrubber = useTimerScrubber({
    socket,
    roomId,
    mode: visualMode,
    isWriter,
    remainingMs,
    phaseDurationMs: presentation.phaseDurationMs,
    isConnected: socket?.connected !== false
  });

  if (!roomState) return null;

  const displayRemainingMs = scrubber.displayRemainingMs;
  const displayProgress = presentation.phaseDurationMs > 0
    ? Math.max(0, Math.min(1, displayRemainingMs / presentation.phaseDurationMs))
    : 0;

  const handleAction = (action, payload, acknowledgement) => {
    if (action === 'START'
      && typeof Notification !== 'undefined'
      && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => undefined);
    }
    socket?.emit(EVENTS.TIMER_ACTION, { roomId, action, payload }, acknowledgement);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '40px', position: 'relative' }}>
      {showConfetti && (
        <div style={{ position: 'absolute', inset: '-50px', pointerEvents: 'none', overflow: 'hidden', zIndex: 20 }}>
          {Array.from({ length: 30 }).map((_, index) => (
            <div
              key={index}
              className="confetti-particle"
              style={{
                position: 'absolute',
                left: `${(index * 37) % 100}%`,
                top: `${(index * 13) % 40}%`,
                width: `${6 + (index % 4) * 2}px`,
                height: `${6 + (index % 3) * 3}px`,
                background: ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899'][index % 6],
                borderRadius: index % 2 ? '50%' : '2px',
                animationDelay: `${(index % 5) * 0.1}s`,
                animationDuration: `${2 + (index % 3)}s`
              }}
            />
          ))}
        </div>
      )}

      {roomState.state.isPomodoro && (
        <div style={{ padding: '6px 16px', borderRadius: '20px', color: presentation.phase === 'break' ? '#10b981' : 'var(--accent-primary)', background: 'rgba(59,130,246,0.12)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          Phase: {presentation.phase === 'break'
            ? (roomState.config.pomodoro?.breakName || 'Rest')
            : (roomState.config.pomodoro?.workName || 'Focusing')}
        </div>
      )}

      <TimerVisuals
        mode={visualMode}
        formattedTime={formatTimerTitle(displayRemainingMs)}
        progress={displayProgress}
        phaseText={presentation.phaseText}
        isRunning={roomState.state.isRunning}
        isZenMode={isZenMode}
        sliderProps={scrubber.sliderProps}
      />

      {isWriter ? (
        <div style={{ display: 'flex', gap: '16px', zIndex: 10 }}>
          {!roomState.state.isRunning ? (
            <button className="btn-primary" onClick={() => handleAction('START')} style={{ borderRadius: '50px', padding: '16px 32px' }}>
              <Play fill="currentColor" /> Start
            </button>
          ) : (
            <button className="btn-primary" onClick={() => handleAction('PAUSE')} style={{ borderRadius: '50px', padding: '16px 32px', background: 'rgba(255,255,255,0.1)', boxShadow: 'none' }}>
              <Pause fill="currentColor" /> Pause
            </button>
          )}

          {roomState.state.isRunning && (
            <button
              className="btn-ghost"
              onClick={() => {
                const elapsedMinutes = Math.floor((roomState.state.elapsedActiveMs || 0) / 60_000);
                if (window.confirm(`Timer wirklich beenden? Belohnungen werden anteilig für ${elapsedMinutes} abgelaufene Minuten ausgeschüttet.`)) {
                  handleAction('END_EARLY');
                }
              }}
              style={{ borderRadius: '50px', padding: '16px', background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}
              title="Timer sofort beenden"
            >
              <StopCircle size={24} />
            </button>
          )}

          <button className="btn-ghost" onClick={() => handleAction('RESET')} style={{ borderRadius: '50px', padding: '16px', background: 'rgba(255,255,255,0.05)' }} title="Reset Timer">
            <RotateCcw size={24} />
          </button>

          <button
            className={`btn-ghost ${roomState.state.autoRestart ? 'active' : ''}`}
            onClick={() => socket.emit(EVENTS.TOGGLE_AUTO_RESTART, { roomId, enabled: !roomState.state.autoRestart })}
            style={{ borderRadius: '50px', padding: '16px', background: roomState.state.autoRestart ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.05)', color: roomState.state.autoRestart ? 'var(--accent-primary)' : 'var(--text-muted)' }}
            title="Toggle Auto-Restart"
          >
            <Repeat size={24} />
          </button>
        </div>
      ) : (
        <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', padding: '12px 24px', background: 'rgba(255,255,255,0.05)', borderRadius: '50px' }}>
          Read Only Access
        </div>
      )}
    </div>
  );
};

export default Timer;
