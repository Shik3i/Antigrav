import { useEffect, useState } from 'react';
import { useCountdownTimer } from '../../casino/hooks/useCountdownTimer';

export function useBlackjackTimers(roomState) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const defaultTurnSeconds = Math.round((roomState?.timerConfig?.turnTimeoutMs || 90000) / 1000);

  const turnDeadline = roomState?.status === 'player_turns' ? roomState?.turnDeadlineAt : null;
  const turnCountdown = useCountdownTimer(turnDeadline);
  const turnCountdownSeconds = turnCountdown ?? defaultTurnSeconds;

  const autoStartDeadline = ['waiting', 'betting'].includes(roomState?.status) ? roomState?.autoStartAt : null;
  const autoStartSeconds = useCountdownTimer(autoStartDeadline);

  return { autoStartSeconds, now, turnCountdownSeconds };
}
