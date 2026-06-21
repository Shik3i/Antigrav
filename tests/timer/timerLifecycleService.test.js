const EVENTS = require('../../socketEvents.json');
const { createTimerLifecycleService } = require('../../services/timerLifecycleService');

function makeHarness({ pomodoro = false, autoRestart = true } = {}) {
  const emit = vi.fn();
  const room = {
    id: 'room-a',
    config: { name: 'Focus', durationMs: 60_000 },
    state: {
      isPomodoro: pomodoro,
      autoRestart,
      transitionGeneration: 3,
      completionSequence: 1,
      stats: { totalCompletions: 0, userCompletions: {} }
    },
    users: new Map([
      ['socket-a', { socketId: 'socket-a', userId: 'user-1', displayName: 'One' }],
      ['socket-b', { socketId: 'socket-b', userId: 'user-1', displayName: 'One duplicate' }]
    ])
  };
  const roomManager = {
    rooms: new Map([[room.id, room]]),
    getRoom: vi.fn(() => room),
    getRoomState: vi.fn(() => ({ id: room.id, state: { ...room.state } })),
    addEvent: vi.fn(() => ({ type: 'action', message: 'Timer reached 0!' })),
    resetTimer: vi.fn(() => true),
    startTimer: vi.fn(() => true),
    advancePomodoro: vi.fn(() => 'break')
  };
  const dbLayer = {
    getKoalaBaseline: vi.fn(async () => ({ koala_points_per_hour: 6000 })),
    addUser: vi.fn(async () => undefined),
    recordTimerCompletion: vi.fn(async () => undefined),
    addKoalaCoins: vi.fn(async () => 1234)
  };
  const io = { to: vi.fn(() => ({ emit })) };
  const broadcastCoinUpdate = vi.fn();
  const onPersistenceError = vi.fn();
  const service = createTimerLifecycleService({
    io, roomManager, dbLayer, broadcastCoinUpdate, onPersistenceError
  });
  return {
    service, room, roomManager, dbLayer, io, emit, broadcastCoinUpdate, onPersistenceError
  };
}

describe('timerLifecycleService', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  test('processes one completion exactly once for duplicate calls and duplicate user tabs', async () => {
    const h = makeHarness({ autoRestart: false });
    const completion = { roomId: 'room-a', sequence: 1, generation: 3, rewardableElapsedMs: 60_000 };
    await Promise.all([
      h.service.handleCompletion(h.room, completion),
      h.service.handleCompletion(h.room, completion)
    ]);
    expect(h.emit).toHaveBeenCalledWith(EVENTS.TIMER_COMPLETED, expect.objectContaining({ roomId: 'room-a', sequence: 1 }));
    expect(h.dbLayer.recordTimerCompletion).toHaveBeenCalledTimes(1);
    expect(h.dbLayer.addKoalaCoins).toHaveBeenCalledTimes(1);
    expect(h.room.state.stats).toEqual({ totalCompletions: 1, userCompletions: { 'user-1': 1 } });
  });

  test('contains persistence failures after completing timer state', async () => {
    const h = makeHarness({ autoRestart: false });
    const error = new Error('database unavailable');
    h.dbLayer.getKoalaBaseline.mockRejectedValueOnce(error);

    await expect(h.service.handleCompletion(h.room, {
      roomId: 'room-a', sequence: 1, generation: 3, rewardableElapsedMs: 60_000
    })).resolves.toBe(true);

    expect(h.onPersistenceError).toHaveBeenCalledWith(error, { roomId: 'room-a', sequence: 1 });
    expect(h.emit).toHaveBeenCalledWith(
      EVENTS.TIMER_COMPLETED,
      expect.objectContaining({ roomId: 'room-a', sequence: 1 })
    );
  });

  test('contains synchronous persistence error reporter failures', async () => {
    const h = makeHarness({ autoRestart: false });
    h.dbLayer.getKoalaBaseline.mockRejectedValueOnce(new Error('database unavailable'));
    h.onPersistenceError.mockImplementationOnce(() => {
      throw new Error('reporter unavailable');
    });

    await expect(h.service.handleCompletion(h.room, {
      roomId: 'room-a', sequence: 1, generation: 3, rewardableElapsedMs: 60_000
    })).resolves.toBe(true);
  });

  test('contains asynchronous persistence error reporter failures', async () => {
    const h = makeHarness({ autoRestart: false });
    h.dbLayer.getKoalaBaseline.mockRejectedValueOnce(new Error('database unavailable'));
    const reporterResult = Promise.reject(new Error('reporter unavailable'));
    const catchSpy = vi.spyOn(reporterResult, 'catch');
    h.onPersistenceError.mockReturnValueOnce(reporterResult);

    await expect(h.service.handleCompletion(h.room, {
      roomId: 'room-a', sequence: 1, generation: 3, rewardableElapsedMs: 60_000
    })).resolves.toBe(true);
    const rejectionWasConsumed = catchSpy.mock.calls.length > 0;
    if (!rejectionWasConsumed) await reporterResult.catch(() => {});
    expect(rejectionWasConsumed).toBe(true);
  });

  test('runs auto-restart only while the captured generation is current', async () => {
    const h = makeHarness();
    await h.service.handleCompletion(h.room, {
      roomId: 'room-a', sequence: 1, generation: 3, rewardableElapsedMs: 60_000
    });
    await vi.advanceTimersByTimeAsync(3_000);
    expect(h.roomManager.resetTimer).toHaveBeenCalledTimes(1);
    expect(h.roomManager.startTimer).toHaveBeenCalledTimes(1);

    h.room.state.completionSequence = 2;
    h.room.state.transitionGeneration = 4;
    await h.service.handleCompletion(h.room, {
      roomId: 'room-a', sequence: 2, generation: 4, rewardableElapsedMs: 60_000
    });
    h.room.state.transitionGeneration = 5;
    await vi.advanceTimersByTimeAsync(3_000);
    expect(h.roomManager.resetTimer).toHaveBeenCalledTimes(1);
  });

  test('advances Pomodoro instead of auto-restarting and supports invalidation', async () => {
    const h = makeHarness({ pomodoro: true });
    await h.service.handleCompletion(h.room, {
      roomId: 'room-a', sequence: 1, generation: 3, rewardableElapsedMs: 60_000
    });
    h.service.invalidate('room-a');
    await vi.advanceTimersByTimeAsync(3_000);
    expect(h.roomManager.advancePomodoro).not.toHaveBeenCalled();

    h.room.state.completionSequence = 2;
    await h.service.handleCompletion(h.room, {
      roomId: 'room-a', sequence: 2, generation: 3, rewardableElapsedMs: 60_000
    });
    await vi.advanceTimersByTimeAsync(3_000);
    expect(h.roomManager.advancePomodoro).toHaveBeenCalledTimes(1);
    expect(h.roomManager.resetTimer).not.toHaveBeenCalled();
  });

  test('dispose clears every delayed transition', async () => {
    const h = makeHarness();
    await h.service.handleCompletion(h.room, {
      roomId: 'room-a', sequence: 1, generation: 3, rewardableElapsedMs: 60_000
    });
    h.service.dispose();
    await vi.runAllTimersAsync();
    expect(h.roomManager.resetTimer).not.toHaveBeenCalled();
  });
});
