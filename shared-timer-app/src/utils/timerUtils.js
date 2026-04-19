/**
 * Utility: Calculates precision remaining ms based on sync state and server offset.
 */
export function getExactRemainingMs(roomState, serverTimeOffset = 0) {
  if (!roomState?.state) return 0;
  if (!roomState.state.isRunning || !roomState.state.lastTickTime) {
    return roomState.state.remainingMs || 0;
  }

  const trueServerTime = Date.now() + serverTimeOffset;
  const elapsedSinceTick = trueServerTime - roomState.state.lastTickTime;
  return Math.max(0, (roomState.state.remainingMs || 0) - elapsedSinceTick);
}

/**
 * Utility: Formats ms to title-compatible string (mm:ss).
 */
export function formatTimerTitle(ms) {
  const totalSeconds = Math.ceil(Math.max(0, ms) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}
