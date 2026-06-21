export function scheduleDeferred(callback, timeout = 750) {
  if (typeof window === 'undefined') {
    callback();
    return () => {};
  }

  if ('requestIdleCallback' in window) {
    const id = window.requestIdleCallback(callback, { timeout });
    return () => window.cancelIdleCallback(id);
  }

  const id = window.setTimeout(callback, timeout);
  return () => window.clearTimeout(id);
}
