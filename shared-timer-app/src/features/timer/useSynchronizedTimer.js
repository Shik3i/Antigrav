import { useEffect, useMemo, useRef, useState } from 'react';
import EVENTS from '../../../socketEvents.json';
import {
  formatTimerTitle,
  getExactRemainingMs,
  getTimerPresentation
} from './timerSelectors';

export function useSynchronizedTimer({ roomState, socket, serverTimeOffset = 0, onCompleted }) {
  const [remainingMs, setRemainingMs] = useState(() => (
    getExactRemainingMs(roomState, serverTimeOffset)
  ));
  const [showConfetti, setShowConfetti] = useState(false);
  const animationRef = useRef(null);
  const confettiTimeoutRef = useRef(null);
  const onCompletedRef = useRef(onCompleted);
  onCompletedRef.current = onCompleted;

  useEffect(() => {
    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    if (!roomState) {
      setRemainingMs(0);
      return undefined;
    }

    const update = () => {
      const next = getExactRemainingMs(roomState, serverTimeOffset);
      setRemainingMs(next);
      if (roomState.state.isRunning && next > 0) {
        animationRef.current = requestAnimationFrame(update);
      }
    };
    update();

    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [roomState, serverTimeOffset]);

  useEffect(() => {
    if (!socket) return undefined;
    const handleCompleted = payload => {
      setRemainingMs(0);
      setShowConfetti(true);
      if (confettiTimeoutRef.current !== null) clearTimeout(confettiTimeoutRef.current);
      confettiTimeoutRef.current = setTimeout(() => {
        confettiTimeoutRef.current = null;
        setShowConfetti(false);
      }, 4_000);
      onCompletedRef.current?.(payload);
    };
    socket.on(EVENTS.TIMER_COMPLETED, handleCompleted);
    return () => {
      socket.off(EVENTS.TIMER_COMPLETED, handleCompleted);
      if (confettiTimeoutRef.current !== null) {
        clearTimeout(confettiTimeoutRef.current);
        confettiTimeoutRef.current = null;
      }
    };
  }, [socket]);

  const presentation = useMemo(() => {
    const base = getTimerPresentation({ roomState, serverTimeOffset });
    const progress = base.phaseDurationMs > 0
      ? Math.max(0, Math.min(1, remainingMs / base.phaseDurationMs))
      : 0;
    return {
      ...base,
      remainingMs,
      progress,
      formattedTime: formatTimerTitle(remainingMs),
      phaseText: remainingMs === 0 && !roomState?.state?.isRunning ? 'Done' : base.phaseText
    };
  }, [remainingMs, roomState, serverTimeOffset]);

  return { remainingMs, showConfetti, presentation };
}
