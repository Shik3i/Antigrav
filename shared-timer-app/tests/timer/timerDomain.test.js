const {
  MIN_DURATION_MINUTES,
  MAX_DURATION_MINUTES,
  MIN_REMAINING_MS,
  createTimerState,
  applyTimerAction,
  tickTimer,
  getPhaseDurationMs
} = require('../../utils/timer/timerDomain');

describe('timerDomain', () => {
  const config = { durationMs: 20 * 60_000, pomodoro: { pauseMinutes: 5 } };
  const snapshot = () => ({ config, state: createTimerState(config.durationMs) });

  test('creates the deterministic initial state and exports its bounds', () => {
    expect([MIN_DURATION_MINUTES, MAX_DURATION_MINUTES, MIN_REMAINING_MS]).toEqual([1, 120, 1_000]);
    expect(createTimerState(config.durationMs)).toEqual({
      isRunning: false,
      remainingMs: config.durationMs,
      lastTickTime: null,
      hasStarted: false,
      isPomodoro: false,
      pomodoroPhase: 'work',
      pomodoroCycles: 0,
      autoRestart: true,
      elapsedActiveMs: 0,
      timerRevision: 0,
      transitionGeneration: 0,
      completionSequence: 0
    });
  });

  test('starts and pauses using only elapsed time since the explicit anchor', () => {
    const started = applyTimerAction(snapshot(), { type: 'START' }, 1_000);
    expect(started).toMatchObject({ ok: true, completion: null, error: null });
    expect(started.value.state).toMatchObject({
      isRunning: true,
      hasStarted: true,
      lastTickTime: 1_000,
      timerRevision: 1,
      transitionGeneration: 1
    });

    const paused = applyTimerAction(started.value, { type: 'PAUSE' }, 6_000);
    expect(paused.value.state).toMatchObject({
      isRunning: false,
      lastTickTime: null,
      remainingMs: config.durationMs - 5_000,
      elapsedActiveMs: 5_000,
      timerRevision: 2,
      transitionGeneration: 2
    });
  });

  test('START restores an exhausted timer and is a no-op while already running', () => {
    const exhausted = { ...snapshot(), state: { ...createTimerState(config.durationMs), remainingMs: 50 } };
    const started = applyTimerAction(exhausted, { type: 'START' }, 10);
    const duplicate = applyTimerAction(started.value, { type: 'START' }, 20);
    expect(started.value.state).toMatchObject({ remainingMs: config.durationMs, lastTickTime: 10 });
    expect(duplicate.value).toEqual(started.value);
  });

  test('RESET returns the current phase to a pristine stopped state', () => {
    const started = applyTimerAction(snapshot(), { type: 'START' }, 1_000).value;
    const reset = applyTimerAction(started, { type: 'RESET' }, 7_000);
    expect(reset.value.state).toMatchObject({
      remainingMs: config.durationMs,
      elapsedActiveMs: 0,
      isRunning: false,
      hasStarted: false,
      lastTickTime: null,
      timerRevision: 2,
      transitionGeneration: 2
    });
  });

  test('SET_DURATION validates and resets a running timer', () => {
    const running = applyTimerAction(snapshot(), { type: 'START' }, 1_000).value;
    const result = applyTimerAction(running, { type: 'SET_DURATION', payload: 30 }, 301_000);
    expect(result.ok).toBe(true);
    expect(result.value.config.durationMs).toBe(30 * 60_000);
    expect(result.value.state).toMatchObject({
      remainingMs: 30 * 60_000,
      elapsedActiveMs: 0,
      isRunning: false,
      hasStarted: false,
      lastTickTime: null,
      timerRevision: 2,
      transitionGeneration: 2
    });
  });

  test('SET_DURATION accepts fractional minutes and rounds to integer milliseconds', () => {
    const result = applyTimerAction(snapshot(), { type: 'SET_DURATION', payload: 1.5 }, 1_000);
    expect(result.ok).toBe(true);
    expect(result.value.config.durationMs).toBe(90_000);
    expect(result.value.state.remainingMs).toBe(90_000);
  });

  test.each([NaN, Infinity, -1, 0, 0.5, 121, 'abc'])('rejects invalid duration %p', payload => {
    const initial = snapshot();
    const before = structuredClone(initial);
    const result = applyTimerAction(initial, { type: 'SET_DURATION', payload }, 1_000);
    expect(result).toMatchObject({ ok: false, error: 'INVALID_DURATION', completion: null });
    expect(initial).toEqual(before);
  });

  test('SET_REMAINING preserves running state, resets its anchor, and never completes', () => {
    const initial = applyTimerAction(snapshot(), { type: 'START' }, 1_000).value;
    const result = applyTimerAction(initial, { type: 'SET_REMAINING', payload: 600_000 }, 5_000);
    expect(result.completion).toBeNull();
    expect(result.value.state).toMatchObject({
      remainingMs: 600_000,
      isRunning: true,
      lastTickTime: 5_000,
      timerRevision: 2,
      transitionGeneration: 2,
      completionSequence: 0
    });
  });

  test('SET_REMAINING preserves a paused timer and validates integer phase bounds', () => {
    const paused = applyTimerAction(snapshot(), { type: 'SET_REMAINING', payload: 600_000 }, 5_000);
    expect(paused.value.state).toMatchObject({ isRunning: false, lastTickTime: null, remainingMs: 600_000 });
    for (const payload of [999, config.durationMs + 1, 1_000.5, NaN, Infinity, '1000']) {
      expect(applyTimerAction(snapshot(), { type: 'SET_REMAINING', payload }, 5_000))
        .toMatchObject({ ok: false, error: 'INVALID_REMAINING' });
    }
    expect(applyTimerAction(snapshot(), { type: 'SET_REMAINING', payload: 1_000 }, 5_000).ok).toBe(true);
    expect(applyTimerAction(snapshot(), { type: 'SET_REMAINING', payload: config.durationMs }, 5_000).ok).toBe(true);
  });

  test('uses explicit break phase duration with a rounded five-minute fallback', () => {
    const state = { ...createTimerState(config.durationMs), isPomodoro: true, pomodoroPhase: 'break' };
    expect(getPhaseDurationMs(config, state)).toBe(5 * 60_000);
    expect(getPhaseDurationMs({ durationMs: config.durationMs, pomodoro: { pauseMinutes: 1.234 } }, state)).toBe(74_040);
    expect(getPhaseDurationMs({ durationMs: config.durationMs }, state)).toBe(5 * 60_000);
  });

  test('emits one natural completion across repeated ticks', () => {
    const short = { config: { ...config, durationMs: 1_000 }, state: createTimerState(1_000) };
    const initial = applyTimerAction(short, { type: 'START' }, 1_000).value;
    const first = tickTimer(initial, 2_100);
    const second = tickTimer(first.value, 3_000);
    expect(first.value.state).toMatchObject({ remainingMs: 0, isRunning: false, completionSequence: 1 });
    expect(first.completion).toMatchObject({ sequence: 1, elapsedActiveMs: 1_100, rewardableElapsedMs: 1_000, early: false });
    expect(second.completion).toBeNull();
    expect(second.value).toEqual(first.value);
  });

  test('PAUSE crossing zero completes exactly once', () => {
    const short = { config: { ...config, durationMs: 1_000 }, state: createTimerState(1_000) };
    const running = applyTimerAction(short, { type: 'START' }, 100).value;
    const paused = applyTimerAction(running, { type: 'PAUSE' }, 1_200);
    expect(paused.completion).toMatchObject({ sequence: 1, rewardableElapsedMs: 1_000, early: false });
    expect(applyTimerAction(paused.value, { type: 'PAUSE' }, 2_000).completion).toBeNull();
  });

  test('END_EARLY accrues actual elapsed and cannot duplicate completion', () => {
    const running = applyTimerAction(snapshot(), { type: 'START' }, 1_000).value;
    const ended = applyTimerAction(running, { type: 'END_EARLY' }, 61_000);
    expect(ended.value.state).toMatchObject({ remainingMs: 0, isRunning: false, elapsedActiveMs: 60_000, completionSequence: 1 });
    expect(ended.completion).toMatchObject({ sequence: 1, elapsedActiveMs: 60_000, rewardableElapsedMs: 60_000, early: true });
    expect(applyTimerAction(ended.value, { type: 'END_EARLY' }, 70_000).completion).toBeNull();
  });

  test('SET_POMODORO validates pause duration and resets mode consistently', () => {
    const enabled = applyTimerAction(snapshot(), { type: 'SET_POMODORO', payload: { enabled: true, pauseMinutes: 1.234 } }, 10);
    expect(enabled.value.config.pomodoro.pauseMinutes).toBe(1.234);
    expect(getPhaseDurationMs(enabled.value.config, { ...enabled.value.state, pomodoroPhase: 'break' })).toBe(74_040);
    expect(enabled.value.state).toMatchObject({ isPomodoro: true, pomodoroPhase: 'work', remainingMs: config.durationMs });
    for (const pauseMinutes of [0, 0.001, 20, Infinity]) {
      expect(applyTimerAction(snapshot(), { type: 'SET_POMODORO', payload: { enabled: true, pauseMinutes } }, 10))
        .toMatchObject({ ok: false, error: 'INVALID_PAUSE_DURATION' });
    }
    const disabled = applyTimerAction(
      { ...enabled.value, state: { ...enabled.value.state, pomodoroPhase: 'break', remainingMs: 5_000 } },
      { type: 'SET_POMODORO', payload: false },
      20
    );
    expect(disabled.value.state).toMatchObject({ isPomodoro: false, pomodoroPhase: 'work', remainingMs: config.durationMs, isRunning: false });
  });

  test('TOGGLE_AUTO_RESTART and ADVANCE_POMODORO produce deterministic next phases', () => {
    const enabled = applyTimerAction(snapshot(), { type: 'SET_POMODORO', payload: true }, 10).value;
    const toggled = applyTimerAction(enabled, { type: 'TOGGLE_AUTO_RESTART', payload: false }, 20);
    expect(toggled.value.state.autoRestart).toBe(false);
    const onBreak = applyTimerAction(toggled.value, { type: 'ADVANCE_POMODORO' }, 30);
    expect(onBreak.value.state).toMatchObject({ pomodoroPhase: 'break', pomodoroCycles: 0, remainingMs: 5 * 60_000, elapsedActiveMs: 0, isRunning: true, lastTickTime: 30 });
    const onWork = applyTimerAction(onBreak.value, { type: 'ADVANCE_POMODORO' }, 40);
    expect(onWork.value.state).toMatchObject({ pomodoroPhase: 'work', pomodoroCycles: 1, remainingMs: config.durationMs, isRunning: true, lastTickTime: 40 });
  });

  test('all transitions leave their input snapshot immutable', () => {
    const initial = snapshot();
    const before = structuredClone(initial);
    applyTimerAction(initial, { type: 'START' }, 1_000);
    tickTimer(initial, 2_000);
    expect(initial).toEqual(before);
  });
});
