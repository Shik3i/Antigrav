import { getTimerToken } from './clientStorage';

export async function fetchJson(url, options = {}) {
  const headers = new Headers(options.headers || {});
  const hasBody = options.body !== undefined;
  const token = options.token ?? getTimerToken();

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
    throw new Error(data?.error || `Request failed: ${response.status}`);
  }

  return data;
}
