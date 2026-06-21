const roomManager = require('../../roomManager');

describe('roomManager timer facade', () => {
  const roomId = 'timer-facade-room';

  afterEach(() => {
    roomManager.rooms.delete(roomId);
    vi.restoreAllMocks();
  });

  test('initializes canonical timer state without losing room workspace state', () => {
    const room = roomManager.createRoom(roomId, 'Timer', 20);
    expect(room.state).toMatchObject({
      remainingMs: 20 * 60_000,
      timerRevision: 0,
      transitionGeneration: 0,
      completionSequence: 0,
      elapsedActiveMs: 0,
      todos: [],
      canvasLines: [],
      eventHistory: []
    });
  });

  test('missing-room timer mutations return false instead of throwing', () => {
    expect(roomManager.startTimer('missing')).toBe(false);
    expect(roomManager.pauseTimer('missing')).toBe(false);
    expect(roomManager.resetTimer('missing')).toBe(false);
    expect(roomManager.setDuration('missing', 20)).toBe(false);
  });

  test('getRoomState serializes without mutating the timer anchor', () => {
    roomManager.createRoom(roomId, 'Timer', 20);
    roomManager.startTimer(roomId, 1_000);
    const before = structuredClone(roomManager.getRoom(roomId).state);
    roomManager.getRoomState(roomId);
    expect(roomManager.getRoom(roomId).state).toEqual(before);
  });

  test('delegates remaining changes while preserving run state', () => {
    roomManager.createRoom(roomId, 'Timer', 20);
    roomManager.startTimer(roomId, 1_000);
    const result = roomManager.setRemaining(roomId, 300_000, 2_000);
    expect(result.ok).toBe(true);
    expect(roomManager.getRoom(roomId).state).toMatchObject({
      isRunning: true,
      remainingMs: 300_000,
      lastTickTime: 2_000
    });
  });

  test('tick returns one room-scoped completion descriptor', () => {
    roomManager.createRoom(roomId, 'Timer', 1 / 60);
    roomManager.startTimer(roomId, 1_000);
    const first = roomManager.tick(2_100);
    const second = roomManager.tick(3_000);
    expect(first).toHaveLength(1);
    expect(first[0]).toMatchObject({
      room: { id: roomId },
      completion: { sequence: 1, early: false }
    });
    expect(second).toEqual([]);
  });

  test('Pomodoro facade retains names and returns the advanced phase', () => {
    roomManager.createRoom(roomId, 'Timer', 20);
    expect(roomManager.togglePomodoro(roomId, true, 5, 'Work', 'Rest')).toBe(true);
    expect(roomManager.getRoom(roomId).config.pomodoro).toMatchObject({
      pauseMinutes: 5,
      workName: 'Work',
      breakName: 'Rest'
    });
    expect(roomManager.advancePomodoro(roomId, 1_000)).toBe('break');
  });
});
