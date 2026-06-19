export function getExactRemainingMs(roomState, serverTimeOffset = 0, now = Date.now()) {
  if (!roomState?.state) return 0;
  const stored = Number.isFinite(roomState.state.remainingMs) ? roomState.state.remainingMs : 0;
  if (!roomState.state.isRunning || roomState.state.lastTickTime === null) {
    return Math.max(0, stored);
  }
  const elapsed = Math.max(0, now + serverTimeOffset - roomState.state.lastTickTime);
  return Math.max(0, stored - elapsed);
}

export function formatTimerTitle(ms) {
  const totalSeconds = Math.ceil(Math.max(0, ms) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

export function getPhaseDurationMs(roomState) {
  if (roomState?.state?.isPomodoro && roomState.state.pomodoroPhase === 'break') {
    return Math.round((roomState.config?.pomodoro?.pauseMinutes ?? 5) * 60_000);
  }
  return roomState?.config?.durationMs || 0;
}

export function getTimerPresentation({ roomState, serverTimeOffset = 0, now = Date.now() }) {
  const remainingMs = getExactRemainingMs(roomState, serverTimeOffset, now);
  const phase = roomState?.state?.isPomodoro && roomState.state.pomodoroPhase === 'break'
    ? 'break'
    : 'work';
  const phaseDurationMs = getPhaseDurationMs(roomState);
  const progress = phaseDurationMs > 0
    ? Math.max(0, Math.min(1, remainingMs / phaseDurationMs))
    : 0;
  const phaseName = phase === 'break'
    ? (roomState?.config?.pomodoro?.breakName || 'Rest')
    : (roomState?.config?.pomodoro?.workName || 'Focusing');
  const phaseText = roomState?.state?.isRunning
    ? phaseName
    : (remainingMs === 0 ? 'Done' : `Paused (${phaseName})`);
  return {
    remainingMs,
    phase,
    phaseText,
    phaseDurationMs,
    progress,
    formattedTime: formatTimerTitle(remainingMs)
  };
}

export function isStaleTimerSnapshot(current, incoming) {
  if (!current?.state || !incoming?.state) return false;
  const currentRevision = Number(current.state.timerRevision) || 0;
  const incomingRevision = Number(incoming.state.timerRevision) || 0;
  return incomingRevision < currentRevision;
}

export function getCurrentRoomMember(roomState, userId, socketId) {
  const users = roomState?.users || [];
  if (socketId) {
    return users.find(user => user.socketId === socketId) || null;
  }
  return users.find(user => user.userId === userId || user.id === userId) || null;
}
