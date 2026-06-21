// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen, cleanup } from '@testing-library/react';
import Timer from '../../src/components/Timer';
import EVENTS from '../../socketEvents.json';

const setUser = vi.fn();
vi.mock('../../src/context/AuthContext', () => ({ useAuth: () => ({ setUser }) }));
vi.mock('../../src/utils/soundGenerator', () => ({
  ALARM_SOUNDS: { CLASSIC_BEEP: 'classic' },
  playAlarmSound: vi.fn()
}));

function makeSocket() {
  return {
    connected: true,
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn()
  };
}

function makeRoom(isRunning = false) {
  return {
    id: 'room-a',
    config: { durationMs: 600_000, name: 'Focus' },
    state: {
      isRunning,
      remainingMs: 600_000,
      lastTickTime: isRunning ? Date.now() : null,
      timerRevision: 1,
      isPomodoro: false,
      pomodoroPhase: 'work',
      autoRestart: false
    }
  };
}

describe('Timer', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    vi.stubGlobal('confirm', vi.fn(() => true));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  test.each(['circle', 'bar', 'minimal', 'dots', 'battery', 'hourglass', 'ring'])(
    '%s exposes one writer-only remaining-time slider',
    mode => {
      const socket = makeSocket();
      const user = { preferences: { timerVisual: mode } };
      const { unmount } = render(
        <Timer roomState={makeRoom()} socket={socket} roomId="room-a" userRole="write" user={user} />
      );
      const slider = screen.getByRole('slider', { name: /remaining time/i });
      expect(slider.getAttribute('data-timer-mode')).toBe(mode);
      expect(slider.getAttribute('aria-valuemin')).toBe('1');
      unmount();
    }
  );

  test('readers receive the selected visual without slider semantics', () => {
    render(
      <Timer
        roomState={makeRoom()}
        socket={makeSocket()}
        roomId="room-a"
        userRole="read"
        user={{ preferences: { timerVisual: 'ring' } }}
      />
    );
    expect(screen.queryByRole('slider')).toBeNull();
    expect(document.querySelector('[data-timer-mode="ring"]')).toBeTruthy();
  });

  test('confirmed early completion emits exactly once', () => {
    const socket = makeSocket();
    render(
      <Timer
        roomState={makeRoom(true)}
        socket={socket}
        roomId="room-a"
        userRole="write"
        user={{ preferences: { timerVisual: 'bar' } }}
      />
    );
    fireEvent.click(screen.getByTitle('Timer sofort beenden'));
    const earlyCalls = socket.emit.mock.calls.filter(([, payload]) => payload?.action === 'END_EARLY');
    expect(earlyCalls).toHaveLength(1);
    expect(earlyCalls[0][0]).toBe(EVENTS.TIMER_ACTION);
  });
});
