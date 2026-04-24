function normalizeRoomId(roomId) {
  return String(roomId || '').trim();
}

function getRoom(rooms, roomId) {
  const safeRoomId = normalizeRoomId(roomId);
  if (!safeRoomId) return null;
  return rooms.get(safeRoomId) || null;
}

function setRoom(rooms, room) {
  rooms.set(room.roomId, room);
  return room;
}

module.exports = {
  normalizeRoomId,
  getRoom,
  setRoom
};
