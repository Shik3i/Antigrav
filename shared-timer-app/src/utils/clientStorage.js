export const AUTH_SESSION_INVALIDATED_EVENT = 'auth-session-invalidated';

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

export function clearStoredAuth() {
  try {
    localStorage.removeItem('timerToken');
    localStorage.removeItem('timerAuthUser');
  } catch {
    // Ignore storage failures in private mode or restricted contexts.
  }
}

export function notifyInvalidSession(message = 'Deine Sitzung war nicht mehr gueltig. Bitte logge dich erneut ein.') {
  if (typeof window === 'undefined') return;

  window.dispatchEvent(new CustomEvent(AUTH_SESSION_INVALIDATED_EVENT, {
    detail: { message }
  }));
}

export function isLiveStreamWidgetVisible() {
  return getStoredValue('hideLiveStreamWidget', 'false') !== 'true';
}

export function setLiveStreamWidgetVisibility(isVisible) {
  setStoredValue('hideLiveStreamWidget', isVisible ? 'false' : 'true');
}
