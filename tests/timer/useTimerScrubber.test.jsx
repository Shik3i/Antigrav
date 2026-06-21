// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import EVENTS from '../../socketEvents.json';
import { useTimerScrubber } from '../../src/features/timer/useTimerScrubber';

const rect = { left: 0, top: 0, width: 100, height: 20 };

function pointerEvent(x, pointerId = 1) {
  return {
    clientX: x,
    clientY: 10,
    pointerId,
    preventDefault: vi.fn(),
    currentTarget: {
      getBoundingClientRect: () => rect,
      setPointerCapture: vi.fn(),
      releasePointerCapture: vi.fn()
    }
  };
}

function makeSocket() {
  let acknowledgement;
  return {
    connected: true,
    emit: vi.fn((event, payload, ack) => {
      acknowledgement = ack;
    }),
    acknowledge(value) {
      acknowledgement?.(value);
    }
  };
}

describe('useTimerScrubber', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  test('previews pointer movement locally and commits once on release', () => {
    const socket = makeSocket();
    const { result } = renderHook(() => useTimerScrubber({
      socket,
      roomId: 'room-a',
      mode: 'bar',
      isWriter: true,
      remainingMs: 600_000,
      phaseDurationMs: 600_000
    }));
    act(() => result.current.sliderProps.onPointerDown(pointerEvent(50)));
    act(() => result.current.sliderProps.onPointerMove(pointerEvent(25)));
    expect(result.current.displayRemainingMs).toBe(150_000);
    expect(socket.emit).not.toHaveBeenCalled();

    act(() => result.current.sliderProps.onPointerUp(pointerEvent(25)));
    expect(socket.emit).toHaveBeenCalledTimes(1);
    expect(socket.emit).toHaveBeenCalledWith(
      EVENTS.TIMER_ACTION,
      { roomId: 'room-a', action: 'SET_REMAINING', payload: 150_000 },
      expect.any(Function)
    );
  });

  test('rolls preview back on rejection, timeout, and disconnect', () => {
    const socket = makeSocket();
    const { result, rerender } = renderHook(
      props => useTimerScrubber(props),
      { initialProps: {
        socket, roomId: 'room-a', mode: 'bar', isWriter: true,
        remainingMs: 600_000, phaseDurationMs: 600_000, isConnected: true
      } }
    );
    act(() => result.current.sliderProps.onPointerDown(pointerEvent(50)));
    act(() => result.current.sliderProps.onPointerUp(pointerEvent(50)));
    act(() => socket.acknowledge({ ok: false, error: 'FORBIDDEN' }));
    expect(result.current.displayRemainingMs).toBe(600_000);

    act(() => result.current.sliderProps.onPointerDown(pointerEvent(25)));
    act(() => result.current.sliderProps.onPointerUp(pointerEvent(25)));
    act(() => vi.advanceTimersByTime(5_000));
    expect(result.current.displayRemainingMs).toBe(600_000);

    act(() => result.current.sliderProps.onPointerDown(pointerEvent(75)));
    rerender({
      socket, roomId: 'room-a', mode: 'bar', isWriter: true,
      remainingMs: 600_000, phaseDurationMs: 600_000, isConnected: false
    });
    expect(result.current.displayRemainingMs).toBe(600_000);
  });

  test('exposes accessible keyboard control only to writers', () => {
    const socket = makeSocket();
    const { result, rerender } = renderHook(
      props => useTimerScrubber(props),
      { initialProps: {
        socket, roomId: 'room-a', mode: 'bar', isWriter: true,
        remainingMs: 10_000, phaseDurationMs: 600_000
      } }
    );
    expect(result.current.sliderProps).toMatchObject({
      role: 'slider', tabIndex: 0, 'aria-valuemin': 1, 'aria-valuemax': 600
    });
    const event = { key: 'ArrowRight', preventDefault: vi.fn() };
    act(() => result.current.sliderProps.onKeyDown(event));
    expect(event.preventDefault).toHaveBeenCalled();
    expect(socket.emit).toHaveBeenCalledWith(
      EVENTS.TIMER_ACTION,
      { roomId: 'room-a', action: 'SET_REMAINING', payload: 11_000 },
      expect.any(Function)
    );

    rerender({
      socket, roomId: 'room-a', mode: 'bar', isWriter: false,
      remainingMs: 10_000, phaseDurationMs: 600_000
    });
    expect(result.current.sliderProps).toEqual({});
  });
});
