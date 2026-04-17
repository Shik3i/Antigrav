export function getStoredValue(key, fallback = null) {
  try {
    const value = localStorage.getItem(key);
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

export function setStoredValue(key, value) {
  try {
    if (value === null || value === undefined) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, value);
    }
  } catch {
    // Ignore storage failures in private mode or restricted contexts.
  }
}

export function getTimerToken() {
  return getStoredValue('timerToken', '');
}

export function isLiveStreamWidgetVisible() {
  return getStoredValue('hideLiveStreamWidget', 'false') !== 'true';
}

export function setLiveStreamWidgetVisibility(isVisible) {
  setStoredValue('hideLiveStreamWidget', isVisible ? 'false' : 'true');
}
