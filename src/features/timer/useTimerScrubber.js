import { useEffect, useMemo, useRef, useState } from 'react';
import EVENTS from '../../../socketEvents.json';
import {
  applyKeyboardStep,
  pointerToProgress,
  progressToRemainingMs
} from './scrubberGeometry';

export function useTimerScrubber({
  socket,
  roomId,
  mode,
  isWriter,
  remainingMs,
  phaseDurationMs,
  isConnected = socket?.connected !== false
}) {
  const [previewRemainingMs, setPreviewRemainingMs] = useState(null);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const activePointerRef = useRef(null);
  const acknowledgementTimeoutRef = useRef(null);

  const clearAcknowledgementTimeout = () => {
    if (acknowledgementTimeoutRef.current !== null) {
      clearTimeout(acknowledgementTimeoutRef.current);
      acknowledgementTimeoutRef.current = null;
    }
  };

  const rollback = () => {
    clearAcknowledgementTimeout();
    activePointerRef.current = null;
    setIsScrubbing(false);
    setPreviewRemainingMs(null);
  };

  useEffect(() => {
    if (!isConnected || !isWriter) rollback();
  }, [isConnected, isWriter]);

  useEffect(() => () => clearAcknowledgementTimeout(), []);

  const valueFromPointer = event => {
    const rect = event.currentTarget.getBoundingClientRect();
    const progress = pointerToProgress(mode, { x: event.clientX, y: event.clientY }, rect);
    return progressToRemainingMs(progress, phaseDurationMs);
  };

  const commit = value => {
    if (!isWriter || !isConnected || !socket) {
      rollback();
      return;
    }
    clearAcknowledgementTimeout();
    acknowledgementTimeoutRef.current = setTimeout(rollback, 5_000);
    socket.emit(
      EVENTS.TIMER_ACTION,
      { roomId, action: 'SET_REMAINING', payload: value },
      response => {
        clearAcknowledgementTimeout();
        if (!response?.ok) {
          rollback();
          return;
        }
        setPreviewRemainingMs(null);
      }
    );
  };

  const sliderProps = useMemo(() => {
    if (!isWriter) return {};
    return {
      role: 'slider',
      tabIndex: 0,
      'aria-label': 'Remaining time',
      'aria-valuemin': 1,
      'aria-valuemax': Math.round(phaseDurationMs / 1_000),
      'aria-valuenow': Math.round((previewRemainingMs ?? remainingMs) / 1_000),
      onPointerDown: event => {
        event.preventDefault();
        event.currentTarget.setPointerCapture?.(event.pointerId);
        activePointerRef.current = event.pointerId;
        setIsScrubbing(true);
        setPreviewRemainingMs(valueFromPointer(event));
      },
      onPointerMove: event => {
        if (!isScrubbing || activePointerRef.current !== event.pointerId) return;
        setPreviewRemainingMs(valueFromPointer(event));
      },
      onPointerUp: event => {
        if (activePointerRef.current !== event.pointerId) return;
        const value = valueFromPointer(event);
        event.currentTarget.releasePointerCapture?.(event.pointerId);
        activePointerRef.current = null;
        setIsScrubbing(false);
        setPreviewRemainingMs(value);
        commit(value);
      },
      onPointerCancel: rollback,
      onKeyDown: event => {
        const value = applyKeyboardStep(
          event.key,
          previewRemainingMs ?? remainingMs,
          phaseDurationMs
        );
        if (value === null) return;
        event.preventDefault();
        setPreviewRemainingMs(value);
        commit(value);
      }
    };
  }, [isWriter, isScrubbing, previewRemainingMs, remainingMs, phaseDurationMs, mode, socket, roomId, isConnected]);

  return {
    displayRemainingMs: previewRemainingMs ?? remainingMs,
    previewRemainingMs,
    isScrubbing,
    sliderProps
  };
}
