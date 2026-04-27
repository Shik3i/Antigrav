function serializeRoom(room) {
  const currentRoundBets = room.rounds[room.roundId]?.bets || {};
  const spinResult = room.rounds[room.roundId]?.spinResult || null;
  const secondsUntilPhaseEnd = Math.max(0, Math.ceil((room.deadlineAt - Date.now()) / 1000));

  const readyCount = room.readyPlayers ? room.readyPlayers.size : 0;
  const activeCount = room.participants.filter(p => !p.left).length;

  return {
    roomId: room.roomId,
    currentPhase: room.currentPhase,
    roundId: room.roundId,
    participants: room.participants.map(({ userId, username, balance, sessionPnl, left }) => ({
      userId, username, balance, left,
      sessionPnl: sessionPnl || 0,
    })),
    currentRoundBets,
    spinResult,
    lastSettlement: room.lastSettlement,
    deadlineAt: room.deadlineAt,
    secondsUntilPhaseEnd,
    readyCount,
    activeCount,
    readyPlayers: room.readyPlayers ? Array.from(room.readyPlayers) : [],
    lastPayouts: room.lastPayouts || null,
    playerSkins: room.playerSkins || {},
  };
}

module.exports = { serializeRoom };
