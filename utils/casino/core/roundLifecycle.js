function setPhase(room, phase, fields = {}) {
  room.status = phase;
  room.phase = phase;
  Object.assign(room, fields);
  return room;
}

function advanceRound(room) {
  room.roundId += 1;
  return room.roundId;
}

module.exports = {
  setPhase,
  advanceRound
};
