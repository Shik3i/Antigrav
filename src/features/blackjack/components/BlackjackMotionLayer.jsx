import { useEffect, useLayoutEffect, useRef, useState } from 'react';

const CARD_WIDTH = 58;
const CARD_HEIGHT = 84;
const CHIP_SIZE = 34;
const DEAL_DURATION_MS = 850;
const DISCARD_DURATION_MS = 1000;
const SIDEBET_DEAL_DURATION_MS = 700;
const SIDEBET_RESOLVE_DURATION_MS = 820;
const REDUCED_DEAL_DURATION_MS = 480;
const REDUCED_DISCARD_DURATION_MS = 640;
const REDUCED_SIDEBET_DEAL_DURATION_MS = 380;
const REDUCED_SIDEBET_RESOLVE_DURATION_MS = 460;

function isSideBetEvent(type) {
  return type === 'sidebet-deal' || type === 'sidebet-resolve';
}

function getFlightDuration(type, prefersReducedMotion) {
  if (type === 'sidebet-deal') {
    return prefersReducedMotion ? REDUCED_SIDEBET_DEAL_DURATION_MS : SIDEBET_DEAL_DURATION_MS;
  }

  if (type === 'sidebet-resolve') {
    return prefersReducedMotion ? REDUCED_SIDEBET_RESOLVE_DURATION_MS : SIDEBET_RESOLVE_DURATION_MS;
  }

  if (type === 'discard') {
    return prefersReducedMotion ? REDUCED_DISCARD_DURATION_MS : DISCARD_DURATION_MS;
  }

  return prefersReducedMotion ? REDUCED_DEAL_DURATION_MS : DEAL_DURATION_MS;
}

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => (
    typeof window !== 'undefined'
      && typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ));

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined;
    }

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleChange = () => setPrefersReducedMotion(mediaQuery.matches);

    handleChange();
    mediaQuery.addEventListener('change', handleChange);

    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return prefersReducedMotion;
}

function resolveAnchorElement(anchorId) {
  if (!anchorId || typeof document === 'undefined') {
    return null;
  }

  return document.querySelector(`[data-bj-anchor="${anchorId}"]`);
}

function toFlightRect(rect) {
  return toSizedFlightRect(rect, CARD_WIDTH, CARD_HEIGHT);
}

function toSizedFlightRect(rect, width, height) {
  return {
    left: rect.left + ((rect.width - width) / 2),
    top: rect.top + ((rect.height - height) / 2),
    width,
    height,
  };
}

function buildRenderedEvents(events, prefersReducedMotion) {
  return events
    .map((event) => {
      const sourceElement = resolveAnchorElement(event.source);
      const targetElement = resolveAnchorElement(event.target);

      if (!sourceElement || !targetElement) {
        return null;
      }

      const usesChipFlight = isSideBetEvent(event.type);
      const from = usesChipFlight
        ? toSizedFlightRect(sourceElement.getBoundingClientRect(), CHIP_SIZE, CHIP_SIZE)
        : toFlightRect(sourceElement.getBoundingClientRect());
      const to = usesChipFlight
        ? toSizedFlightRect(targetElement.getBoundingClientRect(), CHIP_SIZE, CHIP_SIZE)
        : toFlightRect(targetElement.getBoundingClientRect());

      return {
        ...event,
        flightClassName: usesChipFlight ? 'blackjack-flight-chip' : 'blackjack-flight-card',
        from,
        to,
        duration: getFlightDuration(event.type, prefersReducedMotion),
      };
    })
    .filter(Boolean);
}

export default function BlackjackMotionLayer({ events, clearEvent }) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [renderedEvents, setRenderedEvents] = useState([]);
  const timeoutIdsRef = useRef(new Map());

  useLayoutEffect(() => {
    setRenderedEvents(buildRenderedEvents(events, prefersReducedMotion));
  }, [events, prefersReducedMotion]);

  useEffect(() => {
    const activeEventIds = new Set(events.map((event) => event.id));

    events.forEach((event) => {
      if (timeoutIdsRef.current.has(event.id)) {
        return;
      }

      const timeoutId = window.setTimeout(() => {
        timeoutIdsRef.current.delete(event.id);
        clearEvent(event.id);
      }, getFlightDuration(event.type, prefersReducedMotion));

      timeoutIdsRef.current.set(event.id, timeoutId);
    });

    timeoutIdsRef.current.forEach((timeoutId, eventId) => {
      if (activeEventIds.has(eventId)) return;
      window.clearTimeout(timeoutId);
      timeoutIdsRef.current.delete(eventId);
    });
  }, [clearEvent, events, prefersReducedMotion]);

  useEffect(() => () => {
    timeoutIdsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    timeoutIdsRef.current.clear();
  }, []);

  return (
    <div className="blackjack-motion-layer" aria-hidden="true">
      {renderedEvents.map((event) => (
        <div
          key={event.id}
          className={`${event.flightClassName} is-${event.type}`}
          style={{
            left: `${event.from.left}px`,
            top: `${event.from.top}px`,
            width: `${event.from.width}px`,
            height: `${event.from.height}px`,
            '--flight-duration': `${event.duration}ms`,
            '--flight-x': `${event.to.left - event.from.left}px`,
            '--flight-y': `${event.to.top - event.from.top}px`,
          }}
        />
      ))}
    </div>
  );
}
