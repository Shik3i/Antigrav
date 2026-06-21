function serializeTableSummary(room, orderedPlayers) {
  return {
    roomId: room.roomId,
    game: room.game,
    maxPlayers: room.maxPlayers,
    status: room.status,
    phase: room.phase || room.status,
    playerCount: room.players.length,
    connectedCount: room.players.filter((player) => player.connected).length,
    occupiedSeats: orderedPlayers.map((player) => ({
      userId: player.userId,
      username: player.username,
      displayName: player.displayName || player.username,
      isBot: Boolean(player.isBot),
      seat: player.seat,
      connected: player.connected
    }))
  };
}

module.exports = {
  serializeTableSummary
};
