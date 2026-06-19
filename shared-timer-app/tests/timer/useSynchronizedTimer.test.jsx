// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import EVENTS from '../../socketEvents.json';
import { useSynchronizedTimer } from '../../src/features/timer/useSynchronizedTimer';

function createSocket() {
  const listeners = new Map();
  return {
    on: vi.fn((event, handler) => listeners.set(event, handler)),
    off: vi.fn((event, handler) => {
      if (listeners.get(event) === handler) listeners.delete(event);
    }),
    trigger(event, payload) {
      listeners.get(event)?.(payload);
    }
  };
}

function makeRoom(overrides = {}) {
  return {
    config: { durationMs: 600_000 },
    state: {
      isRunning: false,
      remainingMs: 600_000,
      lastTickTime: null,
      timerRevision: 1,
      isPomodoro: false,
      pomodoroPhase: 'work',
      ...overrides
    }
  };
}

describe('useSynchronizedTimer', () => {
  let callbacks;

  beforeEach(() => {
    vi.useFakeTimers();
    callbacks = new Map();
    let nextId = 1;
    vi.stubGlobal('requestAnimationFrame', vi.fn(callback => {
      const id = nextId++;
      callbacks.set(id, callback);
      return id;
    }));
    vi.stubGlobal('cancelAnimationFrame', vi.fn(id => callbacks.delete(id)));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  test('recalibrates from authoritative snapshots and cancels animation on pause', () => {
    vi.spyOn(Date, 'now').mockReturnValue(2_000);
    const socket = createSocket();
    const { result, rerender } = renderHook(
      props => useSynchronizedTimer(props),
      { initialProps: { roomState: makeRoom(), socket, serverTimeOffset: 0 } }
    );
    expect(result.current.remainingMs).toBe(600_000);

    rerender({
      roomState: makeRoom({ isRunning: true, lastTickTime: 1_000, timerRevision: 2 }),
      socket,
      serverTimeOffset: 0
    });
    expect(result.current.remainingMs).toBe(599_000);
    expect(requestAnimationFrame).toHaveBeenCalled();

    rerender({ roomState: makeRoom({ remainingMs: 400_000, timerRevision: 3 }), socket, serverTimeOffset: 0 });
    expect(result.current.remainingMs).toBe(400_000);
    expect(cancelAnimationFrame).toHaveBeenCalled();
  });

  test('keeps one stable completion listener and cleans every side effect', () => {
    const socket = createSocket();
    const onCompleted = vi.fn();
    const { result, rerender, unmount } = renderHook(
      props => useSynchronizedTimer(props),
      { initialProps: { roomState: makeRoom({ isRunning: true, lastTickTime: Date.now() }), socket, onCompleted } }
    );
    rerender({ roomState: makeRoom({ isRunning: true, lastTickTime: Date.now(), timerRevision: 2 }), socket, onCompleted });
    expect(socket.on).toHaveBeenCalledTimes(1);

    act(() => socket.trigger(EVENTS.TIMER_COMPLETED, { sequence: 1 }));
    expect(result.current.remainingMs).toBe(0);
    expect(result.current.showConfetti).toBe(true);
    expect(onCompleted).toHaveBeenCalledWith({ sequence: 1 });

    unmount();
    expect(socket.off).toHaveBeenCalledWith(EVENTS.TIMER_COMPLETED, expect.any(Function));
    expect(cancelAnimationFrame).toHaveBeenCalled();
    act(() => vi.runAllTimers());
  });
});
