import { useEffect, useState } from 'react';
import { TURN_TIMEOUT_SECONDS } from '../utils/formatters';

export function useBlackjackTimers(roomState) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const turnCountdownSeconds = !roomState?.turnDeadlineAt || roomState?.status !== 'player_turns'
    ? TURN_TIMEOUT_SECONDS
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
