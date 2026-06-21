const EVENTS = require('../socketEvents.json');

const ACTION_MESSAGES = {
  START: 'started the timer',
  PAUSE: 'paused the timer',
  RESET: 'reset the timer',
  SET_DURATION: 'changed the timer duration',
  SET_REMAINING: 'adjusted the remaining time'
};

function sendAck(ack, payload) {
  if (typeof ack === 'function') ack(payload);
}

function getRoomWriter(socket, roomManager, roomId) {
  const room = roomManager.getRoom(roomId);
  const member = room?.users.get(socket.id);
  if (!room || !member || member.role !== 'write') return null;
  return { room, member };
}

function reject(socket, ack, error, message) {
  socket.emit(EVENTS.ERROR, message);
  sendAck(ack, { ok: false, error });
}

function registerTimerSocketHandlers({ socket, io, roomManager, lifecycleService, now = Date.now }) {
  async function applyAndBroadcast(roomId, member, action, ack, message) {
    const result = roomManager._applyTimerAction(roomId, action, now());
    if (!result.ok) {
      reject(socket, ack, result.error, `Timer action rejected: ${result.error}`);
      return;
    }
    if (!result.changed) {
      sendAck(ack, { ok: true, changed: false, state: roomManager.getRoomState(roomId) });
      return;
    }

    lifecycleService.invalidate(roomId);
    if (result.completion) {
      await lifecycleService.handleCompletion(result.room, { ...result.completion, roomId });
    } else {
      const state = roomManager.getRoomState(roomId);
      io.to(roomId).emit(EVENTS.SYNC_STATE, state);
      const event = roomManager.addEvent(roomId, 'action', `${member.displayName} ${message}`, socket.id);
      if (event) io.to(roomId).emit(EVENTS.ROOM_EVENT, event);
    }
    sendAck(ack, { ok: true, changed: true, state: roomManager.getRoomState(roomId) });
  }

  socket.on(EVENTS.TIMER_ACTION, async ({ roomId, action, payload } = {}, ack) => {
    const authorized = getRoomWriter(socket, roomManager, roomId);
    if (!authorized) {
      reject(socket, ack, 'FORBIDDEN', 'You do not have permission to control the timer.');
      return;
    }
    if (!Object.prototype.hasOwnProperty.call(ACTION_MESSAGES, action) && action !== 'END_EARLY') {
      reject(socket, ack, 'UNKNOWN_ACTION', 'Timer action rejected: UNKNOWN_ACTION');
      return;
    }
    await applyAndBroadcast(
      roomId,
      authorized.member,
      { type: action, payload },
      ack,
      ACTION_MESSAGES[action] || 'ended the timer early'
    );
  });

  socket.on(EVENTS.SET_POMODORO, async ({ roomId, enabled, pauseMinutes, workName, breakName } = {}, ack) => {
    const authorized = getRoomWriter(socket, roomManager, roomId);
    if (!authorized) {
      reject(socket, ack, 'FORBIDDEN', 'You do not have permission to configure Pomodoro.');
      return;
    }
    const payload = { enabled };
    if (pauseMinutes !== undefined && pauseMinutes !== null) payload.pauseMinutes = Number(pauseMinutes);
    const result = roomManager._applyTimerAction(roomId, { type: 'SET_POMODORO', payload }, now());
    if (!result.ok) {
      reject(socket, ack, result.error, `Pomodoro change rejected: ${result.error}`);
      return;
    }
    if (enabled) {
      result.room.config.pomodoro = result.room.config.pomodoro || {};
      if (workName !== undefined) result.room.config.pomodoro.workName = workName;
      if (breakName !== undefined) result.room.config.pomodoro.breakName = breakName;
    }
    lifecycleService.invalidate(roomId);
    io.to(roomId).emit(EVENTS.SYNC_STATE, roomManager.getRoomState(roomId));
    sendAck(ack, { ok: true, state: roomManager.getRoomState(roomId) });
  });

  socket.on(EVENTS.TOGGLE_AUTO_RESTART, async ({ roomId, enabled } = {}, ack) => {
    const authorized = getRoomWriter(socket, roomManager, roomId);
    if (!authorized) {
      reject(socket, ack, 'FORBIDDEN', 'You do not have permission to configure auto-restart.');
      return;
    }
    await applyAndBroadcast(
      roomId,
      authorized.member,
      { type: 'TOGGLE_AUTO_RESTART', payload: enabled },
      ack,
      enabled ? 'enabled Auto-Restart' : 'disabled Auto-Restart'
    );
  });
}

module.exports = { registerTimerSocketHandlers, getRoomWriter };
