const { spin } = require('./wheel');

const PHASE_SEQUENCE = ['waiting', 'betting_open', 'betting_closed', 'spin', 'settlement'];
const PHASE_DURATIONS = {
  waiting: 5000,
  betting_open: 30000,
  betting_closed: 0,
  spin: 10000,
  settlement: 5000,
};

function generateId() {
  return crypto.randomUUID();
}

function initializeRoom() {
  const roundId = generateId();
  return {
    roomId: 'roulette_main',
    participants: [],
    currentPhase: 'waiting',
    phaseStartedAt: Date.now(),
    deadlineAt: Date.now() + PHASE_DURATIONS.waiting,
    roundId,
    rounds: {
      [roundId]: { bets: {}, spinResult: null },
    },
    lastSettlement: [],
    readyPlayers: new Set(),
    playerSkins: {},
  };
}

function createNewRound(room) {
  const newRoundId = generateId();
  room.roundId = newRoundId;
  room.rounds[newRoundId] = { bets: {}, spinResult: null };
  return room;
}

function getNextPhase(current) {
  const idx = PHASE_SEQUENCE.indexOf(current);
  return PHASE_SEQUENCE[(idx + 1) % PHASE_SEQUENCE.length];
}

function transitionPhase(room) {
  const next = getNextPhase(room.currentPhase);

  if (next === 'betting_open') {
    room = createNewRound(room);
    room.participants = room.participants.map(p => ({ ...p, left: false }));
    room.lastPayouts = null;
  }

  if (next === 'spin') {
    room.rounds[room.roundId].spinResult = spin(room.roundId);
  }

  room.currentPhase = next;
  room.phaseStartedAt = Date.now();
  room.deadlineAt = Date.now() + PHASE_DURATIONS[next];
  room.readyPlayers = new Set();
  return room;
}

function addParticipant(room, userId, username, balance) {
  if (room.participants.find(p => p.userId === userId)) return room;
  room.participants.push({ userId, username, balance, sessionPnl: 0, isBot: false, left: false });
  return room;
}

function removeParticipant(room, userId) {
  const p = room.participants.find(p => p.userId === userId);
  if (p) p.left = true;
  return room;
}

function getActiveParticipants(room) {
  return room.participants.filter(p => !p.left);
}

module.exports = {
  initializeRoom, createNewRound, transitionPhase,
  addParticipant, removeParticipant, getActiveParticipants,
  PHASE_SEQUENCE, PHASE_DURATIONS,
};
