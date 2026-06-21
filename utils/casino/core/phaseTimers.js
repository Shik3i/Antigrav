function setDeadline(room, fieldName, deadlineAt) {
  room[fieldName] = deadlineAt;
  return room[fieldName];
}

function clearDeadline(room, fieldName) {
  room[fieldName] = null;
  return room[fieldName];
}

module.exports = {
  setDeadline,
  clearDeadline
};
