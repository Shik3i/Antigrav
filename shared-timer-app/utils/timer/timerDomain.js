const MIN_DURATION_MINUTES = 1;
const MAX_DURATION_MINUTES = 120;
const MIN_REMAINING_MS = 1_000;

function createTimerState(durationMs) {
  return {
    isRunning: false,
    remainingMs: durationMs,
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
  };
}

function getPhaseDurationMs(config, state) {
  if (state.isPomodoro && state.pomodoroPhase === 'break') {
    return Math.round((config.pomodoro?.pauseMinutes || 5) * 60_000);
  }
  return config.durationMs;
}

function getPauseDurationMs(config, pauseMinutes = config.pomodoro?.pauseMinutes ?? 5) {
  return Math.round(pauseMinutes * 60_000);
}

function isValidPauseDuration(config, pauseMinutes) {
  const pauseDurationMs = getPauseDurationMs(config, pauseMinutes);
  return Number.isFinite(pauseMinutes)
    && pauseDurationMs >= MIN_REMAINING_MS
    && pauseDurationMs < config.durationMs;
}

function cloneSnapshot(snapshot) {
  return {
    ...snapshot,
    config: {
      ...snapshot.config,
      ...(snapshot.config.pomodoro
        ? { pomodoro: { ...snapshot.config.pomodoro } }
        : {})
    },
    state: { ...snapshot.state }
  };
}

function result(value, completion = null) {
  return { ok: true, value, completion, error: null };
}

function invalid(snapshot, error) {
  return { ok: false, value: cloneSnapshot(snapshot), completion: null, error };
}

function elapsedSinceAnchor(state, now) {
  if (!state.isRunning || state.lastTickTime === null) return 0;
  return Math.max(0, now - state.lastTickTime);
}

function completionFor(snapshot, early) {
  const { state } = snapshot;
  return {
    sequence: state.completionSequence,
    generation: state.transitionGeneration,
    elapsedActiveMs: state.elapsedActiveMs,
    rewardableElapsedMs: Math.min(
      state.elapsedActiveMs,
      getPhaseDurationMs(snapshot.config, state)
    ),
    early
  };
}

function complete(snapshot, early) {
  const value = cloneSnapshot(snapshot);
  value.state.remainingMs = 0;
  value.state.isRunning = false;
  value.state.lastTickTime = null;
  value.state.completionSequence += 1;
  return result(value, completionFor(value, early));
}

function applyTimerAction(snapshot, action, now) {
  const type = action?.type;

  if (type === 'START') {
    if (snapshot.state.isRunning) return result(cloneSnapshot(snapshot));
    const value = cloneSnapshot(snapshot);
    if (value.state.remainingMs <= 50) {
      value.state.remainingMs = getPhaseDurationMs(value.config, value.state);
      value.state.elapsedActiveMs = 0;
    }
    value.state.isRunning = true;
    value.state.hasStarted = true;
    value.state.lastTickTime = now;
    value.state.timerRevision += 1;
    value.state.transitionGeneration += 1;
    return result(value);
  }

  if (type === 'PAUSE') {
    if (!snapshot.state.isRunning) return result(cloneSnapshot(snapshot));
    const value = cloneSnapshot(snapshot);
    const elapsed = elapsedSinceAnchor(value.state, now);
    value.state.elapsedActiveMs += elapsed;
    value.state.remainingMs = Math.max(0, value.state.remainingMs - elapsed);
    value.state.isRunning = false;
    value.state.lastTickTime = null;
    value.state.timerRevision += 1;
    value.state.transitionGeneration += 1;
    return value.state.remainingMs === 0 ? complete(value, false) : result(value);
  }

  if (type === 'RESET') {
    const value = cloneSnapshot(snapshot);
    value.state.remainingMs = getPhaseDurationMs(value.config, value.state);
    value.state.elapsedActiveMs = 0;
    value.state.isRunning = false;
    value.state.hasStarted = false;
    value.state.lastTickTime = null;
    value.state.timerRevision += 1;
    value.state.transitionGeneration += 1;
    return result(value);
  }

  if (type === 'SET_DURATION') {
    const minutes = action.payload;
    if (!Number.isFinite(minutes)
      || minutes < MIN_DURATION_MINUTES || minutes > MAX_DURATION_MINUTES) {
      return invalid(snapshot, 'INVALID_DURATION');
    }
    const nextDurationMs = Math.round(minutes * 60_000);
    if (snapshot.state.isPomodoro) {
      const pauseMinutes = snapshot.config.pomodoro?.pauseMinutes ?? 5;
      if (!isValidPauseDuration({ ...snapshot.config, durationMs: nextDurationMs }, pauseMinutes)) {
        return invalid(snapshot, 'INVALID_PAUSE_DURATION');
      }
    }
    const value = cloneSnapshot(snapshot);
    value.config.durationMs = nextDurationMs;
    value.state.remainingMs = value.config.durationMs;
    value.state.elapsedActiveMs = 0;
    value.state.isRunning = false;
    value.state.hasStarted = false;
    value.state.lastTickTime = null;
    value.state.pomodoroPhase = 'work';
    value.state.timerRevision += 1;
    value.state.transitionGeneration += 1;
    return result(value);
  }

  if (type === 'SET_REMAINING') {
    const remainingMs = action.payload;
    const maximum = getPhaseDurationMs(snapshot.config, snapshot.state);
    if (!Number.isFinite(remainingMs) || !Number.isInteger(remainingMs)
      || remainingMs < MIN_REMAINING_MS || remainingMs > maximum) {
      return invalid(snapshot, 'INVALID_REMAINING');
    }
    const value = cloneSnapshot(snapshot);
    value.state.remainingMs = remainingMs;
    value.state.lastTickTime = value.state.isRunning ? now : null;
    value.state.timerRevision += 1;
    value.state.transitionGeneration += 1;
    return result(value);
  }

  if (type === 'END_EARLY') {
    if (!snapshot.state.isRunning && snapshot.state.remainingMs === 0) {
      return result(cloneSnapshot(snapshot));
    }
    const value = cloneSnapshot(snapshot);
    const elapsed = elapsedSinceAnchor(value.state, now);
    value.state.elapsedActiveMs += elapsed;
    value.state.remainingMs = Math.max(0, value.state.remainingMs - elapsed);
    value.state.isRunning = false;
    value.state.lastTickTime = null;
    value.state.timerRevision += 1;
    value.state.transitionGeneration += 1;
    return complete(value, true);
  }

  if (type === 'SET_POMODORO') {
    const payload = action.payload;
    const enabled = typeof payload === 'object' && payload !== null ? payload.enabled : payload;
    const pauseMinutes = typeof payload === 'object' && payload !== null ? payload.pauseMinutes : undefined;
    if (typeof enabled !== 'boolean') return invalid(snapshot, 'INVALID_POMODORO');
    const effectivePauseMinutes = pauseMinutes ?? snapshot.config.pomodoro?.pauseMinutes ?? 5;
    if (enabled && !isValidPauseDuration(snapshot.config, effectivePauseMinutes)) {
      return invalid(snapshot, 'INVALID_PAUSE_DURATION');
    }
    const value = cloneSnapshot(snapshot);
    if (pauseMinutes !== undefined) {
      value.config.pomodoro = { ...(value.config.pomodoro || {}), pauseMinutes };
    }
    value.state.isPomodoro = enabled;
    value.state.pomodoroPhase = 'work';
    value.state.pomodoroCycles = 0;
    value.state.remainingMs = value.config.durationMs;
    value.state.elapsedActiveMs = 0;
    value.state.isRunning = false;
    value.state.hasStarted = false;
    value.state.lastTickTime = null;
    value.state.timerRevision += 1;
    value.state.transitionGeneration += 1;
    return result(value);
  }

  if (type === 'TOGGLE_AUTO_RESTART') {
    const value = cloneSnapshot(snapshot);
    const requested = typeof action.payload === 'object' && action.payload !== null
      ? action.payload.enabled
      : action.payload;
    value.state.autoRestart = typeof requested === 'boolean'
      ? requested
      : !value.state.autoRestart;
    value.state.timerRevision += 1;
    value.state.transitionGeneration += 1;
    return result(value);
  }

  if (type === 'ADVANCE_POMODORO') {
    if (!snapshot.state.isPomodoro) return invalid(snapshot, 'NOT_POMODORO');
    const value = cloneSnapshot(snapshot);
    const returningToWork = value.state.pomodoroPhase === 'break';
    value.state.pomodoroPhase = returningToWork ? 'work' : 'break';
    if (returningToWork) value.state.pomodoroCycles += 1;
    value.state.remainingMs = getPhaseDurationMs(value.config, value.state);
    value.state.elapsedActiveMs = 0;
    value.state.isRunning = true;
    value.state.hasStarted = true;
    value.state.lastTickTime = now;
    value.state.timerRevision += 1;
    value.state.transitionGeneration += 1;
    return result(value);
  }

  return invalid(snapshot, 'UNKNOWN_ACTION');
}

function tickTimer(snapshot, now) {
  if (!snapshot.state.isRunning) return result(cloneSnapshot(snapshot));
  const elapsed = elapsedSinceAnchor(snapshot.state, now);
  if (elapsed === 0) return result(cloneSnapshot(snapshot));

  const value = cloneSnapshot(snapshot);
  value.state.elapsedActiveMs += elapsed;
  value.state.remainingMs = Math.max(0, value.state.remainingMs - elapsed);
  value.state.lastTickTime = now;
  value.state.timerRevision += 1;

  if (value.state.remainingMs === 0) return complete(value, false);
  return result(value);
}

module.exports = {
  MIN_DURATION_MINUTES,
  MAX_DURATION_MINUTES,
  MIN_REMAINING_MS,
  createTimerState,
  applyTimerAction,
  tickTimer,
  getPhaseDurationMs
};
