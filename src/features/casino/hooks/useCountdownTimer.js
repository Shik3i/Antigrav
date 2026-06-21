import { useEffect, useState } from 'react';

/**
 * Returns seconds remaining until deadlineMs (epoch ms).
 * Returns null when deadlineMs is falsy. Ticks every second.
 */
export function useCountdownTimer(deadlineMs) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!deadlineMs) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [deadlineMs]);

  if (!deadlineMs) return null;
  return Math.max(0, Math.ceil((deadlineMs - now) / 1000));
}
