import { useEffect, useState } from 'react';
export function useBlackjackTimers(roomState) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const defaultTurnSeconds = Math.round((roomState?.timerConfig?.turnTimeoutMs || 90000) / 1000);
  const turnCountdownSeconds = !roomState?.turnDeadlineAt || roomState?.status !== 'player_turns'
    ? defaultTurnSeconds
    : Math.max(0, Math.ceil((roomState.turnDeadlineAt - now) / 1000));

  const autoStartSeconds = !roomState?.autoStartAt || !['waiting', 'betting'].includes(roomState?.status)
    ? null
    : Math.max(0, Math.ceil((roomState.autoStartAt - now) / 1000));

  return {
    autoStartSeconds,
    now,
    turnCountdownSeconds
  };
}
