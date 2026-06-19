import {
  formatTimerTitle,
  getExactRemainingMs,
  getPhaseDurationMs,
  getTimerPresentation,
  isStaleTimerSnapshot
} from '../../src/features/timer/timerSelectors';

describe('timerSelectors', () => {
  const roomState = {
    config: { durationMs: 20 * 60_000, pomodoro: { pauseMinutes: 5, workName: 'Work', breakName: 'Rest' } },
    state: {
      isRunning: true,
      remainingMs: 600_000,
      lastTickTime: 9_000,
      isPomodoro: false,
      pomodoroPhase: 'work',
      timerRevision: 4
    }
  };

  test('derives exact server-corrected remaining time without mutating the snapshot', () => {
    const before = structuredClone(roomState);
    expect(getExactRemainingMs(roomState, 50, 10_000)).toBe(598_950);
    expect(roomState).toEqual(before);
  });

  test('returns the stored value for paused timers and formats non-negative titles', () => {
    expect(getExactRemainingMs({ ...roomState, state: { ...roomState.state, isRunning: false } }, 0, 99_000))
      .toBe(600_000);
    expect(formatTimerTitle(60_001)).toBe('01:01');
    expect(formatTimerTitle(-1)).toBe('00:00');
  });

  test('uses explicit Pomodoro phase and phase duration for progress', () => {
    const breakRoom = {
      ...roomState,
      state: {
        ...roomState.state,
        isRunning: false,
        isPomodoro: true,
        pomodoroPhase: 'break',
        remainingMs: 300_000
      }
    };
    expect(getPhaseDurationMs(breakRoom)).toBe(300_000);
    expect(getTimerPresentation({ roomState: breakRoom, now: 10_000 })).toMatchObject({
      phase: 'break',
      phaseText: 'Paused (Rest)',
      phaseDurationMs: 300_000,
      remainingMs: 300_000,
      progress: 1
    });
  });

  test('clamps progress and reports running phase labels', () => {
    expect(getTimerPresentation({ roomState, now: 10_000 })).toMatchObject({
      phase: 'work',
      phaseText: 'Work'
    });
    const overflow = { ...roomState, state: { ...roomState.state, isRunning: false, remainingMs: 99_000_000 } };
    expect(getTimerPresentation({ roomState: overflow }).progress).toBe(1);
  });

  test('rejects only lower timer revisions', () => {
    expect(isStaleTimerSnapshot(
      { state: { timerRevision: 4 } },
      { state: { timerRevision: 3 } }
    )).toBe(true);
    expect(isStaleTimerSnapshot(
      { state: { timerRevision: 4 } },
      { state: { timerRevision: 4 } }
    )).toBe(false);
    expect(isStaleTimerSnapshot(null, { state: {} })).toBe(false);
  });
});
