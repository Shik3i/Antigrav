function getOrderedPlayers(room) {
  return [...room.players].sort((a, b) => a.seat - b.seat);
}

function getPlayerByUserId(room, userId) {
  return room.players.find((player) => String(player.userId) === String(userId)) || null;
}

function getNextFreeSeat(room) {
  const taken = new Set(room.players.map((player) => player.seat));
  for (let seat = 1; seat <= room.maxPlayers; seat += 1) {
    if (!taken.has(seat)) return seat;
  }

  return null;
}

module.exports = {
  getOrderedPlayers,
  getPlayerByUserId,
  getNextFreeSeat
};
