const CIRCULAR_MODES = new Set(['circle', 'dots', 'ring']);
const HORIZONTAL_MODES = new Set(['bar', 'battery', 'minimal']);

function clamp(value, minimum = 0, maximum = 1) {
  return Math.max(minimum, Math.min(maximum, value));
}

export function pointerToProgress(mode, point, rect) {
  if (CIRCULAR_MODES.has(mode)) {
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const angle = Math.atan2(point.x - centerX, centerY - point.y);
    const clockwise = angle < 0 ? angle + Math.PI * 2 : angle;
    return clockwise === 0 ? 1 : clockwise / (Math.PI * 2);
  }
  if (HORIZONTAL_MODES.has(mode)) {
    return clamp((point.x - rect.left) / rect.width);
  }
  if (mode === 'hourglass') {
    return clamp(1 - ((point.y - rect.top) / rect.height));
  }
  return 0;
}

export function progressToRemainingMs(progress, phaseDurationMs) {
  const maximum = Math.max(1_000, Math.round(phaseDurationMs));
  const quantized = Math.round((clamp(progress) * maximum) / 1_000) * 1_000;
  return clamp(quantized, 1_000, maximum);
}

export function applyKeyboardStep(key, currentMs, phaseDurationMs) {
  const maximum = Math.max(1_000, Math.round(phaseDurationMs));
  const steps = {
    ArrowRight: 1_000,
    ArrowUp: 1_000,
    ArrowLeft: -1_000,
    ArrowDown: -1_000,
    PageUp: 60_000,
    PageDown: -60_000
  };
  if (key === 'Home') return 1_000;
  if (key === 'End') return maximum;
  if (!Object.prototype.hasOwnProperty.call(steps, key)) return null;
  return clamp(Math.round(currentMs) + steps[key], 1_000, maximum);
}
