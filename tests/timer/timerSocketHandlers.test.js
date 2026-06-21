const { EventEmitter } = require('events');
const EVENTS = require('../../socketEvents.json');
const { registerTimerSocketHandlers } = require('../../sockets/timerSocketHandlers');

class FakeSocket extends EventEmitter {
  constructor(id) {
    super();
    this.id = id;
    this.outbound = [];
  }

  emit(event, ...args) {
    this.outbound.push([event, ...args]);
    return true;
  }

  async receive(event, ...args) {
    const listeners = this.listeners(event);
    return Promise.all(listeners.map(listener => listener(...args)));
  }
}

function makeHarness(role = 'write') {
  const socket = new FakeSocket('socket-a');
  const room = {
    id: 'room-a',
    users: new Map([['socket-a', { socketId: 'socket-a', displayName: 'Admin', role }]]),
    state: { timerRevision: 1 }
  };
  const otherRoom = {
    id: 'room-b',
    users: new Map(),
    state: { timerRevision: 1 }
  };
  const roomManager = {
    getRoom: vi.fn(id => (id === room.id ? room : id === otherRoom.id ? otherRoom : null)),
    _applyTimerAction: vi.fn((roomId, action) => ({
      ok: true,
      changed: true,
      room,
      value: { state: room.state },
      completion: action.type === 'END_EARLY'
        ? { roomId, sequence: 1, generation: 2, rewardableElapsedMs: 1_000, early: true }
        : null
    })),
    getRoomState: vi.fn(id => ({ id, state: { timerRevision: 2 } })),
    addEvent: vi.fn(() => ({ type: 'action', message: 'changed' }))
  };
  const broadcastEmit = vi.fn();
  const io = { to: vi.fn(() => ({ emit: broadcastEmit })) };
  const lifecycleService = { invalidate: vi.fn(), handleCompletion: vi.fn(async () => true) };
  registerTimerSocketHandlers({ socket, io, roomManager, lifecycleService, now: () => 5_000 });
  return { socket, room, otherRoom, roomManager, io, broadcastEmit, lifecycleService };
}

describe('timerSocketHandlers', () => {
  test('accepts SET_REMAINING from a writer in the exact room and acknowledges once', async () => {
    const h = makeHarness();
    const ack = vi.fn();
    await h.socket.receive(EVENTS.TIMER_ACTION, {
      roomId: 'room-a', action: 'SET_REMAINING', payload: 300_000
    }, ack);
    expect(h.roomManager._applyTimerAction).toHaveBeenCalledWith(
      'room-a', { type: 'SET_REMAINING', payload: 300_000 }, 5_000
    );
    expect(h.lifecycleService.invalidate).toHaveBeenCalledWith('room-a');
    expect(h.broadcastEmit).toHaveBeenCalledWith(EVENTS.SYNC_STATE, expect.objectContaining({ id: 'room-a' }));
    expect(ack).toHaveBeenCalledTimes(1);
    expect(ack).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
  });

  test('rejects a writer attempting to mutate another room', async () => {
    const h = makeHarness();
    const ack = vi.fn();
    await h.socket.receive(EVENTS.TIMER_ACTION, { roomId: 'room-b', action: 'RESET' }, ack);
    expect(h.roomManager._applyTimerAction).not.toHaveBeenCalled();
    expect(ack).toHaveBeenCalledWith({ ok: false, error: 'FORBIDDEN' });
    expect(h.socket.outbound).toContainEqual([EVENTS.ERROR, 'You do not have permission to control the timer.']);
  });

  test('rejects invalid actions without mutation', async () => {
    const h = makeHarness();
    h.roomManager._applyTimerAction.mockReturnValue({ ok: false, changed: false, error: 'INVALID_REMAINING' });
    const ack = vi.fn();
    await h.socket.receive(EVENTS.TIMER_ACTION, {
      roomId: 'room-a', action: 'SET_REMAINING', payload: 0
    }, ack);
    expect(h.broadcastEmit).not.toHaveBeenCalledWith(EVENTS.SYNC_STATE, expect.anything());
    expect(ack).toHaveBeenCalledWith({ ok: false, error: 'INVALID_REMAINING' });
  });

  test('routes END_EARLY through the lifecycle exactly once', async () => {
    const h = makeHarness();
    const ack = vi.fn();
    await h.socket.receive(EVENTS.TIMER_ACTION, { roomId: 'room-a', action: 'END_EARLY' }, ack);
    expect(h.lifecycleService.handleCompletion).toHaveBeenCalledTimes(1);
    expect(h.lifecycleService.handleCompletion).toHaveBeenCalledWith(h.room, expect.objectContaining({ early: true }));
    expect(ack).toHaveBeenCalledWith(expect.objectContaining({ ok: true, changed: true }));
  });

  test('registers Pomodoro and auto-restart handlers with room-scoped authorization', async () => {
    const h = makeHarness('read');
    await h.socket.receive(EVENTS.SET_POMODORO, { roomId: 'room-a', enabled: true, pauseMinutes: 5 });
    await h.socket.receive(EVENTS.TOGGLE_AUTO_RESTART, { roomId: 'room-a', enabled: false });
    expect(h.roomManager._applyTimerAction).not.toHaveBeenCalled();
  });
});
