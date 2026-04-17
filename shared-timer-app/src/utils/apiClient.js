import { clearStoredAuth, getTimerToken, notifyInvalidSession } from './clientStorage';

export async function fetchJson(url, options = {}) {
  const headers = new Headers(options.headers || {});
  const hasBody = options.body !== undefined;
  const token = options.token ?? getTimerToken();
  const usedAuthToken = Boolean(token);

  if (hasBody && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(url, {
    ...options,
    headers
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    // If a stored session is no longer valid, clear it once so the client
    // stops replaying the same broken token on every authenticated request.
    if (response.status === 401 && usedAuthToken) {
      clearStoredAuth();
      notifyInvalidSession();
    }

    const error = new Error(data?.error || `Request failed: ${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}
