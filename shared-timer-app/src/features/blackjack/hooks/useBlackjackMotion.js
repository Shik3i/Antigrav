import { useCallback, useEffect, useRef, useState } from 'react';
import * as motionDiffModule from '../utils/motionDiff.cjs';

const diffBlackjackMotion = Reflect.get(motionDiffModule, 'diffBlackjackMotion')
  || Reflect.get(Reflect.get(motionDiffModule, 'default') || {}, 'diffBlackjackMotion');

function createMotionEvent(entry, type, eventIndex) {
  return {
    id: `blackjack-motion-${eventIndex}`,
    type,
    source: entry.source || entry.id,
    target: entry.target,
  };
}

export default function useBlackjackMotion(roomState) {
  const previousRoomStateRef = useRef(null);
  const eventIndexRef = useRef(0);
  const [events, setEvents] = useState([]);

  useEffect(() => {
    const previousRoomState = previousRoomStateRef.current;

    if (previousRoomState) {
      const motion = diffBlackjackMotion(previousRoomState, roomState);
      const nextEvents = [
        ...(motion.deals || []).map((entry) => {
          eventIndexRef.current += 1;
          return createMotionEvent(entry, 'deal', eventIndexRef.current);
        }),
        ...(motion.sideBetDeals || []).map((entry) => {
          eventIndexRef.current += 1;
          return createMotionEvent(entry, 'sidebet-deal', eventIndexRef.current);
        }),
        ...(motion.sideBetResolves || []).map((entry) => {
          eventIndexRef.current += 1;
          return createMotionEvent(entry, 'sidebet-resolve', eventIndexRef.current);
        }),
        ...(motion.discards || []).map((entry) => {
          eventIndexRef.current += 1;
          return createMotionEvent(entry, 'discard', eventIndexRef.current);
        }),
      ];

      if (nextEvents.length) {
        setEvents((currentEvents) => currentEvents.concat(nextEvents));
      }
    }

    previousRoomStateRef.current = roomState || null;
  }, [roomState]);

  const clearEvent = useCallback((eventId) => {
    setEvents((currentEvents) => currentEvents.filter((event) => event.id !== eventId));
  }, []);

  return {
    events,
    clearEvent,
  };
}
