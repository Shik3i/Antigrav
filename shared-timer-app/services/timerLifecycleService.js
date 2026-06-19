const EVENTS = require('../socketEvents.json');

function createTimerLifecycleService({
  io,
  roomManager,
  dbLayer,
  broadcastCoinUpdate = () => {},
  setTimeoutFn = setTimeout,
  clearTimeoutFn = clearTimeout
}) {
  const processedByRoom = new WeakMap();
  const pendingByRoom = new Map();

  function invalidate(roomId) {
    const timeoutId = pendingByRoom.get(roomId);
    if (timeoutId !== undefined) clearTimeoutFn(timeoutId);
    pendingByRoom.delete(roomId);
  }

  function scheduleFollowUp(room, completion) {
    invalidate(room.id);
    if (!room.state.isPomodoro && !room.state.autoRestart) return;

    const timeoutId = setTimeoutFn(() => {
      pendingByRoom.delete(room.id);
      const current = roomManager.getRoom(room.id);
      if (!current
        || current.state.transitionGeneration !== completion.generation
        || current.state.completionSequence !== completion.sequence) return;

      if (current.state.isPomodoro) {
        roomManager.advancePomodoro(room.id, Date.now());
      } else if (current.state.autoRestart) {
        roomManager.resetTimer(room.id, Date.now());
        roomManager.startTimer(room.id, Date.now());
      } else {
        return;
      }
      io.to(room.id).emit(EVENTS.SYNC_STATE, roomManager.getRoomState(room.id));
    }, 3_000);
    pendingByRoom.set(room.id, timeoutId);
  }

  async function persistUserCompletion(room, user, completion, coinsToAward) {
    const userId = user.userId || user.id;
    const durationMinutes = completion.rewardableElapsedMs / 60_000;
    await dbLayer.addUser(userId, user.displayName || user.username);
    await dbLayer.recordTimerCompletion(userId, room.id, room.config.name, durationMinutes);
    if (coinsToAward <= 0) return;
    const reason = completion.early
      ? `Completed ${Math.round(durationMinutes)}m timer (ended early)`
      : `Completed ${Math.round(durationMinutes)}m timer`;
    const newBalance = await dbLayer.addKoalaCoins(userId, coinsToAward, reason);
    broadcastCoinUpdate(io, userId, newBalance);
    for (const member of room.users.values()) {
      if ((member.userId || member.id) === userId && member.socketId) {
        io.to(member.socketId).emit('KOALA_COINS_EARNED', { amount: coinsToAward, newBalance });
      }
    }
  }

  async function handleCompletion(room, completion) {
    const processedSequences = processedByRoom.get(room) || new Set();
    if (processedSequences.has(completion.sequence)) return false;
    processedSequences.add(completion.sequence);
    processedByRoom.set(room, processedSequences);

    room.state.stats = room.state.stats || { totalCompletions: 0, userCompletions: {} };
    room.state.stats.totalCompletions += 1;

    const uniqueUsers = new Map();
    for (const user of room.users.values()) {
      const userId = user.userId || user.id;
      if (userId && !uniqueUsers.has(userId)) uniqueUsers.set(userId, user);
    }
    for (const userId of uniqueUsers.keys()) {
      room.state.stats.userCompletions[userId] = (room.state.stats.userCompletions[userId] || 0) + 1;
    }

    const payload = { roomId: room.id, sequence: completion.sequence, timestamp: Date.now() };
    io.to(room.id).emit(EVENTS.TIMER_COMPLETED, payload);
    io.to(room.id).emit(EVENTS.SYNC_STATE, roomManager.getRoomState(room.id));
    const event = roomManager.addEvent(room.id, 'action', 'Timer reached 0!');
    if (event) io.to(room.id).emit(EVENTS.ROOM_EVENT, event);
    scheduleFollowUp(room, completion);

    const settings = await dbLayer.getKoalaBaseline();
    const coinsToAward = Math.floor(
      (completion.rewardableElapsedMs / 3_600_000) * settings.koala_points_per_hour
    );
    await Promise.all(Array.from(uniqueUsers.values()).map(user => (
      persistUserCompletion(room, user, completion, coinsToAward)
    )));

    return true;
  }

  function dispose() {
    for (const timeoutId of pendingByRoom.values()) clearTimeoutFn(timeoutId);
    pendingByRoom.clear();
  }

  return { handleCompletion, invalidate, dispose };
}

module.exports = { createTimerLifecycleService };
