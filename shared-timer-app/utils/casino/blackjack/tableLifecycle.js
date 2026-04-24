function joinRoom(room, user, helpers) {
  const existing = helpers.getPlayerByUserId(room, user.userId);
  const activeRound = helpers.hasActiveRound(room);

  if (existing) {
    existing.connected = true;
    existing.username = user.username || user.displayName || existing.username;
    existing.displayName = user.displayName || user.username || existing.displayName || existing.username;
    existing.preferences = user.preferences || existing.preferences || {};
    if (activeRound && existing.currentBet <= 0) {
      existing.waitingForNextRound = true;
    }
    return room;
  }

  if (room.players.length >= room.maxPlayers) {
    throw new Error('This blackjack table is full.');
  }

  const seat = helpers.getNextFreeSeat(room);
  if (!seat) {
    throw new Error('No free blackjack seat is available.');
  }

  const player = helpers.createPlayerState(user, seat);
  player.waitingForNextRound = activeRound;
  room.players.push(player);
  room.players = helpers.getOrderedPlayers(room);

  if (activeRound) {
    return room;
  }

  helpers.setRoomPhase(room, room.players.length > 0 ? 'betting' : 'waiting');
  helpers.maybeScheduleAutoStart(room);

  return room;
}

function addBot(room, helpers) {
  if (room.players.length >= room.maxPlayers) {
    throw new Error('This blackjack table is full.');
  }

  const botNumber = room.players.filter((player) => player.isBot).length + 1;
  const seat = helpers.getNextFreeSeat(room);
  if (!seat) {
    throw new Error('No free blackjack seat is available.');
  }

  const botId = `blackjack-bot-${room.roomId}-${botNumber}`;
  room.players.push(helpers.createPlayerState({
    userId: botId,
    username: `blackjackbot${botNumber}`,
    displayName: `Blackjack Bot ${botNumber}`,
    isBot: true
  }, seat));
  room.players = helpers.getOrderedPlayers(room);
  helpers.setRoomPhase(room, room.players.length > 0 ? 'betting' : 'waiting');
  helpers.maybeScheduleAutoStart(room);

  return room;
}

function removeBot(room, helpers, botUserId = null) {
  const bots = room.players.filter((player) => player.isBot);
  if (bots.length === 0) {
    throw new Error('No blackjack bot is seated at this table.');
  }

  const targetBot = botUserId
    ? bots.find((player) => String(player.userId) === String(botUserId))
    : bots[bots.length - 1];

  if (!targetBot) {
    throw new Error('Blackjack bot not found at this table.');
  }

  if (helpers.hasActiveRound(room) && targetBot.currentBet > 0) {
    throw new Error('Bots cannot be removed during an active hand.');
  }

  room.players = room.players.filter((entry) => String(entry.userId) !== String(targetBot.userId));

  if (!helpers.hasActiveRound(room)) {
    helpers.setRoomPhase(room, room.players.length > 0 ? 'betting' : 'waiting');
    helpers.maybeScheduleAutoStart(room);
  }

  return room;
}

function moveSeat(room, user, targetSeat, helpers) {
  const userId = user.userId || user.id;
  let player = helpers.getPlayerByUserId(room, userId);
  const activeRound = helpers.hasActiveRound(room);

  const nextSeat = Number.parseInt(targetSeat, 10);
  if (!Number.isInteger(nextSeat) || nextSeat < 1 || nextSeat > room.maxPlayers) {
    throw new Error('Invalid blackjack seat.');
  }

  if (room.players.some((entry) => entry.seat === nextSeat && String(entry.userId) !== String(userId))) {
    throw new Error('This blackjack seat is already occupied.');
  }

  if (!player) {
    player = helpers.createPlayerState(user, nextSeat);
    player.waitingForNextRound = activeRound;
    room.players.push(player);
  } else {
    if (player.seat === nextSeat) {
      return room;
    }
    const canSwitchDuringActiveRound = activeRound && player.currentBet <= 0 && player.waitingForNextRound;
    if (!helpers.canSwitchSeat(player) || (activeRound && !canSwitchDuringActiveRound)) {
      throw new Error('Seat switching is only available without an active hand.');
    }
    player.seat = nextSeat;
  }

  room.players = helpers.getOrderedPlayers(room);
  if (activeRound) {
    return room;
  }

  helpers.setRoomPhase(room, room.players.length > 0 ? 'betting' : 'waiting');
  return room;
}

function leaveRoom(rooms, roomId, userId, helpers) {
  const room = rooms.get(roomId);
  if (!room) return null;

  const player = helpers.getPlayerByUserId(room, userId);
  if (!player) return room;

  if (helpers.hasActiveRound(room) && player.currentBet > 0) {
    player.connected = false;
  } else {
    room.players = room.players.filter((entry) => String(entry.userId) !== String(userId));
  }

  if (room.players.length === 0) {
    rooms.delete(roomId);
    return null;
  }

  if (!helpers.hasActiveRound(room)) {
    helpers.setRoomPhase(room, 'betting');
    helpers.maybeScheduleAutoStart(room);
  }

  return room;
}

module.exports = {
  joinRoom,
  addBot,
  removeBot,
  moveSeat,
  leaveRoom
};
